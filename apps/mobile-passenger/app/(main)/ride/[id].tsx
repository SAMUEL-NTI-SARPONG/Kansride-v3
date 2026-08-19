import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
  ScrollView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRideStore } from '../../../src/stores/ride-store';
import { get, patch, post } from '../../../src/api/client';
import {
  subscribeToRide,
  unsubscribeFromRide,
  onRideUpdate,
  onDriverLocation,
  connectSocket,
} from '../../../src/api/socket';
import type { ActiveRide, RideStatus } from '../../../src/stores/ride-store';
import { mobileRuntimeUrl } from '@kansride/config/mobile-runtime';
import type { PublicTrackingLink } from '@kansride/types';
import {
  cancellationReasonLabel,
  PASSENGER_CANCELLATION_REASONS,
  type PassengerCancellationReason,
} from '../../../src/cancellation-reasons';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FeedbackBanner, StatusBadge, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { usePassengerInsets } from '../../../src/ui/use-passenger-insets';

const reviewMode = developmentReviewModeEnabled(process.env.NODE_ENV, process.env.EXPO_PUBLIC_UI_REVIEW_MODE);

const STATUS_LABELS: Record<RideStatus, string> = {
  idle: 'Idle',
  requesting: 'Requesting...',
  searching: 'Finding you a driver...',
  driver_assigned: 'Driver assigned!',
  en_route: 'Driver is on the way',
  arrived: 'Driver has arrived',
  in_progress: 'Ride in progress',
  completed: 'Ride completed',
  cancelled: 'Ride cancelled',
};

