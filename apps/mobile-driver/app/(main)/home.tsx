import { View, Text, TextInput, StyleSheet, Switch, TouchableOpacity, Alert, Modal, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import * as socketClient from '../../src/api/socket';
import type { RideUpdateData } from '../../src/api/socket';
import { useDriverStore } from '../../src/stores/driver-store';
import type { RideStatus } from '../../src/stores/driver-store';
import { useLocationStore } from '../../src/stores/location-store';
import { RideOffer } from '../../src/api/socket';
import {
  ensureForegroundPermission,
  getLocationServicesState,
  acquireCurrentPosition,
  startLocationWatch,
  stopLocationWatch,
} from '../../src/services/location';
import type { LocationOutcome } from '../../src/services/location';
import { navigationRegion, navigationTargetForStatus, navigationUrl } from '../../src/navigation';

// Honest, user-facing labels for typed location outcomes — no fabricated
// coordinates, no silent failure. Each non-granted outcome maps to a title +
// message the Alert can surface, plus a hint about whether retry can help.
function describeLocationFailure(outcome: LocationOutcome): { title: string; message: string } {
  switch (outcome.kind) {
    case 'denied':
      return {
        title: 'Location permission denied',
        message: outcome.canAskAgain
          ? 'KansRide needs your location to receive ride requests. Please grant location permission and try again.'
          : 'Location permission is blocked. Open Settings, enable location for KansRide, then try again.',
      };
    case 'services-disabled':
      return {
        title: 'Location services off',
        message: 'Turn on device location (GPS) to go online and receive ride requests.',
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
    subscriptionActive, offerExpiresAt, updateRideStatus, isApproved, setApproved,
  } = useDriverStore();
  const getLocation = useLocationStore((s) => s.getLocation);
  const setLocation = useLocationStore((s) => s.setLocation);
  const [toggling, setToggling] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [verificationPin, setVerificationPin] = useState('');
  const [verifyingPassenger, setVerifyingPassenger] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize driver profile on mount
  useEffect(() => {
    void loadDriverProfile();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      socketClient.stopLocationEmission();
      stopLocationWatch();
      socketClient.disconnect();
    };
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
        isActive?: boolean;
      }>('/drivers/me');

      if (profile.isDriver && profile.driverId) {
        setDriverId(profile.driverId);
        setApproved(profile.isActive === true);
        setSubscription(profile.subscriptionActive || false, profile.subscriptionExpiresAt);
          if (profile.isOnline) {
          setOnline(true);
          try {
            await setupSocket();
          } catch (error: any) {
            // We were online server-side but cannot reach the socket now. Stay
            // online (server state unchanged) and surface an honest banner so
            // the driver knows ride offers may not arrive until reconnect.
            setLocationError(
              `Connection failed: ${error?.message || 'Failed to connect to the server'}`,
            );
          }
          // Restore the watcher only if the device can provide a real fix.
          // An online server session without a working watcher cannot receive
          // reliable offers, so roll it back instead of hiding stale state.
          const watchOutcome = await restartLocationEmission();
          if (watchOutcome.kind !== 'granted') {
            const { title, message } = describeLocationFailure(watchOutcome);
            await rollbackGoOnline(title, message);
          }
        }
      }
    } catch {
      // Driver profile not found — that's OK for new drivers
    } finally {
      setProfileLoading(false);
    }
  };

  const setupSocket = async () => {
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

        socketClient.subscribeToRide(offer.rideId);
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

      const existingRide = useDriverStore.getState().activeRide;
      if (existingRide) {
        socketClient.subscribeToRide(existingRide.rideId);
      }
      socketClient.requestPendingOffers();
  };

  // Starts the foreground watcher (feeding the location store on each fix)
  // and (re)arms the 10s socket emission loop. Used both for a fresh
  // go-online and for restoring an online session after app restart. No
  // fabricated coordinates: if the watch cannot start, an honest outcome is
  // returned and the caller decides whether to roll back.
  const restartLocationEmission = async (): Promise<LocationOutcome> => {
    const watchOutcome = await startLocationWatch((coords) => {
      setLocation(coords.latitude, coords.longitude);
    });
    if (watchOutcome.kind === 'granted') {
      socketClient.startLocationEmission(getLocation);
    }
    return watchOutcome;
  };

  // Centralised rollback for a failed go-online attempt. Keeps the backend and
  // the client in sync: calls go-offline (best-effort), clears the optimistic
  // online flag, tears down emission + watcher + socket, and surfaces an honest
  // retryable error. Never throws.
  const rollbackGoOnline = async (title: string, message: string) => {
    try {
      await api.post('/drivers/go-offline');
    } catch {
      // Backend may already consider us offline if go-online never landed; a
      // failed rollback here is not retried — the server-side online state is
      // corrected on the next successful go-online / go-offline.
    }
    stopLocationWatch();
    socketClient.stopLocationEmission();
    socketClient.disconnect();
    setOnline(false);
    setLocationError(`${title}: ${message}`);
    Alert.alert(title, message);
  };

  const handleToggleOnline = async (value: boolean) => {
    if (toggling) return;
    setToggling(true);
    setLocationError(null);

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

        // Acquire real device coordinates — no fabricated fallback. Permission
        // and services are checked before a position attempt so the user sees
        // the least surprising reason for failure.
        const permission = await ensureForegroundPermission();
        if (permission.kind !== 'granted') {
          const { title, message } = describeLocationFailure(permission);
          Alert.alert(title, message);
          return;
        }
        const services = await getLocationServicesState();
        if (services.kind !== 'granted') {
          const { title, message } = describeLocationFailure(services);
          Alert.alert(title, message);
          return;
        }
        const position = await acquireCurrentPosition();
        if (position.kind !== 'position') {
          const { title, message } = describeLocationFailure(position);
          Alert.alert(title, message);
          return;
        }
        setLocation(position.coords.latitude, position.coords.longitude);

        // Tell the backend we are online with the real coordinates. If this
        // fails we never set the optimistic flag — nothing to roll back.
        try {
          await api.post('/drivers/go-online', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } catch (error: any) {
          Alert.alert('Could not go online', error.message || 'Server rejected go-online request');
          return;
        }

        setOnline(true);

        // Connect the socket. On failure we must roll back the online state we
        // just declared so the backend and client agree we are offline.
        try {
          await setupSocket();
        } catch (error: any) {
          await rollbackGoOnline(
            'Connection failed',
            error.message || 'Failed to connect to the server. You are now offline — try again.',
          );
          return;
        }

        // Start the foreground watcher + emission loop. If the watcher cannot
        // start we roll back too: an online driver with no live location is
        // useless and the dispatch matcher would never receive our coords.
        const watchOutcome = await restartLocationEmission();
        if (watchOutcome.kind !== 'granted') {
          const { title, message } = describeLocationFailure(watchOutcome);
          await rollbackGoOnline(title, message);
          return;
        }
      } else {
        // Going offline: tell the backend, then tear everything down in the
        // opposite order we started it (emission → watcher → socket).
        try {
          await api.post('/drivers/go-offline');
        } catch (error: any) {
          // Even if go-offline fails, we clear the client-side state so the UI
          // is honest; the socket disconnect will stop emission regardless.
          Alert.alert('Going offline', error.message || 'Server may still show you online briefly.');
        }
        socketClient.stopLocationEmission();
        stopLocationWatch();
        socketClient.disconnect();
        setOnline(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to toggle online status');
    } finally {
      setToggling(false);
    }
  };

  const openNavigation = async () => {
    if (!activeRide) return;
    const target = navigationTargetForStatus(activeRide.status);
    const point = target === 'pickup'
      ? { latitude: activeRide.pickupLatitude, longitude: activeRide.pickupLongitude }
      : { latitude: activeRide.dropoffLatitude, longitude: activeRide.dropoffLongitude };
    const url = navigationUrl(point.latitude, point.longitude);
    if (!url) {
      Alert.alert('Navigation unavailable', 'The current ride coordinates are unavailable.');
      return;
    }
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Navigation unavailable', 'No supported navigation app could open this route.');
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

  const handleVerifyPassenger = async () => {
    if (!activeRide || !/^\d{4}$/.test(verificationPin)) {
      Alert.alert('Invalid PIN', 'Enter the passenger\'s 4-digit verification PIN.');
      return;
    }
    setVerifyingPassenger(true);
    try {
      await api.post(`/rides/${activeRide.rideId}/verify-passenger`, {
        verificationPin,
      });
      setVerificationPin('');
      updateRideStatus('passenger_verified');
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Could not verify passenger');
    } finally {
      setVerifyingPassenger(false);
    }
  };

  const getStatusButtonLabel = (): string => {
    if (!activeRide) return '';
    switch (activeRide.status) {
      case 'driver_assigned': return 'Start Pickup';
      case 'driver_en_route': return "I've Arrived";
      case 'driver_arrived': return 'Wait for Passenger';
      case 'passenger_verified': return 'Start Ride';
      case 'in_progress': return 'Complete Ride';
      default: return '';
    }
  };

  // Active ride view
  if (activeRide) {
    return (
      <View style={styles.container}>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={navigationRegion([
              ...(getLocation() ? [getLocation()!] : []),
              { latitude: activeRide.pickupLatitude, longitude: activeRide.pickupLongitude },
              { latitude: activeRide.dropoffLatitude, longitude: activeRide.dropoffLongitude },
            ]) || undefined}
            showsUserLocation={Boolean(getLocation())}
          >
            {getLocation() && <Marker coordinate={getLocation()!} title="Current location" pinColor="#1B8B4B" />}
            <Marker coordinate={{ latitude: activeRide.pickupLatitude, longitude: activeRide.pickupLongitude }} title="Pickup" pinColor="#F59E0B" />
            <Marker coordinate={{ latitude: activeRide.dropoffLatitude, longitude: activeRide.dropoffLongitude }} title="Destination" pinColor="#EF4444" />
          </MapView>
          <Text style={styles.mapOverlay}>{navigationTargetForStatus(activeRide.status) === 'pickup' ? 'Navigate to pickup' : 'Navigate to destination'}</Text>
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
          {activeRide.status === 'waiting_for_passenger' && (
            <View style={styles.verificationCard}>
              <Text style={styles.rideLabel}>Passenger verification PIN</Text>
              <TextInput
                style={styles.pinInput}
                value={verificationPin}
                onChangeText={(value) => setVerificationPin(value.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="4 digits"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={[styles.advanceButton, verifyingPassenger && styles.buttonDisabled]}
                onPress={handleVerifyPassenger}
                disabled={verifyingPassenger}
              >
                {verifyingPassenger ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.advanceButtonText}>Verify Passenger</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.navigationButton} onPress={openNavigation} accessibilityRole="button" accessibilityLabel="Open external navigation">
            <Text style={styles.navigationButtonText}>Open navigation</Text>
          </TouchableOpacity>
          {getStatusButtonLabel() && (
            <TouchableOpacity style={styles.advanceButton} onPress={handleAdvanceStatus}>
              <Text style={styles.advanceButtonText}>{getStatusButtonLabel()}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (profileLoading) {
    return (
      <View style={[styles.container, styles.pendingContainer]}>
        <ActivityIndicator size="large" color="#1B8B4B" />
      </View>
    );
  }

  if (!isApproved) {
    return (
      <View style={[styles.container, styles.pendingContainer]}>
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>Application under review</Text>
          <Text style={styles.pendingText}>
            KansRide must approve your driver and vehicle records before you can
            subscribe, go online, or receive ride offers.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView style={styles.map} showsUserLocation={Boolean(getLocation())} region={getLocation() ? { ...getLocation()!, latitudeDelta: 0.04, longitudeDelta: 0.04 } : undefined} />
        {!getLocation() && <Text style={styles.mapOverlay}>Real GPS location unavailable</Text>}
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
        {locationError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{locationError}</Text>
            <TouchableOpacity
              onPress={() => setLocationError(null)}
              accessibilityLabel="Dismiss error"
              accessibilityRole="button"
            >
              <Text style={styles.errorDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {isOnline && !locationError && (
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
  pendingContainer: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  pendingCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24 },
  pendingTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  pendingText: { fontSize: 14, color: '#64748B', lineHeight: 21, marginTop: 8 },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapOverlay: { position: 'absolute', top: 20, alignSelf: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#1B8B4B', fontWeight: '700' },
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
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  errorText: { fontSize: 13, color: '#B91C1C', lineHeight: 18 },
  errorDismiss: { fontSize: 12, color: '#B91C1C', fontWeight: '600', marginTop: 4 },
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
  verificationCard: { gap: 8, marginTop: 4 },
  pinInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    color: '#1A1A2E',
  },
  advanceButton: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  advanceButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  navigationButton: { borderWidth: 1, borderColor: '#1B8B4B', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  navigationButtonText: { color: '#1B8B4B', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },

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
