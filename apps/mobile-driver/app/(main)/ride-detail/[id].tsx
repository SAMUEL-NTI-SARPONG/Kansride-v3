import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/api/client';
import { driverLocationFallback, formatDriverFare, type DriverHistoryRecord } from '../../../src/driver-history';

export default function DriverRideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const [ride, setRide] = useState<DriverHistoryRecord | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!id) return; setLoading(true); try { setRide(await api.get<DriverHistoryRecord>(`/rides/${id}`)); setError(null); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Ride details unavailable.'); } finally { setLoading(false); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color="#1B8B4B" /></View>;
  if (error || !ride) return <View style={[styles.container, styles.center]}><Text style={styles.error}>{error || 'Ride details unavailable.'}</Text><TouchableOpacity onPress={load} style={styles.button}><Text style={styles.buttonText}>Retry</Text></TouchableOpacity></View>;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}><TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>Back</Text></TouchableOpacity><Text style={styles.title}>Ride details</Text><View style={styles.card}><Text style={styles.status}>{ride.status.replace(/_/g, ' ')}</Text><Text>{driverLocationFallback(ride.pickupAddress, ride.pickupLatitude, ride.pickupLongitude)} → {driverLocationFallback(ride.dropoffAddress, ride.dropoffLatitude, ride.dropoffLongitude)}</Text><Text>Final fare: {formatDriverFare(ride.farePesewas)}</Text><Text>Requested: {ride.createdAt ? new Date(ride.createdAt).toLocaleString('en-GH') : '--'}</Text><Text>Completed: {ride.completedAt ? new Date(ride.completedAt).toLocaleString('en-GH') : '--'}</Text>{ride.cancellationReason && <Text>Cancellation: {ride.cancellationReason}</Text>}</View></ScrollView>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F8FAFB' }, content: { padding: 24, paddingTop: 60, gap: 12 }, center: { alignItems: 'center', justifyContent: 'center', padding: 24 }, back: { color: '#1B8B4B', fontWeight: '700' }, title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E' }, card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#E2E8F0' }, status: { color: '#1B8B4B', fontWeight: '700', textTransform: 'capitalize' }, error: { color: '#B91C1C', marginBottom: 12 }, button: { backgroundColor: '#1B8B4B', padding: 12, borderRadius: 8 }, buttonText: { color: '#FFF', fontWeight: '700' } });
