import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/stores/auth-store';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleLogout = () => {
    setAuthenticated(false);
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.name}>Passenger User</Text>
        <Text style={styles.phone}>+233 24 XXX XXXX</Text>
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
      <View style={[styles.menuItem, styles.logoutBtn]}>
        <Text style={styles.logoutText} onPress={handleLogout}>
          Log Out
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60 },
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
