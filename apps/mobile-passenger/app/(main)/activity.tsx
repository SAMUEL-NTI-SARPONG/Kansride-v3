import { View, Text, StyleSheet, FlatList } from 'react-native';

const MOCK_RIDES = [
  {
    id: '1',
    from: 'Kansawrodo Market',
    to: 'UHAS Campus',
    date: '2024-12-01',
    fare: 'GHS 8.00',
    status: 'completed',
  },
  {
    id: '2',
    from: 'Takoradi Station',
    to: 'Airport Roundabout',
    date: '2024-11-30',
    fare: 'GHS 12.00',
    status: 'completed',
  },
];

export default function ActivityScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Rides</Text>
      <FlatList
        data={MOCK_RIDES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.from}>{item.from}</Text>
              <Text style={styles.fare}>{item.fare}</Text>
            </View>
            <Text style={styles.to}>→ {item.to}</Text>
            <Text style={styles.date}>{item.date}</Text>
          </View>
        )}
        contentContainerStyle={{ gap: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  from: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  fare: { fontSize: 16, fontWeight: '700', color: '#1B8B4B' },
  to: { fontSize: 14, color: '#64748B', marginTop: 4 },
  date: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
});
