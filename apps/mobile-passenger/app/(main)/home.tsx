import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
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
  const [destination, setDestination] = useState('');
  const [selectedDest, setSelectedDest] = useState<(typeof DESTINATIONS)[0] | null>(null);
  const [rideType, setRideType] = useState<RideType>('standard_tricycle');
  const [showDestinations, setShowDestinations] = useState(false);
  const [loading, setLoading] = useState(false);
  const { rideStatus, setActiveRide, setRideStatus } = useRideStore();

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
  }, [acquirePickup]);

  // Filter destinations based on search

  const filteredDestinations = DESTINATIONS.filter((d) =>
    d.label.toLowerCase().includes(destination.toLowerCase()),
  );

  const handleSelectDestination = (dest: (typeof DESTINATIONS)[0]) => {
    setSelectedDest(dest);
    setDestination(dest.label);
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
        subscribeToRide(response.id);
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
          await patch(`/rides/${createdRideId}/cancel`);
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

  class ContinuationFailedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ContinuationFailedError';
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Map View</Text>
        <Text style={styles.mapSubtext}>Kansawrodo · Sekondi-Takoradi</Text>
      </View>
      <View style={styles.bottomCard}>
        <Text style={styles.greeting}>Where are you going?</Text>
        {pickupError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{pickupError}</Text>
            <TouchableOpacity onPress={acquirePickup} disabled={acquiringPickup} style={styles.retryButton}>
              {acquiringPickup ? <ActivityIndicator color="#FFF" /> : <Text style={styles.retryText}>Use my location</Text>}
            </TouchableOpacity>
          </View>
        )}
        {continuationError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{continuationError}</Text>
            <TouchableOpacity onPress={acquirePickup} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry pickup</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Destination search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchBar}
            placeholder="Search destination..."
            placeholderTextColor="#94A3B8"
            value={destination}
            onChangeText={(text) => {
              setDestination(text);
              setShowDestinations(true);
              if (!text) setSelectedDest(null);
            }}
            onFocus={() => setShowDestinations(true)}
          />
          {showDestinations && filteredDestinations.length > 0 && (
            <View style={styles.dropdownList}>
              {filteredDestinations.map((dest) => (
                <TouchableOpacity
                  key={dest.label}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectDestination(dest)}
                >
                  <Text style={styles.dropdownText}>{dest.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Ride type selector */}
        {selectedDest && (
          <>
            <View style={styles.rideTypeRow}>
              <TouchableOpacity
                style={[styles.rideTypeBtn, rideType === 'standard_tricycle' && styles.rideTypeBtnActive]}
                onPress={() => setRideType('standard_tricycle')}
              >
                <Text style={[styles.rideTypeText, rideType === 'standard_tricycle' && styles.rideTypeTextActive]}>
                  Standard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rideTypeBtn, rideType === 'priority_tricycle' && styles.rideTypeBtnActive]}
                onPress={() => setRideType('priority_tricycle')}
              >
                <Text style={[styles.rideTypeText, rideType === 'priority_tricycle' && styles.rideTypeTextActive]}>
                  Priority
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fareNotice}>
              Your fare is calculated by KansRide when the ride is requested.
            </Text>

            {/* Request button */}
            <TouchableOpacity
              style={[styles.button, (loading || acquiringPickup || !pickup) && styles.buttonDisabled]}
              onPress={handleRequestRide}
              disabled={loading || acquiringPickup || !pickup}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Request Ride</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8E8E8' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapText: { fontSize: 24, fontWeight: '600', color: '#64748B' },
  mapSubtext: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  bottomCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  searchContainer: { position: 'relative', zIndex: 10 },
  searchBar: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    height: 52,
    fontSize: 16,
    color: '#1A1A2E',
  },
  dropdownList: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownText: { fontSize: 15, color: '#1A1A2E' },
  rideTypeRow: { flexDirection: 'row', gap: 12 },
  rideTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  rideTypeBtnActive: { borderColor: '#1B8B4B', backgroundColor: '#F0FDF4' },
  rideTypeText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  rideTypeTextActive: { color: '#1B8B4B' },
  fareNotice: { fontSize: 13, color: '#64748B' },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  errorCard: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, gap: 8 },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: '#1B8B4B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
