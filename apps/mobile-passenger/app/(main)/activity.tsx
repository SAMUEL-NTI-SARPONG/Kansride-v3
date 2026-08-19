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
import { Ionicons } from '@expo/vector-icons';
import { Button, StatusBadge, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { usePassengerInsets } from '../../src/ui/use-passenger-insets';

const reviewMode = developmentReviewModeEnabled(process.env.NODE_ENV, process.env.EXPO_PUBLIC_UI_REVIEW_MODE);

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
  const insets = usePassengerInsets();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRides = async () => {
    try {
      setError(null);
      if (reviewMode) {
        setRides([
          { id: 'review-history-1', pickupAddress: 'Market Circle', dropoffAddress: 'Airport Roundabout', pickupLatitude: 4.89, pickupLongitude: -1.75, dropoffLatitude: 4.905, dropoffLongitude: -1.765, farePesewas: 1850, status: 'completed', createdAt: '2026-08-18T10:30:00.000Z', rideType: 'standard_tricycle' },
          { id: 'review-history-2', pickupAddress: 'Sekondi Station', dropoffAddress: 'Harbour Area', pickupLatitude: 4.945, pickupLongitude: -1.71, dropoffLatitude: 4.885, dropoffLongitude: -1.755, farePesewas: 2400, status: 'completed', createdAt: '2026-08-15T16:15:00.000Z', rideType: 'priority_tricycle' },
        ]);
        return;
      }
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

  const getStatusTone = (status: string): 'success' | 'error' | 'warning' | 'neutral' => status === 'completed' ? 'success' : status.includes('cancelled') ? 'error' : status === 'in_progress' ? 'warning' : 'neutral';

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
      <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.eyebrow}>YOUR JOURNEYS</Text>
      <Text style={styles.title}>Ride activity</Text>
      <Text style={styles.subtitle}>Receipts and details from your recent trips.</Text>
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
            <View style={styles.cardTop}><View style={styles.vehicleIcon}><Ionicons name="navigate" size={20} color={colors.primary} /></View><View style={styles.cardCopy}><Text style={styles.date}>{formatDate(item.createdAt)}</Text><Text style={styles.fare}>{formatFare(item.farePesewas)}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textMuted} /></View>
            <View style={styles.routeRow}><View style={styles.routeRail}><View style={styles.fromDot} /><View style={styles.railLine} /><View style={styles.toDot} /></View><View style={styles.routeCopy}><Text style={styles.from}>{item.pickupAddress || `${item.pickupLatitude.toFixed(3)}, ${item.pickupLongitude.toFixed(3)}`}</Text><Text style={styles.to}>{item.dropoffAddress || `${item.dropoffLatitude.toFixed(3)}, ${item.dropoffLongitude.toFixed(3)}`}</Text></View></View>
            <View style={styles.bottomRow}>
              <Text style={styles.rideType}>{item.rideType?.includes('priority') ? 'Priority tricycle' : 'Standard tricycle'}</Text>
              <StatusBadge label={item.status.replace(/_/g, ' ')} tone={getStatusTone(item.status)} dot />
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={rides.length === 0
          ? [styles.emptyContent, { paddingBottom: insets.bottom }]
          : [styles.listContent, { paddingBottom: insets.bottom }]}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="cloud-offline-outline" size={31} color={colors.error} /></View>
              <Text style={styles.emptyText}>{error}</Text>
              <Button title="Try again" onPress={onRefresh} size="sm" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="map-outline" size={31} color={colors.primary} /></View>
              <Text style={styles.emptyText}>Your first trip starts here</Text>
              <Text style={styles.emptySubtext}>Your ride history will appear here</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  listContent: { gap: 12 },
  emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.3 },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: 2 },
  subtitle: { ...typography.small, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 42, height: 42, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  date: { ...typography.caption, color: colors.textSecondary },
  fare: { ...typography.h3, color: colors.textPrimary },
  routeRow: { flexDirection: 'row', marginTop: spacing.md },
  routeRail: { width: 18, alignItems: 'center', paddingVertical: 5 },
  fromDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pickupPin },
  railLine: { width: 1.5, height: 26, backgroundColor: colors.borderStrong, marginVertical: 2 },
  toDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: colors.dropoffPin },
  routeCopy: { flex: 1, gap: 15, paddingLeft: 7 },
  from: { ...typography.small, fontWeight: '700', color: colors.textPrimary },
  to: { ...typography.small, color: colors.textSecondary },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  rideType: { ...typography.caption, color: colors.textSecondary },
  emptyState: { alignItems: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceInset, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyText: { ...typography.h3, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md },
  emptySubtext: { ...typography.small, color: colors.textSecondary, marginTop: -8 },
});
