import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { post } from '../../src/api/client';
import {
  connectSocket,
  subscribeToRide,
} from '../../src/api/socket';
import { useRideStore } from '../../src/stores/ride-store';
import type { CreateRideResponse, RideType } from '@kansride/types';

// Demo coordinates around Kansawrodo / Takoradi
const DEFAULT_PICKUP = { latitude: 4.92, longitude: -1.76, address: 'Kansawrodo' };
const DESTINATIONS = [
  { label: 'Takoradi Market Circle', latitude: 4.89, longitude: -1.75 },
  { label: 'Sekondi Station', latitude: 4.945, longitude: -1.71 },
  { label: 'UHAS Campus', latitude: 4.91, longitude: -1.77 },
  { label: 'Airport Roundabout', latitude: 4.905, longitude: -1.765 },
  { label: 'Harbour Area', latitude: 4.885, longitude: -1.755 },
];

export default function HomeScreen() {
  const [destination, setDestination] = useState('');
  const [selectedDest, setSelectedDest] = useState<(typeof DESTINATIONS)[0] | null>(null);
  const [rideType, setRideType] = useState<RideType>('standard_tricycle');
  const [showDestinations, setShowDestinations] = useState(false);
  const [loading, setLoading] = useState(false);
  const { rideStatus, setActiveRide, setRideStatus } = useRideStore();

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

    setLoading(true);
    setRideStatus('requesting');

    try {
      const response = await post<CreateRideResponse>('/rides', {
        pickupLatitude: DEFAULT_PICKUP.latitude,
        pickupLongitude: DEFAULT_PICKUP.longitude,
        dropoffLatitude: selectedDest.latitude,
        dropoffLongitude: selectedDest.longitude,
        rideType,
      });

      setActiveRide({
        id: response.id,
        status: 'searching',
        pickupAddress: DEFAULT_PICKUP.address,
        dropoffAddress: selectedDest.label,
        pickupLatitude: DEFAULT_PICKUP.latitude,
        pickupLongitude: DEFAULT_PICKUP.longitude,
        dropoffLatitude: selectedDest.latitude,
        dropoffLongitude: selectedDest.longitude,
        rideType: response.rideType,
        estimatedFarePesewas: response.estimatedFarePesewas,
      });
      setRideStatus('searching');

      // Connect to WebSocket and subscribe to ride updates
      await connectSocket();
      subscribeToRide(response.id);

      // Navigate to active ride screen
      router.push({ pathname: '/(main)/ride/[id]', params: { id: response.id } });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to request ride');
      setRideStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Map View</Text>
        <Text style={styles.mapSubtext}>Kansawrodo · Sekondi-Takoradi</Text>
      </View>
      <View style={styles.bottomCard}>
        <Text style={styles.greeting}>Where are you going?</Text>

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
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRequestRide}
              disabled={loading}
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
});
