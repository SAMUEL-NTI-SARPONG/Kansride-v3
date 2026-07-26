import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRideStore } from '../../../src/stores/ride-store';
import { post } from '../../../src/api/client';
import {
  subscribeToRide,
  unsubscribeFromRide,
  onRideUpdate,
  onDriverLocation,
  connectSocket,
} from '../../../src/api/socket';
import type { RideStatus } from '../../../src/stores/ride-store';

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
      } catch (err) {
        console.log('[ActiveRide] Socket setup error:', err);
      }
    };

    setupSocket();

    return () => {
      unsubUpdate?.();
      unsubLocation?.();
      unsubscribeFromRide(id);
    };
  }, [id]);

  const handleCancel = async () => {
    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await post(`/rides/${id}/cancel`);
            setRideStatus('cancelled');
            Alert.alert('Cancelled', 'Your ride has been cancelled');
            resetRide();
            router.back();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to cancel ride');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
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

      {/* Cancel button - only show when ride is not in progress */}
      {(rideStatus === 'searching' || rideStatus === 'driver_assigned' || rideStatus === 'en_route') && (
        <TouchableOpacity
          style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
          onPress={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <Text style={styles.cancelText}>Cancel Ride</Text>
          )}
        </TouchableOpacity>
      )}
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
  cancelButton: {
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
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
});