function formatGhsFromPesewas(pesewas: number | null | undefined): string {
  if (typeof pesewas !== 'number' || !Number.isSafeInteger(pesewas) || pesewas < 0) {
    return '--';
  }
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

export default function ActiveRideScreen() {
  const insets = usePassengerInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    activeRide,
    rideStatus,
    driverLocation,
    setRideStatus,
    setDriverLocation,
    updateFromSocket,
    setActiveRide,
    resetRide,
  } = useRideStore();
  const [rating, setRating] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancellationReasons, setShowCancellationReasons] = useState(false);
  const [selectedCancellationReason, setSelectedCancellationReason] = useState<PassengerCancellationReason | null>(null);
  const [sharing, setSharing] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let unsubUpdate: (() => void) | undefined;
    let unsubLocation: (() => void) | undefined;

    const setupSocket = async () => {
      try {
        await connectSocket();
        subscribeToRide(id);

        unsubUpdate = onRideUpdate((data) => {
          updateFromSocket(data);
          if (data.status === 'completed') {
            setShowRating(true);
          }
        });

        unsubLocation = onDriverLocation((location) => {
          setDriverLocation(location);
        });
      } catch (error) {
        setSocketError(error instanceof Error ? error.message : 'Live updates are unavailable');
      }
    };

    if (reviewMode) {
      setDriverLocation({ latitude: 4.8988, longitude: -1.7788, heading: 40 });
      return () => setDriverLocation(null);
    }

    if (!activeRide || activeRide.id !== id) {
      setRefreshing(true);
      void get<Record<string, unknown>>(`/rides/${id}`)
        .then((ride) => {
          const status = String(ride.status);
          if (['completed', 'cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_admin', 'no_driver_found'].includes(status)) {
            resetRide();
            return;
          }
          useRideStore.getState().setActiveRide({
            id: String(ride.id),
            status: status === 'driver_assigned' ? 'driver_assigned' : 'searching',
            pickupAddress: typeof ride.pickupAddress === 'string' ? ride.pickupAddress : 'Pickup location',
            dropoffAddress: typeof ride.dropoffAddress === 'string' ? ride.dropoffAddress : 'Dropoff location',
            pickupLatitude: Number(ride.pickupLatitude),
            pickupLongitude: Number(ride.pickupLongitude),
            dropoffLatitude: Number(ride.dropoffLatitude),
            dropoffLongitude: Number(ride.dropoffLongitude),
            rideType: ride.rideType as ActiveRide['rideType'],
            estimatedFarePesewas: Number(ride.estimatedFarePesewas),
            verificationPin: typeof ride.verificationPin === 'string' ? ride.verificationPin : '',
          });
        })
        .catch(() => setSocketError('Could not restore this ride. Retry to refresh.'))
        .finally(() => setRefreshing(false));
    }
    setupSocket();

    return () => {
      unsubUpdate?.();
      unsubLocation?.();
      unsubscribeFromRide(id);
    };
  }, [id]);

  const setReviewStatus = (status: RideStatus) => {
    if (!reviewMode || !activeRide) return;
    setActiveRide({
      ...activeRide,
      status,
      driver: status === 'searching' ? undefined : {
        name: 'Kwame Boateng',
        vehicle: 'Green tricycle',
        plateNumber: 'WR 0001-26',
        rating: 4.8,
      },
    });
    setRideStatus(status);
  };

  const handleCancel = async (reason: PassengerCancellationReason) => {
    if (reviewMode) {
      Alert.alert('UI review mode', 'Server actions are unavailable in UI review mode.');
      return;
    }
    setCancelling(true);
    try {
      await patch(`/rides/${id}/cancel`, { reason: cancellationReasonLabel(reason) });
      setRideStatus('cancelled');
      setShowCancellationReasons(false);
      setSelectedCancellationReason(null);
      Alert.alert('Cancelled', 'Your ride has been cancelled');
      resetRide();
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to cancel ride');
    } finally {
      setCancelling(false);
    }
  };

  const openCancellationReasons = () => {
    if (!cancelling) setShowCancellationReasons(true);
  };

  const handleRate = async () => {
    if (rating === 0) return;
    if (reviewMode) {
      Alert.alert('UI review mode', 'Server actions are unavailable in UI review mode.');
      return;
    }
    try {
      await post(`/rides/${id}/rate`, { rating });
      Alert.alert('Thank you!', 'Your rating has been submitted');
      resetRide();
      router.replace('/(main)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit rating');
    }
  };

  const handleGoHome = () => {
    resetRide();
    router.replace('/(main)/home');
  };

  const handleShareTracking = async () => {
    if (reviewMode) {
      Alert.alert('UI review mode', 'Live sharing requires a real active ride.');
      return;
    }
    setSharing(true);
    try {
      const link = await post<PublicTrackingLink>(`/rides/${id}/tracking-link`);
      const trackingBaseUrl = mobileRuntimeUrl(
        'EXPO_PUBLIC_TRACKING_URL',
        process.env.EXPO_PUBLIC_TRACKING_URL,
        'http://localhost:3002',
      );
      await Share.share({
        message: `Track my KansRide trip: ${trackingBaseUrl}${link.trackingPath}`,
        url: `${trackingBaseUrl}${link.trackingPath}`,
      });
    } catch (error: unknown) {
      Alert.alert(
        'Unable to share',
        error instanceof Error ? error.message : 'Failed to create tracking link',
      );
    } finally {
      setSharing(false);
    }
  };

  // Rating screen
  if (showRating || rideStatus === 'completed') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.stateContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>Rate your ride</Text>
          <Text style={styles.ratingSubtitle}>How was your experience?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={[styles.star, star <= rating && styles.starActive]}>
                  {star <= rating ? '\u2605' : '\u2606'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.button} onPress={handleRate}>
            <Text style={styles.buttonText}>Submit Rating</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={handleGoHome}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Cancelled state
  if (rideStatus === 'cancelled') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.stateContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>{'\u274C'}</Text>
          <Text style={styles.statusTitle}>Ride Cancelled</Text>
          <TouchableOpacity style={styles.button} onPress={handleGoHome}>
            <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]} showsVerticalScrollIndicator={false}>
      {reviewMode && (
        <View style={styles.previewPanel}>
          <Text style={styles.previewLabel}>UI REVIEW · RIDE STATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewStates}>
            {(['searching', 'driver_assigned', 'en_route', 'arrived', 'in_progress'] as RideStatus[]).map((status) => (
              <TouchableOpacity key={status} style={[styles.previewChip, rideStatus === status && styles.previewChipActive]} onPress={() => setReviewStatus(status)}>
                <Text style={[styles.previewChipText, rideStatus === status && styles.previewChipTextActive]}>{status.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {activeRide && (
        <View style={styles.mapCard}>
          <MapView style={styles.map} initialRegion={{ latitude: activeRide.pickupLatitude, longitude: activeRide.pickupLongitude, latitudeDelta: 0.035, longitudeDelta: 0.035 }} scrollEnabled={false} zoomEnabled={false}>
            <Marker coordinate={{ latitude: activeRide.pickupLatitude, longitude: activeRide.pickupLongitude }} pinColor={colors.pickupPin} title="Pickup" />
            <Marker coordinate={{ latitude: activeRide.dropoffLatitude, longitude: activeRide.dropoffLongitude }} pinColor={colors.dropoffPin} title="Destination" />
            {driverLocation && <Marker coordinate={driverLocation}><View style={styles.driverMarker}><MaterialCommunityIcons name="rickshaw" size={20} color={colors.textInverse} /></View></Marker>}
          </MapView>
          <View style={styles.mapStatus}><StatusBadge label={STATUS_LABELS[rideStatus]} tone={rideStatus === 'searching' ? 'warning' : rideStatus === 'in_progress' ? 'info' : 'primary'} dot /></View>
        </View>
      )}
      {refreshing && <ActivityIndicator color={colors.primary} />}
      {socketError && (
        <FeedbackBanner tone="error" title="Live updates unavailable" message={socketError} action={<TouchableOpacity onPress={() => router.replace({ pathname: '/(main)/ride/[id]', params: { id } })}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>} />
      )}
      {/* Status */}
      <View style={styles.statusCard}>
        {rideStatus === 'searching' && <View style={styles.searchingIcon}><ActivityIndicator size="large" color={colors.primary} /></View>}
        {rideStatus === 'driver_assigned' && <View style={styles.statusIcon}><Ionicons name="checkmark" size={26} color={colors.textInverse} /></View>}
        {rideStatus === 'en_route' && <View style={styles.statusIcon}><MaterialCommunityIcons name="rickshaw" size={28} color={colors.textInverse} /></View>}
        {rideStatus === 'arrived' && <View style={styles.statusIcon}><Ionicons name="location" size={27} color={colors.textInverse} /></View>}
        {rideStatus === 'in_progress' && <View style={styles.statusIcon}><Ionicons name="navigate" size={27} color={colors.textInverse} /></View>}
        <Text style={styles.statusTitle}>{STATUS_LABELS[rideStatus]}</Text>
        <Text style={styles.statusSubtitle}>{rideStatus === 'searching' ? 'We’re matching you with a nearby driver.' : rideStatus === 'arrived' ? 'Meet your driver at the pickup point.' : rideStatus === 'in_progress' ? 'Enjoy your trip. We’ll keep you updated.' : 'Your trip is progressing as expected.'}</Text>
      </View>

      {/* Driver info */}
      {activeRide?.driver && (
        <View style={styles.driverCard}>
          <View style={styles.driverActions}><View style={styles.driverAvatar}><Text style={styles.driverAvatarText}>{activeRide.driver.name.charAt(0)}</Text></View><View style={styles.driverIdentity}><Text style={styles.driverName}>{activeRide.driver.name}</Text><Text style={styles.driverDetail}>{activeRide.driver.vehicle} · {activeRide.driver.plateNumber}</Text><Text style={styles.driverRating}><Ionicons name="star" size={13} color={colors.secondaryDark} /> {activeRide.driver.rating.toFixed(1)} driver rating</Text></View></View>
        </View>
      )}

      {/* Trip info */}
      <View style={styles.tripCard}>
        <View style={styles.tripRow}>
          <Text style={styles.tripDot}>{'\uD83D\uDFE2'}</Text>
          <Text style={styles.tripText}>{activeRide?.pickupAddress || 'Pickup location'}</Text>
        </View>
        <View style={styles.tripDivider} />
        <View style={styles.tripRow}>
          <Text style={styles.tripDot}>{'\uD83D\uDD34'}</Text>
          <Text style={styles.tripText}>{activeRide?.dropoffAddress || 'Dropoff location'}</Text>
        </View>
        {activeRide && (
          <View style={styles.fareRow}><Text style={styles.fareLabel}>Estimated fare</Text><Text style={styles.fareText}>{formatGhsFromPesewas(activeRide.estimatedFarePesewas)}</Text></View>
        )}
      </View>

      {(rideStatus === 'arrived' || rideStatus === 'driver_assigned' || rideStatus === 'en_route') &&
        activeRide?.verificationPin && (
          <View style={styles.pinCard}>
            <Text style={styles.pinLabel}>Trip verification PIN</Text>
            <Text style={styles.pinValue}>{activeRide.verificationPin}</Text>
            <Text style={styles.pinHint}>Tell this PIN only to your assigned driver at pickup.</Text>
          </View>
        )}

      <TouchableOpacity
        style={[styles.shareButton, sharing && styles.buttonDisabled]}
        onPress={handleShareTracking}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.shareText}>Share live tracking</Text>
        )}
      </TouchableOpacity>

      {/* Cancel button - only show when ride is not in progress */}
      {(rideStatus === 'searching' || rideStatus === 'driver_assigned' || rideStatus === 'en_route') && (
        <TouchableOpacity
          style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
          onPress={openCancellationReasons}
          disabled={cancelling}
        >
          {cancelling ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.cancelText}>Cancel Ride</Text>
          )}
        </TouchableOpacity>
      )}

      <Modal
        visible={showCancellationReasons}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancellationReasons(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.cancellationCard, { paddingBottom: insets.compactBottom }]}>
            <Text style={styles.ratingTitle}>Why are you cancelling?</Text>
            {PASSENGER_CANCELLATION_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={[styles.reasonOption, selectedCancellationReason === reason.value && styles.reasonOptionSelected]}
                onPress={() => setSelectedCancellationReason(reason.value)}
                disabled={cancelling}
              >
                <Text style={styles.reasonText}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.button, (!selectedCancellationReason || cancelling) && styles.buttonDisabled]}
              onPress={() => selectedCancellationReason && void handleCancel(selectedCancellationReason)}
              disabled={!selectedCancellationReason || cancelling}
            >
              {cancelling ? <ActivityIndicator color={colors.disabledText} /> : <Text style={[styles.buttonText, !selectedCancellationReason && styles.buttonTextDisabled]}>Confirm cancellation</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={() => setShowCancellationReasons(false)} disabled={cancelling}>
              <Text style={styles.skipText}>Keep ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  stateContainer: { flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  previewPanel: { backgroundColor: colors.warningSoft, borderRadius: borderRadius.xl, padding: 12, marginBottom: 12 },
  previewLabel: { ...typography.label, color: colors.warning, marginBottom: 8 },
  previewStates: { gap: 8 },
  previewChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  previewChipActive: { backgroundColor: colors.primary },
  previewChipText: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  previewChipTextActive: { color: colors.textInverse, fontWeight: '700' },
  mapCard: { height: 220, borderRadius: borderRadius.xxl, overflow: 'hidden', marginBottom: 14, backgroundColor: colors.surfaceInset, ...shadows.md },
  map: { flex: 1 },
  mapStatus: { position: 'absolute', top: 12, left: 12 },
  driverMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface, ...shadows.sm },
  statusCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  searchingIcon: { width: 58, height: 58, borderRadius: borderRadius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  statusIcon: { width: 58, height: 58, borderRadius: borderRadius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  statusEmoji: { fontSize: 40, marginBottom: 8 },
  statusTitle: { ...typography.h3, color: colors.textPrimary, marginTop: 10 },
  statusSubtitle: { ...typography.small, color: colors.textSecondary, marginTop: 3, textAlign: 'center' },
  driverCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  driverActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 52, height: 52, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { ...typography.h3, color: colors.primary },
  driverIdentity: { flex: 1 },
  driverName: { ...typography.h3, color: colors.textPrimary },
  driverDetail: { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  driverRating: { ...typography.caption, color: colors.secondaryDark, marginTop: 4 },
  tripCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripDot: { fontSize: 14 },
  tripText: { ...typography.small, color: colors.textPrimary, flex: 1, fontWeight: '600' },
  tripDivider: { width: 2, height: 20, backgroundColor: colors.borderStrong, marginLeft: 7, marginVertical: 4 },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  fareLabel: { ...typography.small, color: colors.textSecondary },
  fareText: { ...typography.h3, color: colors.primary },
  pinCard: { backgroundColor: colors.warningSoft, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.warningBorder },
  pinLabel: { ...typography.label, color: colors.warning },
  pinValue: { fontSize: 30, lineHeight: 38, color: colors.textPrimary, fontWeight: '800', letterSpacing: 8, marginTop: 2 },
  pinHint: { ...typography.caption, color: colors.warning, textAlign: 'center', marginTop: 2 },
  cancelButton: { borderRadius: borderRadius.xl, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorSoft },
  shareButton: { borderRadius: borderRadius.xl, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, marginBottom: 10 },
  shareText: { ...typography.bodyBold, color: colors.primary },
  cancelText: { ...typography.bodyBold, color: colors.error },
  buttonDisabled: { backgroundColor: colors.disabledSurface, borderColor: colors.disabledBorder },
  button: { backgroundColor: colors.primary, borderRadius: borderRadius.xl, height: 52, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 16 },
  buttonText: { ...typography.button, color: colors.textInverse },
  buttonTextDisabled: { color: colors.disabledText },
  ratingCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xxl, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, ...shadows.md },
  ratingTitle: { ...typography.h2, color: colors.textPrimary },
  ratingSubtitle: { ...typography.small, color: colors.textSecondary, marginTop: 6, marginBottom: spacing.lg },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  star: { fontSize: 38, color: colors.borderStrong },
  starActive: { color: colors.secondary },
  skipBtn: { marginTop: 12 }, skipText: { ...typography.small, color: colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  cancellationCard: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.lg, gap: 10 },
  reasonOption: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, padding: 14, backgroundColor: colors.surfaceRaised },
  reasonOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  reasonText: { ...typography.small, color: colors.textPrimary },
  retryText: { ...typography.label, color: colors.primary, padding: spacing.sm },
});
