import { View, Text, StyleSheet } from 'react-native';

export default function SubscriptionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Subscription</Text>
      <View style={styles.card}>
        <Text style={styles.plan}>Daily Plan</Text>
        <Text style={styles.price}>GHS 10.00 / day</Text>
        <Text style={styles.status}>Not Active</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>• Pay GHS 10 daily to go online</Text>
        <Text style={styles.infoText}>• Keep 100% of your ride fares</Text>
        <Text style={styles.infoText}>• No commission per trip</Text>
        <Text style={styles.infoText}>• Pay via Mobile Money</Text>
      </View>
      <View style={styles.button}>
        <Text style={styles.buttonText}>Subscribe Now</Text>
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  plan: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  price: { fontSize: 32, fontWeight: '700', color: '#1B8B4B', marginTop: 8 },
  status: { fontSize: 14, color: '#EF4444', marginTop: 8, fontWeight: '600' },
  infoCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, marginBottom: 24 },
  infoTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#64748B', marginBottom: 4 },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
