import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { get } from '../../src/api/client';
import { disconnectSocket } from '../../src/api/socket';

interface UserProfile {
  id: string;
  phone: string;
  name?: string;
  totalRides?: number;
  createdAt?: string;
}

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await get<UserProfile>('/users/me');
        setProfile(data);
        setUser({ id: data.id, phone: data.phone, name: data.name, totalRides: data.totalRides });
      } catch (error) {
        console.log('Failed to fetch profile:', error);
        // Use cached user data if available
        if (user) {
          setProfile({ id: user.id, phone: user.phone, name: user.name });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          disconnectSocket();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#1B8B4B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{profile?.name || 'Passenger'}</Text>
        <Text style={styles.phone}>{profile?.phone || 'No phone'}</Text>
        {profile?.totalRides !== undefined && (
          <Text style={styles.rides}>{profile.totalRides} ride{profile.totalRides !== 1 ? 's' : ''} completed</Text>
        )}
      </View>
      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Payment Methods</Text>
      </View>
      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Saved Places</Text>
      </View>
      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Safety</Text>
      </View>
      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Support</Text>
      </View>
      <TouchableOpacity style={[styles.menuItem, styles.logoutBtn]} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 24 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  name: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  phone: { fontSize: 14, color: '#64748B', marginTop: 4 },
  rides: { fontSize: 13, color: '#1B8B4B', marginTop: 8, fontWeight: '500' },
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
