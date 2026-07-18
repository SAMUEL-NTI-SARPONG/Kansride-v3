import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/stores/auth-store';
import { router } from 'expo-router';

export default function DriverProfileScreen() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleLogout = () => {
    setAuthenticated(false);
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Profile</Text>
      <View style={styles.card}>
        <Text style={styles.name}>Driver Name</Text>
        <Text style={styles.phone}>+233 24 XXX XXXX</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>Rating:</Text>
          <Text style={styles.rating}>⭐ 5.00</Text>
        </View>
      </View>
      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Vehicle Info</Text>
      </View>
      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Documents</Text>
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
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  ratingLabel: { fontSize: 14, color: '#64748B', marginRight: 8 },
  rating: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
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
