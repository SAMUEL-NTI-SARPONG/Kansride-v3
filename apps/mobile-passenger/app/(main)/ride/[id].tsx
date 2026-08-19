import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
} from 'react-native';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    activeRide,
    rideStatus,
    driverLocation,
    setRideStatus,
    setDriverLocation,
    updateFromSocket,
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

  const handleCancel = async (reason: PassengerCancellationReason) => {
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
      <View style={styles.container}>
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
      </View>
    );
  }

  // Cancelled state
  if (rideStatus === 'cancelled') {
    return (
      <View style={styles.container}>
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>{'\u274C'}</Text>
          <Text style={styles.statusTitle}>Ride Cancelled</Text>
          <TouchableOpacity style={styles.button} onPress={handleGoHome}>
            <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {refreshing && <ActivityIndicator color="#1B8B4B" />}
      {socketError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{socketError}</Text>
          <TouchableOpacity onPress={() => router.replace({ pathname: '/(main)/ride/[id]', params: { id } })}>
            <Text style={styles.retryText}>Retry live updates</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Status */}
      <View style={styles.statusCard}>
        {rideStatus === 'searching' && <ActivityIndicator size="large" color="#1B8B4B" />}
        {rideStatus === 'driver_assigned' && <Text style={styles.statusEmoji}>{'\u2705'}</Text>}
        {rideStatus === 'en_route' && <Text style={styles.statusEmoji}>{'\uD83D\uDE97'}</Text>}
        {rideStatus === 'arrived' && <Text style={styles.statusEmoji}>{'\uD83D\uDCCD'}</Text>}
        {rideStatus === 'in_progress' && <Text style={styles.statusEmoji}>{'\uD83D\uDEE3\uFE0F'}</Text>}
        <Text style={styles.statusTitle}>{STATUS_LABELS[rideStatus]}</Text>
      </View>

      {/* Driver info */}
      {activeRide?.driver && (
        <View style={styles.driverCard}>
          <Text style={styles.driverName}>{activeRide.driver.name}</Text>
          <Text style={styles.driverDetail}>
            {activeRide.driver.vehicle} · {activeRide.driver.plateNumber}
          </Text>
          <Text style={styles.driverDetail}>
            Rating: {activeRide.driver.rating.toFixed(1)} {'\u2605'}
          </Text>
          {driverLocation && (
            <Text style={styles.locationText}>
              Driver at: {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
            </Text>
          )}
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
          <Text style={styles.fareText}>
            Est. Fare: {formatGhsFromPesewas(activeRide.estimatedFarePesewas)}
          </Text>
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
          <ActivityIndicator color="#1B8B4B" />
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
            <ActivityIndicator color="#EF4444" />
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
          <View style={styles.cancellationCard}>
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
              {cancelling ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Confirm cancellation</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={() => setShowCancellationReasons(false)} disabled={cancelling}>
              <Text style={styles.skipText}>Keep ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60 },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusEmoji: { fontSize: 40, marginBottom: 8 },
  statusTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginTop: 8 },
  driverCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  driverName: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  driverDetail: { fontSize: 14, color: '#64748B', marginTop: 4 },
  locationText: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
  tripCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripDot: { fontSize: 16 },
  tripText: { fontSize: 15, color: '#1A1A2E', flex: 1 },
  tripDivider: {
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginLeft: 7,
    marginVertical: 4,
  },
  fareText: { fontSize: 16, fontWeight: '700', color: '#1B8B4B', marginTop: 12 },
  pinCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  pinLabel: { fontSize: 13, color: '#9A3412', fontWeight: '600' },
  pinValue: { fontSize: 30, color: '#7C2D12', fontWeight: '800', letterSpacing: 8, marginTop: 4 },
  pinHint: { fontSize: 12, color: '#9A3412', textAlign: 'center', marginTop: 4 },
  cancelButton: {
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  shareButton: {
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1B8B4B',
    marginBottom: 12,
  },
  shareText: { color: '#1B8B4B', fontSize: 16, fontWeight: '600' },
  cancelText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 16,
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  ratingCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ratingTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A2E' },
  ratingSubtitle: { fontSize: 14, color: '#64748B', marginTop: 8, marginBottom: 24 },
  starsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  star: { fontSize: 40, color: '#E2E8F0' },
  starActive: { color: '#F59E0B' },
  skipBtn: { marginTop: 12 },
  skipText: { color: '#64748B', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  cancellationCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 10 },
  reasonOption: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14 },
  reasonOptionSelected: { borderColor: '#1B8B4B', backgroundColor: '#F0FDF4' },
  reasonText: { color: '#1A1A2E', fontSize: 15 },
  errorCard: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { color: '#B91C1C', fontSize: 13, marginBottom: 6 },
  retryText: { color: '#1B8B4B', fontSize: 13, fontWeight: '600' },
});
