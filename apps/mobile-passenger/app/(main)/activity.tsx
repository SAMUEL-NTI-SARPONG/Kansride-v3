import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { get } from '../../src/api/client';
import { router } from 'expo-router';

interface RideHistoryItem {
  id: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  farePesewas: number;
  status: string;
  createdAt: string;
  rideType?: string;
}

export default function ActivityScreen() {
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRides = async () => {
    try {
      setError(null);
      const data = await get<RideHistoryItem[]>('/rides/my-rides');
      setRides(data || []);
    } catch (err) {
      // A failed my-rides fetch must not be reported as an empty list — a user
      // with past rides would be falsely shown 'No rides yet' after a network
      // blip. Keep a separate error state and render a retry row on failure;
      // the empty state is only shown when there is genuinely no data and no
      // error.
      const isSessionExpired = err instanceof Error && err.name === 'SESSION_EXPIRED';
      setRides([]);
      setError(isSessionExpired ? null : 'Could not load your rides. Pull to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRides();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#1B8B4B';
      case 'cancelled':
        return '#EF4444';
      case 'in_progress':
        return '#F59E0B';
      default:
        return '#64748B';
    }
  };

  const formatFare = (farePesewas: number | null | undefined) => {
    if (
      typeof farePesewas !== 'number' ||
      !Number.isSafeInteger(farePesewas) ||
      farePesewas < 0
    ) {
      return '--';
    }
    return `GHS ${(farePesewas / 100).toFixed(2)}`;
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
      <Text style={styles.title}>Your Rides</Text>
<FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/(main)/ride-detail/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ride details for ${item.pickupAddress || 'ride'}`}
          >
            <View style={styles.row}>
              <Text style={styles.from}>
                {item.pickupAddress || `${item.pickupLatitude.toFixed(3)}, ${item.pickupLongitude.toFixed(3)}`}
              </Text>
              <Text style={styles.fare}>
                {formatFare(item.farePesewas)}
              </Text>
            </View>
            <Text style={styles.to}>
              {'\u2192'} {item.dropoffAddress || `${item.dropoffLatitude.toFixed(3)}, ${item.dropoffLongitude.toFixed(3)}`}
            </Text>
            <View style={styles.bottomRow}>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
                {item.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={rides.length === 0 ? styles.center : { gap: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No rides yet</Text>
              <Text style={styles.emptySubtext}>Your ride history will appear here</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1B8B4B"
            colors={['#1B8B4B']}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  from: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  fare: { fontSize: 16, fontWeight: '700', color: '#1B8B4B' },
  to: { fontSize: 14, color: '#64748B', marginTop: 4 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  date: { fontSize: 12, color: '#94A3B8' },
  status: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  retryBtn: { marginTop: 16, backgroundColor: '#1B8B4B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '600' },
});
