import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { post, patch } from '../../src/api/client';
import {
  connectSocket,
  subscribeToRide,
} from '../../src/api/socket';
import { useRideStore } from '../../src/stores/ride-store';
import type { CreateRideResponse, RideType } from '@kansride/types';
import {
  ensureForegroundPermission,
  getLocationServicesState,
  acquireCurrentPosition,
} from '../../src/services/location';
import type { LocationOutcome } from '../../src/services/location';
import { ContinuationFailedError } from '../../src/errors';
import { loadSavedPlaces, type SavedPlace } from '../../src/saved-places';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, FeedbackBanner, StatusBadge, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { useAuthStore } from '../../src/stores/auth-store';
import { usePassengerInsets } from '../../src/ui/use-passenger-insets';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.EXPO_PUBLIC_UI_REVIEW_MODE,
);

// Acquire real device coordinates for pickup. No fabricated fallback — a
// denied/disabled/timed-out/unavailable outcome is surfaced honestly and the
// user can retry. The ride request button stays disabled until valid coords
// are available so the backend never receives a fake pickup.
const DESTINATIONS = [
  { label: 'Takoradi Market Circle', latitude: 4.89, longitude: -1.75 },
  { label: 'Sekondi Station', latitude: 4.945, longitude: -1.71 },
  { label: 'UHAS Campus', latitude: 4.91, longitude: -1.77 },
  { label: 'Airport Roundabout', latitude: 4.905, longitude: -1.765 },
  { label: 'Harbour Area', latitude: 4.885, longitude: -1.755 },
];

// Honest, user-facing labels for typed location outcomes — same contract as
// the driver app so a denied/blocked/disabled/timed-out pickup attempt shows
// a clear, retryable message instead of a fake-success coordinate.
function describeLocationFailure(outcome: LocationOutcome): { title: string; message: string } {
  switch (outcome.kind) {
    case 'denied':
      return {
        title: 'Location permission denied',
        message: outcome.canAskAgain
          ? 'KansRide needs your location to request a ride. Please grant location permission and try again.'
          : 'Location permission is blocked. Open Settings, enable location for KansRide, then try again.',
      };
    case 'services-disabled':
      return {
        title: 'Location services off',
        message: 'Turn on device location (GPS) so KansRide knows where to pick you up.',
      };
    case 'unavailable':
      return {
        title: 'Location unavailable',
        message: outcome.reason || 'Your location could not be determined. Try again in a moment.',
      };
    default:
      return { title: 'Location unavailable', message: 'Your location could not be determined.' };
  }
}

