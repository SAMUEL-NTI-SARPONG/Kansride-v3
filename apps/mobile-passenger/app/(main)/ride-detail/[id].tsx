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

export default function PassengerRideDetailScreen() {
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

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#1B8B4B" /></View>;
  if (error || !detail) return <View style={[styles.container, styles.center]}><Text style={styles.error}>{error || 'Ride details unavailable.'}</Text><TouchableOpacity onPress={loadDetail} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>Retry</Text></TouchableOpacity></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back"><Text style={styles.back}>Back</Text></TouchableOpacity>
      <Text style={styles.title}>Ride details</Text>
      <Text style={styles.status}>{formatRideStatus(detail.status)}</Text>
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
      {isRideRatingEligible(detail) && <View style={styles.card}><Text style={styles.label}>Rate this completed ride</Text><View style={styles.stars}>{[1, 2, 3, 4, 5].map((star) => <TouchableOpacity key={star} onPress={() => setRating(star)} accessibilityRole="button" accessibilityLabel={`Rate ${star} stars`}><Text style={styles.star}>{star <= rating ? '★' : '☆'}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={submitRating} disabled={ratingLoading || rating === 0} style={[styles.button, (ratingLoading || rating === 0) && styles.disabled]}><Text style={styles.buttonText}>{ratingLoading ? 'Submitting…' : 'Submit rating'}</Text></TouchableOpacity></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  content: { padding: 24, paddingTop: 60, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: { color: '#1B8B4B', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E' },
  status: { color: '#1B8B4B', fontWeight: '700', textTransform: 'capitalize' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  label: { color: '#64748B', fontSize: 12, marginTop: 8 },
  value: { color: '#1A1A2E', fontSize: 15 },
  error: { color: '#B91C1C', textAlign: 'center', marginBottom: 12 },
  button: { backgroundColor: '#1B8B4B', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFF', fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 10 },
  star: { fontSize: 34, color: '#F59E0B' },
});
