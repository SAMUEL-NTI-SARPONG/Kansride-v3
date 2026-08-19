import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { get, post } from '../../../src/api/client';
import {
  formatGhsFromPesewas,
  formatRideStatus,
  isRideRatingEligible,
  transformPassengerRideDetail,
  type PassengerRideDetail,
} from '../../../src/ride-details';
import { Ionicons } from '@expo/vector-icons';
import { Button, StatusBadge, borderRadius, colors, spacing, typography } from '@kansride/ui';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { usePassengerInsets } from '../../../src/ui/use-passenger-insets';

const reviewMode = developmentReviewModeEnabled(process.env.NODE_ENV, process.env.EXPO_PUBLIC_UI_REVIEW_MODE);

export default function PassengerRideDetailScreen() {
  const insets = usePassengerInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<PassengerRideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      if (reviewMode) {
        setDetail(transformPassengerRideDetail({ id: String(id), status: 'completed', pickupAddress: 'Market Circle', dropoffAddress: 'Airport Roundabout', rideType: 'standard_tricycle', estimatedDistanceMeters: 6400, estimatedDurationSeconds: 780, estimatedFarePesewas: 1850, actualFarePesewas: 1850, createdAt: '2026-08-18T10:15:00.000Z', updatedAt: '2026-08-18T10:30:00.000Z', completedAt: '2026-08-18T10:30:00.000Z', rating: 5, driver: { name: 'Kwame Boateng', vehicle: 'Green tricycle · WR 0001-26', rating: 4.8 } }));
        return;
      }
      const record = await get<Record<string, unknown>>(`/rides/${id}`);
      setDetail(transformPassengerRideDetail(record as never));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load ride details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const submitRating = async () => {
    if (!detail || !isRideRatingEligible(detail) || rating === 0) return;
    if (reviewMode) {
      Alert.alert('UI review mode', 'Server actions are unavailable in UI review mode.');
      return;
    }
    setRatingLoading(true);
    try {
      await post(`/rides/${detail.id}/rate`, { rating });
      await loadDetail();
      setRating(0);
      Alert.alert('Thank you', 'Your rating has been submitted.');
    } catch (ratingError) {
      Alert.alert('Rating failed', ratingError instanceof Error ? ratingError.message : 'Could not submit rating.');
    } finally {
      setRatingLoading(false);
    }
  };

  if (loading) return <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (error || !detail) return <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}><View style={styles.emptyIcon}><Ionicons name="alert-circle-outline" size={30} color={colors.error} /></View><Text style={styles.error}>{error || 'Ride details unavailable.'}</Text><Button title="Try again" onPress={() => void loadDetail()} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
      <Text style={styles.eyebrow}>TRIP RECEIPT</Text><View style={styles.titleRow}><Text style={styles.title}>Ride details</Text><StatusBadge label={formatRideStatus(detail.status)} tone={detail.status === 'completed' ? 'success' : detail.status.includes('cancelled') ? 'error' : 'primary'} dot /></View>
      <View style={styles.card}>
        <Text style={styles.label}>Pickup</Text><Text style={styles.value}>{detail.pickup}</Text>
        <Text style={styles.label}>Destination</Text><Text style={styles.value}>{detail.destination}</Text>
        <Text style={styles.label}>Ride type</Text><Text style={styles.value}>{formatRideStatus(detail.rideType)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Distance</Text><Text style={styles.value}>{detail.distanceMeters === null ? '--' : `${(detail.distanceMeters / 1000).toFixed(1)} km`}</Text>
        <Text style={styles.label}>Estimated fare</Text><Text style={styles.value}>{formatGhsFromPesewas(detail.estimatedFarePesewas)}</Text>
        <Text style={styles.label}>Final fare</Text><Text style={styles.value}>{formatGhsFromPesewas(detail.actualFarePesewas)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Requested</Text><Text style={styles.value}>{detail.requestedAt ? new Date(detail.requestedAt).toLocaleString('en-GH') : '--'}</Text>
        <Text style={styles.label}>Last updated</Text><Text style={styles.value}>{detail.updatedAt ? new Date(detail.updatedAt).toLocaleString('en-GH') : '--'}</Text>
        <Text style={styles.label}>Completed</Text><Text style={styles.value}>{detail.completedAt ? new Date(detail.completedAt).toLocaleString('en-GH') : '--'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Driver</Text><Text style={styles.value}>{detail.driver?.name || 'Unavailable'}</Text>
        <Text style={styles.value}>{detail.driver?.vehicle || 'Vehicle unavailable'}</Text>
        <Text style={styles.value}>{detail.driver?.rating === null || !detail.driver ? 'Rating unavailable' : `Rating ${detail.driver.rating.toFixed(1)}`}</Text>
      </View>
      {detail.cancellationReason && <View style={styles.card}><Text style={styles.label}>Cancellation reason</Text><Text style={styles.value}>{detail.cancellationReason}</Text></View>}
      {isRideRatingEligible(detail) && <View style={styles.card}><Text style={styles.label}>Rate this completed ride</Text><View style={styles.stars}>{[1, 2, 3, 4, 5].map((star) => <TouchableOpacity key={star} onPress={() => setRating(star)} accessibilityRole="button" accessibilityLabel={`Rate ${star} stars`}><Text style={styles.star}>{star <= rating ? '★' : '☆'}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={submitRating} disabled={ratingLoading || rating === 0} style={[styles.button, (ratingLoading || rating === 0) && styles.disabled]}><Text style={[styles.buttonText, (ratingLoading || rating === 0) && styles.disabledText]}>{ratingLoading ? 'Submitting…' : 'Submit rating'}</Text></TouchableOpacity></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  backButton: { width: 44, height: 44, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.3 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.textPrimary },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 3 },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: 8 },
  value: { ...typography.small, color: colors.textPrimary, fontWeight: '600' },
  emptyIcon: { width: 60, height: 60, borderRadius: borderRadius.xl, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  error: { ...typography.small, color: colors.error, textAlign: 'center', marginBottom: 12 },
  button: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: 14, alignItems: 'center', marginTop: 10 },
  disabled: { backgroundColor: colors.disabledSurface, borderWidth: 1, borderColor: colors.disabledBorder },
  disabledText: { color: colors.disabledText },
  buttonText: { color: colors.textInverse, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 10 },
  star: { fontSize: 34, color: colors.secondary },
});
