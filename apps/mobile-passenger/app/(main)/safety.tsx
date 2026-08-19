import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { post, del } from '../../src/api/client';
import { useRideStore } from '../../src/stores/ride-store';
import type { PublicTrackingLink } from '@kansride/types';
import { mobileRuntimeUrl } from '@kansride/config/mobile-runtime';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, StatusBadge, borderRadius, colors, spacing, typography } from '@kansride/ui';
import { usePassengerInsets } from '../../src/ui/use-passenger-insets';

export default function SafetyScreen() {
  const insets = usePassengerInsets();
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

  return <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
    <Text style={styles.eyebrow}>RIDE WITH CONFIDENCE</Text><Text style={styles.title}>Safety centre</Text><Text style={styles.subtitle}>Tools that help you stay connected throughout your trip.</Text>
    <Card variant="raised" shadow="md" padding="md" style={styles.heroCard}><View style={styles.heroIcon}><Ionicons name="shield-checkmark" size={28} color={colors.primary} /></View><Text style={styles.section}>Your safety comes first</Text><Text style={styles.body}>Share your trip with someone you trust and keep emergency options easy to reach.</Text></Card>
    <Card variant="outline" shadow="none" padding="lg" style={styles.emergencyCard}><View style={styles.cardHeading}><View style={styles.dangerIcon}><Ionicons name="call-outline" size={22} color={colors.error} /></View><View style={styles.headingCopy}><Text style={styles.cardTitle}>Emergency contact</Text><Text style={styles.body}>KansRide is not an emergency service.</Text></View></View><Button title="Call configured emergency contact" variant="danger" onPress={() => void callEmergency()} fullWidth /></Card>
    <Card variant="outline" shadow="none" padding="lg" style={styles.shareCard}><View style={styles.cardHeading}><View style={styles.shareIcon}><Ionicons name="share-social-outline" size={22} color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.cardTitle}>Live trip sharing</Text><Text style={styles.body}>{activeRide ? `Ride ${activeRide.id.slice(0, 8)}` : 'Available when you have an active ride'}</Text></View>{activeRide && <StatusBadge label={state} tone={state === 'active' ? 'success' : state === 'expired' ? 'warning' : 'neutral'} dot />}</View>{activeRide ? <>{state === 'active' && <><Button title="Share tracking link" onPress={() => void shareLink()} disabled={loading} fullWidth /><Button title="Stop sharing" variant="ghost" onPress={() => void revoke()} disabled={loading} fullWidth /></>}{state === 'expired' && <Button title="Create a new link" onPress={() => void createShare()} fullWidth />}{state === 'unavailable' && <Text style={styles.unavailable}>A tracking link is not available right now.</Text>}</> : <View style={styles.emptyRow}><Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} /><Text style={styles.body}>Start a ride to create a private tracking link.</Text></View>}</Card>
    {loading && <ActivityIndicator color={colors.primary} />}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg, gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.3 }, title: { ...typography.h1, color: colors.textPrimary }, subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm },
  heroCard: { alignItems: 'center' }, heroIcon: { width: 54, height: 54, borderRadius: borderRadius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }, section: { ...typography.h3, color: colors.textPrimary }, body: { ...typography.small, color: colors.textSecondary },
  emergencyCard: { gap: spacing.md, borderColor: colors.errorBorder }, shareCard: { gap: spacing.md }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headingCopy: { flex: 1 }, cardTitle: { ...typography.bodyBold, color: colors.textPrimary }, dangerIcon: { width: 44, height: 44, borderRadius: borderRadius.lg, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center' }, shareIcon: { width: 44, height: 44, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, emptyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.surfaceInset, padding: 12, borderRadius: borderRadius.lg }, unavailable: { ...typography.small, color: colors.error },
});
