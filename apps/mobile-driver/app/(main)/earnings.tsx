import { View, Text, StyleSheet } from 'react-native';

export default function EarningsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Earnings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Today's Earnings</Text>
        <Text style={styles.amount}>GHS 0.00</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>This Week</Text>
        <Text style={styles.amount}>GHS 0.00</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Total Rides Today</Text>
        <Text style={styles.count}>0</Text>
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: { fontSize: 14, color: '#64748B' },
  amount: { fontSize: 28, fontWeight: '700', color: '#1B8B4B', marginTop: 4 },
  count: { fontSize: 28, fontWeight: '700', color: '#1A1A2E', marginTop: 4 },
});