export default function HomeScreen() {
  const insets = usePassengerInsets();
  const user = useAuthStore((state) => state.user);
  const [destination, setDestination] = useState('');
  const [selectedDest, setSelectedDest] = useState<(typeof DESTINATIONS)[0] | null>(null);
  const [rideType, setRideType] = useState<RideType>('standard_tricycle');
  const [showDestinations, setShowDestinations] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{
    estimatedDistanceMeters: number;
    estimatedDurationSeconds: number;
    fareBreakdown: { totalFarePesewas: number };
  } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const { setActiveRide, setRideStatus } = useRideStore();

  // Pickup state — real device coordinates only, never fabricated.
  type Pickup = { latitude: number; longitude: number };
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [acquiringPickup, setAcquiringPickup] = useState(false);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [continuationError, setContinuationError] = useState<string | null>(null);

  // Acquire pickup once on mount so the request button can be enabled as soon
  // as we have valid coordinates. Users can retry via the "Use my location"
  // button if it fails.
  const acquirePickup = useCallback(async () => {
    setAcquiringPickup(true);
    setPickupError(null);
    try {
      if (reviewMode) {
        setPickup({ latitude: 4.9016, longitude: -1.7831 });
        return;
      }
      const permission = await ensureForegroundPermission();
      if (permission.kind !== 'granted') {
        const { title, message } = describeLocationFailure(permission);
        setPickupError(`${title}: ${message}`);
        return;
      }
      const services = await getLocationServicesState();
      if (services.kind !== 'granted') {
        const { title, message } = describeLocationFailure(services);
        setPickupError(`${title}: ${message}`);
        return;
      }
      const position = await acquireCurrentPosition();
      if (position.kind !== 'position') {
        const { title, message } = describeLocationFailure(position);
        setPickupError(`${title}: ${message}`);
        return;
      }
      setPickup({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } finally {
      setAcquiringPickup(false);
    }
  }, []);

  useEffect(() => {
    acquirePickup();
    if (reviewMode) {
      setSavedPlaces([
        { id: 'review-home', kind: 'home', label: 'Home', latitude: 4.91, longitude: -1.77 },
        { id: 'review-work', kind: 'work', label: 'Work', latitude: 4.885, longitude: -1.755 },
      ]);
    } else {
      void loadSavedPlaces().then(setSavedPlaces).catch(() => setSavedPlaces([]));
    }
  }, [acquirePickup]);

  useEffect(() => {
    if (!pickup || !selectedDest) {
      setEstimate(null);
      setEstimateError(null);
      return;
    }

    let cancelled = false;
    setEstimateLoading(true);
    setEstimateError(null);
    if (reviewMode) {
      setEstimate({
        estimatedDistanceMeters: 6400,
        estimatedDurationSeconds: rideType === 'priority_tricycle' ? 660 : 780,
        fareBreakdown: { totalFarePesewas: rideType === 'priority_tricycle' ? 2450 : 1850 },
      });
      setEstimateLoading(false);
      return;
    }
    void post<{
      estimatedDistanceMeters: number;
      estimatedDurationSeconds: number;
      fareBreakdown: { totalFarePesewas: number };
    }>('/rides/estimate', {
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      dropoffLatitude: selectedDest.latitude,
      dropoffLongitude: selectedDest.longitude,
      rideType,
    })
      .then((data) => {
        if (!cancelled) setEstimate(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setEstimate(null);
          setEstimateError(error instanceof Error ? error.message : 'Could not estimate fare. Try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setEstimateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pickup, selectedDest, rideType]);

  // Filter destinations based on search

  const filteredDestinations = DESTINATIONS.filter((d) =>
    d.label.toLowerCase().includes(destination.toLowerCase()),
  );

  const handleSelectDestination = (dest: (typeof DESTINATIONS)[0]) => {
    setSelectedDest(dest);
    setDestination(dest.label);
    setShowDestinations(false);
  };

  const handleSelectSavedPlace = (place: SavedPlace) => {
    setSelectedDest({ label: place.label, latitude: place.latitude, longitude: place.longitude });
    setDestination(place.label);
    setShowDestinations(false);
  };

  const handleRequestRide = async () => {
    if (!selectedDest) {
      Alert.alert('Select Destination', 'Please choose where you want to go');
      return;
    }
    if (!pickup) {
      Alert.alert(
        'Pickup location needed',
        'We could not get your location. Tap "Use my location" to try again, then request your ride.',
      );
      return;
    }

    if (reviewMode) {
      setActiveRide({
        id: 'ui-review-ride',
        status: 'searching',
        pickupAddress: 'Your current location',
        dropoffAddress: selectedDest.label,
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        dropoffLatitude: selectedDest.latitude,
        dropoffLongitude: selectedDest.longitude,
        rideType,
        estimatedFarePesewas: estimate?.fareBreakdown.totalFarePesewas ?? 1850,
        verificationPin: '4821',
      });
      setRideStatus('searching');
      router.push({ pathname: '/(main)/ride/[id]', params: { id: 'ui-review-ride' } });
      return;
    }

    setLoading(true);
    setRideStatus('requesting');
    setContinuationError(null);

    let createdRideId: string | null = null;

    try {
      const response = await post<CreateRideResponse>('/rides', {
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        dropoffLatitude: selectedDest.latitude,
        dropoffLongitude: selectedDest.longitude,
        rideType,
      });
      createdRideId = response.id;

      setActiveRide({
        id: response.id,
        status: 'searching',
        pickupAddress: 'Your location',
        dropoffAddress: selectedDest.label,
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        dropoffLatitude: selectedDest.latitude,
        dropoffLongitude: selectedDest.longitude,
        rideType: response.rideType,
        estimatedFarePesewas: response.estimatedFarePesewas,
        verificationPin: response.verificationPin,
      });
      setRideStatus('searching');

      // Socket continuation — if this fails the ride has already been created
      // server-side, so an invisible searching ride would persist unless we
      // roll it back. We attempt a best-effort cancel and clear local state so
      // the user lands back on home with an honest, retryable message rather
      // than navigating to a phantom active-ride screen. No orphan is left
      // behind in the client, and the backend ride is moved to a terminal
      // cancelled state.
      try {
        await connectSocket();
        await subscribeToRide(response.id);
      } catch (socketError: any) {
        throw new ContinuationFailedError(
          socketError?.message || 'Failed to connect to the server for live updates',
        );
      }

      // Navigate to the active ride screen only once the ride is both created
      // and subscribed — at this point the client view and the server state
      // agree and the ride is visible to the user.
      router.push({ pathname: '/(main)/ride/[id]', params: { id: response.id } });
    } catch (error: any) {
      const reason = error instanceof ContinuationFailedError
        ? error.message
        : (error?.message || 'Failed to request ride');

      if (createdRideId) {
        // Best-effort server-side cancellation so a phantom "searching" ride
        // can't silently persist after navigation was blocked. Failures here
        // are swallowed because the user already needs to retry the whole flow;
        // the ride will eventually time out on the server if the cancel fails.
        try {
          await patch(`/rides/${createdRideId}/cancel`, {
            reason: 'Passenger app could not establish live ride updates',
          });
        } catch {
          // Intentionally ignored — retry is the next user action.
        }
      }

      setActiveRide(null);
      setRideStatus('idle');
      setContinuationError(reason);
      Alert.alert('Could not request ride', reason);
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={pickup ? {
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          } : undefined}
          region={pickup ? {
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          } : undefined}
          showsUserLocation={Boolean(pickup)}
          showsMyLocationButton={false}
        >
          {pickup && <Marker coordinate={pickup} title="Pickup" pinColor={colors.pickupPin} />}
          {selectedDest && (
            <Marker
              coordinate={{ latitude: selectedDest.latitude, longitude: selectedDest.longitude }}
              title={selectedDest.label}
              pinColor={colors.dropoffPin}
            />
          )}
        </MapView>
        <View style={[styles.mapHeader, { top: insets.top }] }>
          <View>
            <Text style={styles.hello}>Good day, {firstName}</Text>
            <Text style={styles.mapTitle}>Let’s find your next ride</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text></View>
        </View>
        <TouchableOpacity style={styles.locationButton} onPress={() => void acquirePickup()} disabled={acquiringPickup} accessibilityRole="button" accessibilityLabel="Refresh my pickup location">
          {acquiringPickup ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="locate" size={21} color={colors.primary} />}
        </TouchableOpacity>
        {!pickup && <View style={styles.mapOverlay}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.mapOverlayText}>Finding your pickup location…</Text></View>}
      </View>
      <View style={[styles.bottomCard, selectedDest && styles.bottomCardExpanded]}>
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.compactBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <View style={styles.handle} />
        <View style={styles.sheetHeadingRow}>
          <View><Text style={styles.greeting}>Where to?</Text><Text style={styles.sheetSubtitle}>Choose a destination to see your fare</Text></View>
          {pickup && <StatusBadge label="Pickup ready" tone="success" dot />}
        </View>
        {pickupError && (
          <FeedbackBanner tone="error" title="Pickup unavailable" message={pickupError} action={<TouchableOpacity onPress={() => void acquirePickup()} disabled={acquiringPickup}><Text style={styles.bannerAction}>Retry</Text></TouchableOpacity>} />
        )}
        {continuationError && (
          <FeedbackBanner tone="error" title="Ride request interrupted" message={continuationError} />
        )}

        {/* Destination search */}
        <View style={styles.searchContainer}>
          <View style={styles.pickupSummary}>
            <View style={styles.pickupDot} />
            <View style={styles.pickupCopy}><Text style={styles.pickupLabel}>Current location</Text><Text style={styles.pickupMeta}>{pickup ? 'GPS confirmed' : 'Locating…'}</Text></View>
          </View>
          <View style={styles.searchInputRow}>
            <Ionicons name="location" size={19} color={colors.dropoffPin} />
          <TextInput
            style={styles.searchBar}
            placeholder="Enter your destination"
            placeholderTextColor={colors.textMuted}
            value={destination}
            onChangeText={(text) => {
              setDestination(text);
              setShowDestinations(true);
              if (!text) setSelectedDest(null);
            }}
            onFocus={() => setShowDestinations(true)}
            accessibilityLabel="Destination"
          />
          </View>
          {!selectedDest && savedPlaces.length > 0 && (
            <View style={styles.quickPlaces}>
              {savedPlaces.slice(0, 3).map((place) => (
                <TouchableOpacity key={place.id} style={styles.placeChip} onPress={() => handleSelectSavedPlace(place)}>
                  <Ionicons name={place.kind === 'home' ? 'home-outline' : place.kind === 'work' ? 'briefcase-outline' : 'bookmark-outline'} size={16} color={colors.primary} />
                  <Text style={styles.placeChipText}>{place.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {showDestinations && (filteredDestinations.length > 0 || savedPlaces.length > 0) && (
            <View style={styles.dropdownList}>
              {savedPlaces.filter((place) => place.label.toLowerCase().includes(destination.toLowerCase())).slice(0, 2).map((place) => (
                <TouchableOpacity key={place.id} style={styles.dropdownItem} onPress={() => handleSelectSavedPlace(place)}>
                  <View style={styles.dropdownIcon}><Ionicons name="bookmark-outline" size={17} color={colors.primary} /></View>
                  <View style={styles.dropdownCopy}><Text style={styles.dropdownText}>{place.label}</Text><Text style={styles.dropdownMeta}>Saved place</Text></View>
                  <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
              {filteredDestinations.slice(0, 3).map((dest) => (
                <TouchableOpacity key={dest.label} style={styles.dropdownItem} onPress={() => handleSelectDestination(dest)}>
                  <View style={styles.dropdownIcon}><Ionicons name="location-outline" size={18} color={colors.textSecondary} /></View>
                  <View style={styles.dropdownCopy}><Text style={styles.dropdownText}>{dest.label}</Text><Text style={styles.dropdownMeta}>Sekondi–Takoradi</Text></View>
                  <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Ride type selector */}
        {selectedDest && (
          <>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Choose your ride</Text><Text style={styles.sectionHint}>Fares shown upfront</Text></View>
            <View style={styles.rideTypeRow}>
              <TouchableOpacity
                style={[styles.rideTypeBtn, rideType === 'standard_tricycle' && styles.rideTypeBtnActive]}
                onPress={() => setRideType('standard_tricycle')}
              >
                <View style={[styles.vehicleIcon, rideType === 'standard_tricycle' && styles.vehicleIconActive]}>
                  <MaterialCommunityIcons name="rickshaw" size={27} color={rideType === 'standard_tricycle' ? colors.textInverse : colors.primary} />
                </View>
                <Text style={[styles.rideTypeText, rideType === 'standard_tricycle' && styles.rideTypeTextActive]}>
                  Standard
                </Text>
                <Text style={styles.rideTypeMeta}>Best value</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rideTypeBtn, rideType === 'priority_tricycle' && styles.rideTypeBtnActive]}
                onPress={() => setRideType('priority_tricycle')}
              >
                <View style={[styles.vehicleIcon, rideType === 'priority_tricycle' && styles.vehicleIconActive]}>
                  <Ionicons name="flash" size={24} color={rideType === 'priority_tricycle' ? colors.textInverse : colors.primary} />
                </View>
                <Text style={[styles.rideTypeText, rideType === 'priority_tricycle' && styles.rideTypeTextActive]}>
                  Priority
                </Text>
                <Text style={styles.rideTypeMeta}>Faster pickup</Text>
              </TouchableOpacity>
            </View>

            {estimateLoading && <View style={styles.estimateLoading}><ActivityIndicator color={colors.primary} /><Text style={styles.estimateLoadingText}>Calculating your trip…</Text></View>}
            {estimateError && (
              <FeedbackBanner tone="error" title="Fare unavailable" message={estimateError} action={<TouchableOpacity onPress={() => setSelectedDest({ ...selectedDest })}><Text style={styles.bannerAction}>Retry</Text></TouchableOpacity>} />
            )}
            {estimate && (
              <View style={styles.estimateCard}>
                <View><Text style={styles.estimateLabel}>Estimated fare</Text><Text style={styles.fare}>GHS {(estimate.fareBreakdown.totalFarePesewas / 100).toFixed(2)}</Text></View>
                <View style={styles.estimateDivider} />
                <View style={styles.estimateMetric}><Ionicons name="time-outline" size={17} color={colors.primary} /><Text style={styles.metricValue}>{Math.ceil(estimate.estimatedDurationSeconds / 60)} min</Text><Text style={styles.metricLabel}>trip time</Text></View>
                <View style={styles.estimateMetric}><Ionicons name="navigate-outline" size={17} color={colors.primary} /><Text style={styles.metricValue}>{(estimate.estimatedDistanceMeters / 1000).toFixed(1)} km</Text><Text style={styles.metricLabel}>distance</Text></View>
              </View>
            )}

            {/* Request button */}
            <Button
              title={estimate ? `Request ${rideType === 'priority_tricycle' ? 'Priority' : 'Standard'} ride` : 'Request ride'}
              onPress={() => void handleRequestRide()}
              disabled={loading || acquiringPickup || !pickup || !estimate}
              loading={loading}
              fullWidth
              size="lg"
              trailing={!loading ? <Ionicons name="arrow-forward" size={19} color={colors.textInverse} /> : undefined}
            />
            <Text style={styles.fareDisclaimer}>Final fare is confirmed when your ride is requested.</Text>
          </>
        )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDeep },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapHeader: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceTranslucent, borderRadius: borderRadius.xl, padding: spacing.md, ...shadows.md },
  hello: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  mapTitle: { ...typography.h3, color: colors.textPrimary, marginTop: 1 },
  avatar: { width: 42, height: 42, borderRadius: borderRadius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.bodyBold, color: colors.textInverse },
  locationButton: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 48, height: 48, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.md },
  mapOverlay: { position: 'absolute', alignSelf: 'center', top: 132, backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...shadows.sm },
  mapOverlayText: { ...typography.small, color: colors.textSecondary },
  bottomCard: {
    maxHeight: '58%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  bottomCardExpanded: { maxHeight: '64%' },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: spacing.lg, gap: 12 },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { ...typography.h2, color: colors.textPrimary },
  sheetSubtitle: { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  bannerAction: { ...typography.label, color: colors.primary, padding: spacing.sm },
  searchContainer: { position: 'relative', zIndex: 10, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pickupSummary: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12, paddingHorizontal: 2 },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.pickupPin, borderWidth: 2, borderColor: colors.surface },
  pickupCopy: { flex: 1 },
  pickupLabel: { ...typography.bodyBold, color: colors.textPrimary },
  pickupMeta: { ...typography.caption, color: colors.success },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  searchBar: {
    flex: 1,
    minHeight: 50,
    paddingVertical: 0,
    ...typography.body,
    color: colors.textPrimary,
  },
  quickPlaces: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primarySoft, borderRadius: borderRadius.full, paddingHorizontal: 13, minHeight: 36 },
  placeChipText: { ...typography.small, color: colors.primaryDark, fontWeight: '700' },
  dropdownList: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  dropdownItem: { minHeight: 54, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
  dropdownIcon: { width: 34, height: 34, borderRadius: borderRadius.md, backgroundColor: colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  dropdownCopy: { flex: 1 },
  dropdownText: { ...typography.bodyBold, color: colors.textPrimary },
  dropdownMeta: { ...typography.caption, color: colors.textSecondary },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionHint: { ...typography.caption, color: colors.textSecondary },
  rideTypeRow: { flexDirection: 'row', gap: 12 },
  rideTypeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  rideTypeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  vehicleIcon: { width: 44, height: 44, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceInset, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  vehicleIconActive: { backgroundColor: colors.primary },
  rideTypeText: { ...typography.bodyBold, color: colors.textPrimary },
  rideTypeTextActive: { color: colors.primaryDark },
  rideTypeMeta: { ...typography.caption, color: colors.textSecondary },
  estimateLoading: { minHeight: 70, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceInset, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  estimateLoadingText: { ...typography.small, color: colors.textSecondary },
  estimateCard: { backgroundColor: colors.primarySoft, borderRadius: borderRadius.xl, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  estimateLabel: { ...typography.caption, color: colors.primaryDark },
  fare: { ...typography.h2, color: colors.primaryDark },
  estimateDivider: { width: 1, height: 42, backgroundColor: colors.primarySoftBorder },
  estimateMetric: { alignItems: 'center' },
  metricValue: { ...typography.label, color: colors.textPrimary, marginTop: 1 },
  metricLabel: { ...typography.caption, color: colors.textSecondary },
  fareDisclaimer: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: -5 },
});
