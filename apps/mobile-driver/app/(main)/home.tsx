import { View, Text, TextInput, StyleSheet, Switch, TouchableOpacity, Alert, Modal, ActivityIndicator, Linking, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, FeedbackBanner, StatusBadge, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { useDriverInsets } from '../../src/ui/use-driver-insets';

const reviewMode = developmentReviewModeEnabled(process.env.NODE_ENV, process.env.EXPO_PUBLIC_UI_REVIEW_MODE);

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
  const insets = useDriverInsets();
  const {
    isOnline, setOnline, currentOffer, setCurrentOffer,
    activeRide, setActiveRide, setSubscription, setDriverId,
    offerExpiresAt, updateRideStatus, isApproved, setApproved,
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
    if (reviewMode) {
      setDriverId('ui-review-driver');
      setApproved(true);
      setSubscription(true, '2026-08-20T23:59:00.000Z');
      setLocation(4.9016, -1.7831);
      setProfileLoading(false);
      return;
    }
    void loadDriverProfile();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      socketClient.stopLocationEmission();
      stopLocationWatch();
      socketClient.disconnect();
    };
  }, []);

  const setReviewState = (state: 'offline' | 'online' | 'offer' | RideStatus) => {
    if (!reviewMode) return;
    setProfileLoading(false); setApproved(true); setSubscription(true, '2026-08-20T23:59:00.000Z');
    setCurrentOffer(null); setActiveRide(null); setOnline(state !== 'offline');
    if (state === 'offer') {
      setCurrentOffer({ rideId: 'driver-review-offer', rideType: 'standard_tricycle', pickupAddress: 'Market Circle', pickupLandmark: null, pickupLatitude: 4.89, pickupLongitude: -1.75, dropoffAddress: 'Airport Roundabout', dropoffLandmark: null, dropoffLatitude: 4.905, dropoffLongitude: -1.765, estimatedFarePesewas: 2450, estimatedDistanceMeters: 6400, estimatedDurationSeconds: 780, distanceToPickupMeters: 1200, offeredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString() });
    } else if (!['offline', 'online'].includes(state)) {
      setActiveRide({ rideId: 'driver-review-ride', status: state as RideStatus, pickupAddress: 'Market Circle', dropoffAddress: 'Airport Roundabout', pickupLatitude: 4.89, pickupLongitude: -1.75, dropoffLatitude: 4.905, dropoffLongitude: -1.765, estimatedFarePesewas: 2450, passengerName: 'Ama Owusu', passengerPhone: '+233 24 555 0101' });
    }
  };

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
    if (reviewMode) { setOnline(value); return; }
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
    if (reviewMode) { Alert.alert('UI review mode', 'External navigation is unavailable in UI review mode.'); return; }
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
    if (reviewMode) {
      setActiveRide({ rideId: currentOffer.rideId, status: 'driver_assigned', pickupAddress: currentOffer.pickupAddress || 'Pickup location', dropoffAddress: currentOffer.dropoffAddress || 'Dropoff location', pickupLatitude: currentOffer.pickupLatitude, pickupLongitude: currentOffer.pickupLongitude, dropoffLatitude: currentOffer.dropoffLatitude, dropoffLongitude: currentOffer.dropoffLongitude, estimatedFarePesewas: currentOffer.estimatedFarePesewas, passengerName: 'Ama Owusu', passengerPhone: '+233 24 555 0101' });
      return;
    }
    socketClient.acceptRide(currentOffer.rideId);
  }, [currentOffer]);

  const handleDeclineOffer = useCallback(() => {
    if (currentOffer && !reviewMode) {
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

    if (reviewMode) {
      if (nextStatus === 'completed') { setActiveRide(null); setOnline(true); }
      else updateRideStatus(nextStatus as RideStatus);
      return;
    }

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
    if (reviewMode) { setVerificationPin(''); updateRideStatus('passenger_verified'); return; }
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

  const reviewControls = reviewMode ? (
    <View style={[styles.reviewPanel, { paddingTop: insets.top }]}>
      <Text style={styles.reviewLabel}>UI REVIEW · DRIVER STATE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewStates}>
        {([
          ['offline', 'Offline'], ['online', 'Online'], ['offer', 'Offer'],
          ['driver_assigned', 'Assigned'], ['driver_arrived', 'Arrived'],
          ['waiting_for_passenger', 'Verify'], ['in_progress', 'In ride'],
        ] as Array<['offline' | 'online' | 'offer' | RideStatus, string]>).map(([state, label]) => (
          <TouchableOpacity key={state} style={styles.reviewChip} onPress={() => setReviewState(state)}><Text style={styles.reviewChipText}>{label}</Text></TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  ) : null;

  // Active ride view
  if (activeRide) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {reviewControls}
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
            {getLocation() && <Marker coordinate={getLocation()!} title="Current location" pinColor={colors.primary} />}
            <Marker coordinate={{ latitude: activeRide.pickupLatitude, longitude: activeRide.pickupLongitude }} title="Pickup" pinColor={colors.pickupPin} />
            <Marker coordinate={{ latitude: activeRide.dropoffLatitude, longitude: activeRide.dropoffLongitude }} title="Destination" pinColor={colors.dropoffPin} />
          </MapView>
          <View style={styles.mapOverlay}><Ionicons name="navigate" size={16} color={colors.primary} /><Text style={styles.mapOverlayText}>{navigationTargetForStatus(activeRide.status) === 'pickup' ? 'Navigate to pickup' : 'Navigate to destination'}</Text></View>
        </View>
        <ScrollView style={styles.activeRideCard} contentContainerStyle={[styles.activeRideContent, { paddingBottom: insets.compactBottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.activeHeader}><View><Text style={styles.activeEyebrow}>CURRENT JOB</Text><Text style={styles.activeTitle}>{activeRide.status === 'in_progress' ? 'Passenger on board' : 'Pickup in progress'}</Text></View><StatusBadge label={activeRide.status.replace(/_/g, ' ')} tone={activeRide.status === 'in_progress' ? 'info' : 'primary'} dot /></View>
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
              <Text style={styles.rideLabel}>PASSENGER VERIFICATION PIN</Text>
              <TextInput
                style={styles.pinInput}
                value={verificationPin}
                onChangeText={(value) => setVerificationPin(value.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="4 digits"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={[styles.advanceButton, verifyingPassenger && styles.buttonDisabled]}
                onPress={handleVerifyPassenger}
                disabled={verifyingPassenger}
              >
                {verifyingPassenger ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.advanceButtonText}>Verify Passenger</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          <Button title="Open navigation" variant="outline" onPress={() => void openNavigation()} fullWidth leading={<Ionicons name="navigate-outline" size={19} color={colors.primary} />} />
          {getStatusButtonLabel() && (
            <Button title={getStatusButtonLabel()} onPress={() => void handleAdvanceStatus()} fullWidth size="lg" trailing={<Ionicons name="arrow-forward" size={19} color={colors.textInverse} />} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (profileLoading) {
    return (
      <View style={[styles.container, styles.pendingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
      {reviewControls}
      <View style={styles.mapContainer}>
        <MapView style={styles.map} showsUserLocation={Boolean(getLocation())} region={getLocation() ? { ...getLocation()!, latitudeDelta: 0.04, longitudeDelta: 0.04 } : undefined} />
        {!getLocation() && <View style={styles.mapOverlay}><Ionicons name="location-outline" size={16} color={colors.warning} /><Text style={styles.mapOverlayText}>Real GPS location unavailable</Text></View>}
      </View>
      <View style={[styles.bottomCard, { paddingBottom: insets.compactBottom }]}>
        <View style={styles.statusRow}>
          <View>
            <View style={styles.availabilityLabel}><View style={[styles.availabilityDot, isOnline && styles.availabilityDotOnline]} /><Text style={styles.statusLabel}>{isOnline ? 'You’re online' : 'You’re offline'}</Text></View>
            <Text style={styles.statusHint}>
              {isOnline ? 'Ready for incoming ride requests' : 'Go online when you are ready to drive'}
            </Text>
          </View>
          {toggling ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ true: colors.primary, false: colors.disabledBorder }}
              thumbColor={colors.white}
            />
          )}
        </View>
        {locationError ? <FeedbackBanner tone="error" title="Driver location unavailable" message={locationError} action={<TouchableOpacity onPress={() => setLocationError(null)}><Text style={styles.errorDismiss}>Dismiss</Text></TouchableOpacity>} /> : null}
        {isOnline && !locationError && (
          <View style={styles.waitingCard}>
            <View style={styles.waitingIcon}><MaterialCommunityIcons name="radar" size={22} color={colors.primary} /></View><View><Text style={styles.waitingText}>Listening for nearby requests</Text><Text style={styles.waitingSubtext}>Stay in the service area for best results</Text></View>
          </View>
        )}
      </View>

      {/* Ride Offer Modal */}
      <Modal visible={!!currentOffer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.offerCard, { paddingBottom: insets.compactBottom }]}>
            <View style={styles.offerHeader}>
              <View><Text style={styles.offerEyebrow}>INCOMING REQUEST</Text><Text style={styles.offerTitle}>New ride nearby</Text></View>
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
                  <Button title="Decline" variant="danger" onPress={handleDeclineOffer} style={styles.declineButton} />
                  <Button title="Accept ride" onPress={handleAcceptOffer} style={styles.acceptButton} trailing={<Ionicons name="arrow-forward" size={18} color={colors.textInverse} />} />
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
  container: { flex: 1, backgroundColor: colors.backgroundDeep },
  pendingContainer: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  pendingCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xxl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.md },
  pendingTitle: { ...typography.h2, color: colors.textPrimary },
  pendingText: { ...typography.small, color: colors.textSecondary, marginTop: 8 },
  reviewPanel: { backgroundColor: colors.warningSoft, paddingHorizontal: spacing.md, paddingBottom: 10 },
  reviewLabel: { ...typography.label, color: colors.warning, marginBottom: 7 },
  reviewStates: { gap: 8, paddingRight: spacing.md },
  reviewChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  reviewChipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapOverlay: { position: 'absolute', top: 14, alignSelf: 'center', backgroundColor: colors.surfaceTranslucent, borderRadius: borderRadius.full, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7, ...shadows.sm },
  mapOverlayText: { ...typography.label, color: colors.textPrimary },
  bottomCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 14,
    ...shadows.lg,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  availabilityLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availabilityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textMuted },
  availabilityDotOnline: { backgroundColor: colors.success },
  statusLabel: { ...typography.h3, color: colors.textPrimary },
  statusHint: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  errorDismiss: { ...typography.label, color: colors.error, padding: spacing.sm },
  waitingCard: { backgroundColor: colors.primarySoft, borderRadius: borderRadius.xl, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  waitingIcon: { width: 42, height: 42, borderRadius: borderRadius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  waitingText: { ...typography.bodyBold, color: colors.primaryDark },
  waitingSubtext: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // Active Ride styles
  activeRideCard: {
    maxHeight: '58%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    ...shadows.lg,
  },
  activeRideContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 12 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  activeEyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.1 },
  activeTitle: { ...typography.h2, color: colors.textPrimary, marginTop: 1 },
  rideDetail: { gap: 2 },
  rideLabel: { ...typography.caption, color: colors.textSecondary },
  rideAddress: { ...typography.bodyBold, color: colors.textPrimary },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  fareLabel: { ...typography.small, color: colors.textSecondary },
  fareAmount: { ...typography.h2, color: colors.primary },
  passengerInfo: { ...typography.small, color: colors.textSecondary, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg, padding: 12 },
  verificationCard: { gap: 8, marginTop: 4, backgroundColor: colors.warningSoft, borderRadius: borderRadius.xl, padding: 12, borderWidth: 1, borderColor: colors.warningBorder },
  pinInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  advanceButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  advanceButtonText: { ...typography.button, color: colors.textInverse },
  buttonDisabled: { backgroundColor: colors.disabledSurface },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  offerCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: 14,
    ...shadows.lg,
  },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offerEyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.1 },
  offerTitle: { ...typography.h2, color: colors.textPrimary },
  countdownBadge: {
    backgroundColor: colors.errorSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countdownText: { ...typography.label, color: colors.error },
  offerDetail: { gap: 2 },
  offerLabel: { ...typography.caption, color: colors.textSecondary },
  offerValue: { ...typography.bodyBold, color: colors.textPrimary },
  offerRow: { flexDirection: 'row', gap: 24 },
  offerStat: { flex: 1 },
  offerStatLabel: { ...typography.caption, color: colors.textSecondary },
  offerStatValue: { ...typography.h3, color: colors.textPrimary, marginTop: 2 },
  offerButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  declineButton: { flex: 1 },
  acceptButton: { flex: 2 },
});
