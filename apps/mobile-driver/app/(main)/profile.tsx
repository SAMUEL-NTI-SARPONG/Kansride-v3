import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDriverStore } from '../../src/stores/driver-store';
import { api } from '../../src/api/client';
import { clearTokens } from '../../src/api/client';
import * as socketClient from '../../src/api/socket';
import { stopLocationWatch } from '../../src/services/location';

interface UserProfile {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

interface DriverProfile {
  isDriver: boolean;
  driverId?: string;
  rating?: string;
  completedRides?: number;
  vehicle?: {
    registrationNumber?: string;
    colour?: string;
    type?: string;
  } | null;
}

export default function DriverProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const driverReset = useDriverStore((s) => s.reset);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const [user, driver] = await Promise.all([
        api.get<UserProfile>('/users/me'),
        api.get<DriverProfile>('/drivers/me'),
      ]);
      setUserProfile(user);
      setDriverProfile(driver);
    } catch {
      const reviewUser = useAuthStore.getState().user;
      if (reviewUser?.id === 'ui-review-driver') {
        setUserProfile({
          id: reviewUser.id,
          phoneNumber: reviewUser.phoneNumber,
          role: reviewUser.role,
          firstName: reviewUser.firstName ?? undefined,
          lastName: reviewUser.lastName ?? undefined,
        });
        setDriverProfile({
          isDriver: true,
          driverId: reviewUser.id,
          rating: '4.8',
          completedRides: 86,
          vehicle: {
            registrationNumber: 'WR 0000-26',
            colour: 'Green',
            type: 'Tricycle',
          },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    socketClient.disconnect(); // also stops location emission
    stopLocationWatch();
    driverReset();
    await logout();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1B8B4B" />
      </View>
    );
  }

  const displayName = userProfile?.firstName
    ? `${userProfile.firstName} ${userProfile.lastName || ''}`
    : 'Driver';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Profile</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.phone}>{userProfile?.phoneNumber || '+233 XX XXX XXXX'}</Text>
        {driverProfile?.rating && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Rating:</Text>
            <Text style={styles.rating}>{driverProfile.rating}</Text>
          </View>
        )}
        {driverProfile?.completedRides !== undefined && (
          <Text style={styles.rides}>
            {driverProfile.completedRides} completed rides
          </Text>
        )}
      </View>

      {driverProfile?.vehicle && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Info</Text>
          <Text style={styles.cardDetail}>
            Type: {driverProfile.vehicle.type || 'Tricycle'}
          </Text>
          <Text style={styles.cardDetail}>
            Plate: {driverProfile.vehicle.registrationNumber || 'N/A'}
          </Text>
          <Text style={styles.cardDetail}>
            Colour: {driverProfile.vehicle.colour || 'N/A'}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Documents</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Support</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.menuItem, styles.logoutBtn]} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 24 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 8 },
  cardDetail: { fontSize: 14, color: '#64748B', marginBottom: 4 },
  name: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  phone: { fontSize: 14, color: '#64748B', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  ratingLabel: { fontSize: 14, color: '#64748B', marginRight: 8 },
  rating: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  rides: { fontSize: 14, color: '#64748B', marginTop: 8 },
  menuItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuText: { fontSize: 16, color: '#1A1A2E' },
  logoutBtn: { marginTop: 16, borderColor: '#EF4444' },
  logoutText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
});
