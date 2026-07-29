import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { api } from '../../src/api/client';

interface EarningsData {
  todayPesewas: number;
  thisWeekPesewas: number;
  todayRides: number;
  weekRides: number;
}

function formatGhsFromPesewas(pesewas: number | null | undefined): string {
  if (typeof pesewas !== 'number' || !Number.isSafeInteger(pesewas) || pesewas < 0) {
    return '--';
  }
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      setError(null);
      const data = await api.get<EarningsData>('/drivers/earnings');
      setEarnings(data);
    } catch (err) {
      // A failed earnings fetch must not be reported as a successful
      // GHS 0.00 / 0 rides — a driver who actually earned today would be
      // falsely told they earned nothing, with no signal anything failed.
      // Keep earnings null and surface an honest error/retry row instead;
      // the empty (zero) state is only shown when the API genuinely returns
      // zeros.
      setEarnings(null);
      setError(err instanceof Error && err.name !== 'SESSION_EXPIRED'
        ? 'Could not load earnings. Pull to try again.'
        : null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1B8B4B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Earnings</Text>
      {error && !earnings && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchEarnings} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!error && earnings && (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Today's Earnings</Text>
            <Text style={styles.amount}>
              {formatGhsFromPesewas(earnings.todayPesewas)}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>This Week</Text>
            <Text style={styles.amount}>
              {formatGhsFromPesewas(earnings.thisWeekPesewas)}
            </Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.card, styles.halfCard]}>
              <Text style={styles.label}>Rides Today</Text>
              <Text style={styles.count}>{earnings.todayRides}</Text>
            </View>
            <View style={[styles.card, styles.halfCard]}>
              <Text style={styles.label}>Rides This Week</Text>
              <Text style={styles.count}>{earnings.weekRides}</Text>
            </View>
          </View>
        </>
      )}
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  halfCard: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 14, color: '#64748B' },
  amount: { fontSize: 28, fontWeight: '700', color: '#1B8B4B', marginTop: 4 },
  count: { fontSize: 28, fontWeight: '700', color: '#1A1A2E', marginTop: 4 },
  errorCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#FECACA', alignItems: 'center' },
  errorText: { color: '#B91C1C', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn: { backgroundColor: '#1B8B4B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '600' },
});
