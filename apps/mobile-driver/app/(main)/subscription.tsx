import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { api } from '../../src/api/client';
import { useDriverStore } from '../../src/stores/driver-store';

// Canonical Mobile Money methods. The backend PaymentMethod union (and the
// real Hubtel-style provider) only accepts these exact string values; the
// previous screen sent 'mobile_money', which is NOT a member — the mock
// provider silently accepted it, but a real provider would reject it and the
// driver could never activate a subscription. Let the driver pick their
// provider so the value sent is always canonical.
type MobileMoneyMethod = 'mtn_mobile_money' | 'telecel_cash' | 'at_money';
const PAYMENT_METHODS: Array<{ value: MobileMoneyMethod; label: string }> = [
  { value: 'mtn_mobile_money', label: 'MTN MoMo' },
  { value: 'telecel_cash', label: 'Telecel Cash' },
  { value: 'at_money', label: 'AirtelTigo Money' },
];

export default function SubscriptionScreen() {
  const { subscriptionActive, subscriptionExpiresAt, setSubscription } = useDriverStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<MobileMoneyMethod>('mtn_mobile_money');

  useEffect(() => {
    refreshStatus();
  }, []);

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      const profile = await api.get<{
        isDriver: boolean;
        subscriptionActive?: boolean;
        subscriptionExpiresAt?: string;
      }>('/drivers/me');
      if (profile.isDriver) {
        setSubscription(profile.subscriptionActive || false, profile.subscriptionExpiresAt);
      }
    } catch {
      // Ignore errors on refresh
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const result = await api.post<{
        message: string;
        expiresAt?: string;
        status?: string;
      }>('/drivers/subscribe', { paymentMethod });

      if (result.expiresAt) {
        setSubscription(true, result.expiresAt);
        Alert.alert('Success', 'Subscription activated! You can now go online.');
      } else {
        Alert.alert('Payment Pending', result.message || 'Please check your phone for payment prompt');
      }
    } catch (error: any) {
      Alert.alert('Payment Failed', error.message || 'Could not process payment');
    } finally {
      setLoading(false);
    }
  };

  const formatExpiry = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-GH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Subscription</Text>

      <View style={styles.card}>
        <Text style={styles.plan}>Daily Plan</Text>
        <Text style={styles.price}>GHS 10.00 / day</Text>
        <Text style={[styles.status, subscriptionActive ? styles.statusActive : styles.statusInactive]}>
          {subscriptionActive ? 'Active' : 'Not Active'}
        </Text>
        {subscriptionActive && subscriptionExpiresAt && (
          <Text style={styles.expiry}>Expires: {formatExpiry(subscriptionExpiresAt)}</Text>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>- Pay GHS 10 daily to go online</Text>
        <Text style={styles.infoText}>- Keep 100% of your ride fares</Text>
        <Text style={styles.infoText}>- No commission per trip</Text>
        <Text style={styles.infoText}>- Pay via Mobile Money</Text>
      </View>

      {!subscriptionActive && (
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.value}
              style={[
                styles.methodTile,
                paymentMethod === method.value && styles.methodTileSelected,
              ]}
              onPress={() => setPaymentMethod(method.value)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === method.value && styles.methodTextSelected,
                ]}
              >
                {method.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!subscriptionActive && (
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Subscribe Now - GHS 10.00</Text>
          )}
        </TouchableOpacity>
      )}

      {subscriptionActive && (
        <View style={styles.activeCard}>
          <Text style={styles.activeText}>You're all set! Go online to receive rides.</Text>
        </View>
      )}

      {refreshing && (
        <ActivityIndicator style={styles.refreshIndicator} color="#1B8B4B" />
      )}
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
  status: { marginTop: 8, fontWeight: '600', fontSize: 14 },
  statusActive: { color: '#1B8B4B' },
  statusInactive: { color: '#EF4444' },
  expiry: { fontSize: 12, color: '#64748B', marginTop: 4 },
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  methodTile: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFF' },
  methodTileSelected: { borderColor: '#1B8B4B', backgroundColor: '#F0FDF4' },
  methodText: { color: '#64748B', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  methodTextSelected: { color: '#1B8B4B' },
  activeCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1B8B4B',
  },
  activeText: { fontSize: 16, fontWeight: '600', color: '#1B8B4B' },
  refreshIndicator: { marginTop: 16 },
});
