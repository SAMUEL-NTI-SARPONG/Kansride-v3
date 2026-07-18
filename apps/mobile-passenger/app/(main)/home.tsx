import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Map View</Text>
        <Text style={styles.mapSubtext}>Kansawrodo · Sekondi-Takoradi</Text>
      </View>
      <View style={styles.bottomCard}>
        <Text style={styles.greeting}>Where are you going?</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchText}>Search destination...</Text>
        </View>
        <View style={styles.button}>
          <Text style={styles.buttonText}>Request Ride</Text>
        </View>
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
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  searchBar: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    height: 52,
    justifyContent: 'center',
  },
  searchText: { color: '#94A3B8', fontSize: 16 },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
