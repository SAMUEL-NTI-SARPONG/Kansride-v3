import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { post, del } from '../../src/api/client';
import { useRideStore } from '../../src/stores/ride-store';
import type { PublicTrackingLink } from '@kansride/types';
import { mobileRuntimeUrl } from '@kansride/config/mobile-runtime';

export default function SafetyScreen() {
  const activeRide = useRideStore((state) => state.activeRide);
  const [share, setShare] = useState<PublicTrackingLink | null>(null);
  const [state, setState] = useState<'unavailable' | 'active' | 'revoked' | 'expired'>('unavailable');
  const [loading, setLoading] = useState(false);

  const createShare = useCallback(async () => {
    if (!activeRide) return;
    setLoading(true);
    try {
      const link = await post<PublicTrackingLink>(`/rides/${activeRide.id}/tracking-link`);
      setShare(link);
      setState(new Date(link.expiresAt) <= new Date() ? 'expired' : 'active');
    } catch (error) {
      setState('unavailable');
      Alert.alert('Tracking unavailable', error instanceof Error ? error.message : 'A tracking link could not be created.');
    } finally { setLoading(false); }
  }, [activeRide]);

  useEffect(() => { if (activeRide) void createShare(); }, [activeRide, createShare]);

  const revoke = async () => {
    if (!activeRide) return;
    setLoading(true);
    try {
      await del(`/rides/${activeRide.id}/tracking-links`);
      setShare(null); setState('revoked');
    } catch (error) { Alert.alert('Could not stop sharing', error instanceof Error ? error.message : 'Try again.'); }
    finally { setLoading(false); }
  };

  const shareLink = async () => {
    if (!share || state !== 'active') return;
    const base = mobileRuntimeUrl('EXPO_PUBLIC_TRACKING_URL', process.env.EXPO_PUBLIC_TRACKING_URL, 'http://localhost:3002');
    await Share.share({ message: `Track my KansRide trip: ${base}${share.trackingPath}`, url: `${base}${share.trackingPath}` });
  };

  const callEmergency = async () => {
    const phone = process.env.EXPO_PUBLIC_EMERGENCY_PHONE?.trim();
    if (!phone) { Alert.alert('Emergency contact unavailable', 'No emergency number is configured for this deployment.'); return; }
    const url = `tel:${phone}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Emergency contact unavailable', 'This device cannot place a call.');
  };

  return <View style={styles.container}>
    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>Back</Text></TouchableOpacity>
    <Text style={styles.title}>Safety</Text>
    <View style={styles.card}><Text style={styles.warning}>KansRide is not an emergency service.</Text><Text style={styles.body}>For immediate danger, contact local emergency services.</Text><TouchableOpacity onPress={callEmergency} style={styles.emergency} accessibilityRole="button"><Text style={styles.emergencyText}>Call configured emergency contact</Text></TouchableOpacity></View>
    <View style={styles.card}><Text style={styles.section}>Ride sharing</Text>{activeRide ? <><Text style={styles.body}>Ride reference: {activeRide.id.slice(0, 8)}</Text><Text style={styles.status}>Sharing status: {state}</Text>{state === 'active' && <><TouchableOpacity onPress={shareLink} disabled={loading} style={styles.button}><Text style={styles.buttonText}>Share tracking link</Text></TouchableOpacity><TouchableOpacity onPress={() => void revoke()} disabled={loading} style={styles.revoke}><Text style={styles.revokeText}>Stop sharing</Text></TouchableOpacity></>}{state === 'expired' && <TouchableOpacity onPress={() => void createShare()} style={styles.button}><Text style={styles.buttonText}>Create new link</Text></TouchableOpacity>}</> : <Text style={styles.body}>No active ride is available to share.</Text>}</View>
    {loading && <ActivityIndicator color="#1B8B4B" />}
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60, gap: 12 }, back: { color: '#1B8B4B', fontWeight: '700' }, title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E' }, card: { backgroundColor: '#FFF', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }, warning: { color: '#9A3412', fontWeight: '700' }, body: { color: '#64748B', lineHeight: 20 }, section: { color: '#1A1A2E', fontWeight: '700', fontSize: 18 }, status: { color: '#1B8B4B', fontWeight: '600' }, button: { backgroundColor: '#1B8B4B', borderRadius: 8, padding: 13, alignItems: 'center' }, buttonText: { color: '#FFF', fontWeight: '700' }, emergency: { borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, padding: 13, alignItems: 'center' }, emergencyText: { color: '#B91C1C', fontWeight: '700' }, revoke: { alignItems: 'center', padding: 10 }, revokeText: { color: '#B91C1C', fontWeight: '700' }, });
