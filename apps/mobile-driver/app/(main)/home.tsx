import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import * as socketClient from '../../src/api/socket';
import type { RideUpdateData } from '../../src/api/socket';
import { useDriverStore } from '../../src/stores/driver-store';
import type { RideStatus } from '../../src/stores/driver-store';
import { useLocationStore } from '../../src/stores/location-store';
import { RideOffer } from '../../src/api/socket';

function formatGhsFromPesewas(pesewas: number | null | undefined): string {
  if (typeof pesewas !== 'number' || !Number.isSafeInteger(pesewas) || pesewas < 0) {
    return '--';
  }
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

export default function DriverHomeScreen() {
  const {
    isOnline, setOnline, currentOffer, setCurrentOffer,
    activeRide, setActiveRide, setSubscription, setDriverId,
    subscriptionActive, offerExpiresAt, updateRideStatus,
  } = useDriverStore();
  const getLocation = useLocationStore((s) => s.getLocation);
  const [toggling, setToggling] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize driver profile on mount
  useEffect(() => {
    loadDriverProfile();
  }, []);

  // Countdown timer for ride offer
  useEffect(() => {
    if (currentOffer && offerExpiresAt) {
      const updateCountdown = () => {
        const remaining = Math.max(
          0,
          Math.ceil((offerExpiresAt - Date.now()) / 1000),
        );
        setCountdown(remaining);
        if (remaining === 0) {
          socketClient.declineRide(currentOffer.rideId);
          setCurrentOffer(null);
        }
      };
      updateCountdown();
      countdownRef.current = setInterval(() => {
        updateCountdown();
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [currentOffer?.rideId, offerExpiresAt]);

  const loadDriverProfile = async () => {
    try {
      const profile = await api.get<{
        isDriver: boolean;
        driverId?: string;
        subscriptionActive?: boolean;
        subscriptionExpiresAt?: string;
        isOnline?: boolean;
      }>('/drivers/me');

      if (profile.isDriver && profile.driverId) {
        setDriverId(profile.driverId);
        setSubscription(profile.subscriptionActive || false, profile.subscriptionExpiresAt);
        if (profile.isOnline) {
          setOnline(true);
          await setupSocket();
        }
      }
    } catch {
      // Driver profile not found — that's OK for new drivers
    }
  };

  const setupSocket = async () => {
    try {
      await socketClient.connect();
      const socket = socketClient.getSocket();
      if (!socket) return;

      socket.off('ride:offered');
      socket.off('ride:accept-result');
      socket.off('ride:update');
      socket.off('ride:cancelled');

      socket.on('ride:offered', (data: RideOffer) => {
        setCurrentOffer(data);
      });

      socket.on('ride:accept-result', (result) => {
        const offer = useDriverStore.getState().currentOffer;
        if (!offer || offer.rideId !== result.rideId) return;
        if (!result.success) {
          setCurrentOffer(null);
          Alert.alert('Offer unavailable', result.message);
          return;
        }

        setActiveRide({
          rideId: offer.rideId,
          status: 'driver_assigned',
          pickupAddress: offer.pickupAddress || 'Pickup location',
          dropoffAddress: offer.dropoffAddress || 'Dropoff location',
          pickupLatitude: offer.pickupLatitude,
          pickupLongitude: offer.pickupLongitude,
          dropoffLatitude: offer.dropoffLatitude,
          dropoffLongitude: offer.dropoffLongitude,
          estimatedFarePesewas: offer.estimatedFarePesewas,
        });
      });

      socket.on('ride:update', (data: RideUpdateData) => {
        const currentRide = useDriverStore.getState().activeRide;
        if (!currentRide || data.rideId !== currentRide.rideId) return;

        const cancelledStatuses = [
          'cancelled_by_passenger',
          'cancelled_by_driver',
          'cancelled_by_admin',
          'passenger_no_show',
          'driver_no_show',
        ];
        if (cancelledStatuses.includes(data.status)) {
          setActiveRide(null);
          Alert.alert('Ride Cancelled', 'The ride has been cancelled');
          return;
        }

        const visibleStatuses: RideStatus[] = [
          'driver_assigned',
          'driver_en_route',
          'driver_arrived',
          'waiting_for_passenger',
          'passenger_verified',
          'in_progress',
          'completed',
        ];
        if (visibleStatuses.includes(data.status as RideStatus)) {
          updateRideStatus(data.status as RideStatus);
        }
      });

      socket.on('ride:cancelled', () => {
        setActiveRide(null);
        setCurrentOffer(null);
      });

      socketClient.requestPendingOffers();
    } catch (err: any) {
      Alert.alert('Connection Error', err.message || 'Failed to connect to server');
    }
  };

  const handleToggleOnline = async (value: boolean) => {
    if (toggling) return;
    setToggling(true);

    try {
      if (value) {
        // Check subscription first
        const profile = await api.get<{
          isDriver: boolean;
          subscriptionActive?: boolean;
          driverId?: string;
        }>('/drivers/me');

        if (!profile.subscriptionActive) {
          Alert.alert(
            'Subscription Required',
            'You need an active subscription to go online.',
            [
              { text: 'Subscribe', onPress: () => router.push('/(main)/subscription') },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }

        const location = getLocation();
        await api.post('/drivers/go-online', {
          latitude: location.latitude,
          longitude: location.longitude,
        });

        setOnline(true);
        await setupSocket();

        // Start location emission
        socketClient.startLocationEmission(getLocation);
      } else {
        await api.post('/drivers/go-offline');
        setOnline(false);
        socketClient.stopLocationEmission();
        socketClient.disconnect();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to toggle online status');
    } finally {
      setToggling(false);
    }
  };

  const handleAcceptOffer = useCallback(() => {
    if (!currentOffer) return;
    socketClient.acceptRide(currentOffer.rideId);
  }, [currentOffer]);

  const handleDeclineOffer = useCallback(() => {
    if (currentOffer) {
      socketClient.declineRide(currentOffer.rideId);
    }
    setCurrentOffer(null);
  }, [currentOffer]);

  const handleAdvanceStatus = async () => {
    if (!activeRide) return;

    const statusProgression: Record<string, string> = {
      driver_assigned: 'driver_en_route',
      driver_en_route: 'driver_arrived',
      driver_arrived: 'waiting_for_passenger',
      waiting_for_passenger: 'passenger_verified',
      passenger_verified: 'in_progress',
      in_progress: 'completed',
    };

    const nextStatus = statusProgression[activeRide.status];
    if (!nextStatus) return;

    try {
      await api.patch(`/rides/${activeRide.rideId}/status`, { status: nextStatus });
      if (nextStatus === 'completed') {
        setActiveRide(null);
        Alert.alert('Ride Complete', 'Great job! Earnings have been updated.');
      } else {
        updateRideStatus(nextStatus as any);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update ride status');
    }
  };

  const getStatusButtonLabel = (): string => {
    if (!activeRide) return '';
    switch (activeRide.status) {
      case 'driver_assigned': return 'Start Pickup';
      case 'driver_en_route': return "I've Arrived";
      case 'driver_arrived': return 'Wait for Passenger';
      case 'waiting_for_passenger': return 'Passenger Verified';
      case 'passenger_verified': return 'Start Ride';
      case 'in_progress': return 'Complete Ride';
      default: return '';
    }
  };

  // Active ride view
  if (activeRide) {
    return (
      <View style={styles.container}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>Navigation View</Text>
          <Text style={styles.mapSubtext}>
            {activeRide.status === 'driver_assigned'
              || activeRide.status === 'driver_en_route'
              || activeRide.status === 'driver_arrived'
              || activeRide.status === 'waiting_for_passenger'
              ? 'Heading to pickup'
              : 'Ride in progress'}
          </Text>
        </View>
        <View style={styles.activeRideCard}>
          <View style={styles.rideStatusBadge}>
            <Text style={styles.rideStatusText}>
              {activeRide.status.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
          <View style={styles.rideDetail}>
            <Text style={styles.rideLabel}>Pickup</Text>
            <Text style={styles.rideAddress}>{activeRide.pickupAddress || 'Pickup location'}</Text>
          </View>
          <View style={styles.rideDetail}>
            <Text style={styles.rideLabel}>Dropoff</Text>
            <Text style={styles.rideAddress}>{activeRide.dropoffAddress || 'Dropoff location'}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Fare</Text>
            <Text style={styles.fareAmount}>
              {formatGhsFromPesewas(activeRide.estimatedFarePesewas)}
            </Text>
          </View>
          {activeRide.passengerPhone && (
            <Text style={styles.passengerInfo}>
              Passenger: {activeRide.passengerName || 'N/A'} ({activeRide.passengerPhone})
            </Text>
          )}
          {getStatusButtonLabel() && (
            <TouchableOpacity style={styles.advanceButton} onPress={handleAdvanceStatus}>
              <Text style={styles.advanceButtonText}>{getStatusButtonLabel()}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Map View</Text>
        <Text style={styles.mapSubtext}>Kansawrodo - Sekondi-Takoradi</Text>
      </View>
      <View style={styles.bottomCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>
              {isOnline ? 'You are Online' : 'You are Offline'}
            </Text>
            <Text style={styles.statusHint}>
              {isOnline ? 'Waiting for ride requests...' : 'Go online to receive rides'}
            </Text>
          </View>
          {toggling ? (
            <ActivityIndicator color="#1B8B4B" />
          ) : (
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ true: '#1B8B4B', false: '#E2E8F0' }}
              thumbColor="#FFF"
            />
          )}
        </View>
        {isOnline && (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingText}>No ride requests yet</Text>
            <Text style={styles.waitingSubtext}>Stay in the service area for best results</Text>
          </View>
        )}
      </View>

      {/* Ride Offer Modal */}
      <Modal visible={!!currentOffer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.offerCard}>
            <View style={styles.offerHeader}>
              <Text style={styles.offerTitle}>New Ride Request</Text>
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownText}>{countdown}s</Text>
              </View>
            </View>
            {currentOffer && (
              <>
                <View style={styles.offerDetail}>
                  <Text style={styles.offerLabel}>Pickup</Text>
                  <Text style={styles.offerValue}>{currentOffer.pickupAddress || 'Pickup location'}</Text>
                </View>
                <View style={styles.offerDetail}>
                  <Text style={styles.offerLabel}>Dropoff</Text>
                  <Text style={styles.offerValue}>{currentOffer.dropoffAddress || 'Dropoff location'}</Text>
                </View>
                <View style={styles.offerRow}>
                  <View style={styles.offerStat}>
                    <Text style={styles.offerStatLabel}>Fare</Text>
                    <Text style={styles.offerStatValue}>
                      {formatGhsFromPesewas(currentOffer.estimatedFarePesewas)}
                    </Text>
                  </View>
                  <View style={styles.offerStat}>
                    <Text style={styles.offerStatLabel}>Distance</Text>
                    <Text style={styles.offerStatValue}>
                      {(currentOffer.distanceToPickupMeters / 1000).toFixed(1)} km
                    </Text>
                  </View>
                </View>
                <View style={styles.offerButtons}>
                  <TouchableOpacity style={styles.declineButton} onPress={handleDeclineOffer}>
                    <Text style={styles.declineText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptOffer}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  statusHint: { fontSize: 14, color: '#64748B', marginTop: 2 },
  waitingCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, alignItems: 'center' },
  waitingText: { fontSize: 16, fontWeight: '600', color: '#1B8B4B' },
  waitingSubtext: { fontSize: 12, color: '#64748B', marginTop: 4 },

  // Active Ride styles
  activeRideCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  rideStatusBadge: {
    backgroundColor: '#1B8B4B',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rideStatusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  rideDetail: { gap: 2 },
  rideLabel: { fontSize: 12, color: '#64748B' },
  rideAddress: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  fareLabel: { fontSize: 14, color: '#64748B' },
  fareAmount: { fontSize: 24, fontWeight: '700', color: '#1B8B4B' },
  passengerInfo: { fontSize: 14, color: '#64748B', marginTop: 4 },
  advanceButton: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  advanceButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  offerCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  countdownBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countdownText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  offerDetail: { gap: 2 },
  offerLabel: { fontSize: 12, color: '#64748B' },
  offerValue: { fontSize: 16, fontWeight: '500', color: '#1A1A2E' },
  offerRow: { flexDirection: 'row', gap: 24 },
  offerStat: { flex: 1 },
  offerStatLabel: { fontSize: 12, color: '#64748B' },
  offerStatValue: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginTop: 2 },
  offerButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  declineButton: {
    flex: 1,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  declineText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
  acceptButton: {
    flex: 2,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B8B4B',
  },
  acceptText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
