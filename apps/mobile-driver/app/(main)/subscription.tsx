import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useDriverStore } from '../../src/stores/driver-store';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { Button, Card, FeedbackBanner, StatusBadge, borderRadius, colors, spacing, typography } from '@kansride/ui';
import { useDriverInsets } from '../../src/ui/use-driver-insets';

const reviewMode = developmentReviewModeEnabled(process.env.NODE_ENV, process.env.EXPO_PUBLIC_UI_REVIEW_MODE);
type MobileMoneyMethod = 'mtn_mobile_money' | 'telecel_cash' | 'at_money';
const PAYMENT_METHODS: Array<{ value: MobileMoneyMethod; label: string }> = [{ value: 'mtn_mobile_money', label: 'MTN MoMo' }, { value: 'telecel_cash', label: 'Telecel Cash' }, { value: 'at_money', label: 'AT Money' }];

export default function SubscriptionScreen() {
  const insets = useDriverInsets();
  const { subscriptionActive, subscriptionExpiresAt, setSubscription } = useDriverStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<MobileMoneyMethod>('mtn_mobile_money');

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      if (reviewMode) { setSubscription(true, '2026-08-20T23:59:00.000Z'); return; }
      const profile = await api.get<{ isDriver: boolean; subscriptionActive?: boolean; subscriptionExpiresAt?: string }>('/drivers/me');
      if (profile.isDriver) setSubscription(profile.subscriptionActive || false, profile.subscriptionExpiresAt);
    } catch { /* Existing refresh remains best-effort. */ } finally { setRefreshing(false); }
  };
  useEffect(() => { void refreshStatus(); }, []);

  const handleSubscribe = async () => {
    if (reviewMode) { Alert.alert('UI review mode', 'Payment actions are unavailable in UI review mode.'); return; }
    setLoading(true);
    try {
      const result = await api.post<{ message: string; expiresAt?: string; status?: string }>('/drivers/subscribe', { paymentMethod });
      if (result.expiresAt) { setSubscription(true, result.expiresAt); Alert.alert('Success', 'Subscription activated! You can now go online.'); }
      else Alert.alert('Payment pending', result.message || 'Please check your phone for payment prompt');
    } catch (error: any) { Alert.alert('Payment unavailable', error.message || 'Could not process payment'); } finally { setLoading(false); }
  };

  const formatExpiry = (dateStr: string | null) => dateStr ? new Date(dateStr).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';

  return <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>DRIVER ACCESS</Text><Text style={styles.title}>Subscription</Text><Text style={styles.subtitle}>Your daily access status for receiving KansRide requests.</Text>
    {reviewMode && <View style={styles.reviewPanel}><Text style={styles.reviewLabel}>UI REVIEW · SUBSCRIPTION STATE</Text><View style={styles.reviewRow}><TouchableOpacity style={[styles.reviewChip, !subscriptionActive && styles.reviewChipActive]} onPress={() => setSubscription(false)}><Text style={[styles.reviewText, !subscriptionActive && styles.reviewTextActive]}>Inactive</Text></TouchableOpacity><TouchableOpacity style={[styles.reviewChip, subscriptionActive && styles.reviewChipActive]} onPress={() => setSubscription(true, '2026-08-20T23:59:00.000Z')}><Text style={[styles.reviewText, subscriptionActive && styles.reviewTextActive]}>Active</Text></TouchableOpacity></View></View>}
    <Card variant="raised" shadow="md" padding="lg" style={styles.planCard}><View style={styles.planTop}><View style={styles.planIcon}><Ionicons name="shield-checkmark" size={25} color={colors.textInverse} /></View><StatusBadge label={subscriptionActive ? 'Active' : 'Inactive'} tone={subscriptionActive ? 'success' : 'error'} dot /></View><Text style={styles.plan}>Daily driver access</Text><Text style={styles.price}>GHS 10.00 <Text style={styles.perDay}>/ day</Text></Text>{subscriptionActive && <Text style={styles.expiry}>Valid until {formatExpiry(subscriptionExpiresAt)}</Text>}</Card>
    <Card variant="outline" shadow="none" padding="md" style={styles.benefits}><Text style={styles.sectionTitle}>What your plan includes</Text>{['Receive passenger ride requests', 'Keep 100% of completed ride fares', 'No commission deducted per trip'].map((item) => <View key={item} style={styles.benefit}><View style={styles.check}><Ionicons name="checkmark" size={15} color={colors.textInverse} /></View><Text style={styles.benefitText}>{item}</Text></View>)}</Card>
    {!subscriptionActive && <><Text style={styles.sectionLabel}>PAYMENT METHOD</Text><View style={styles.methodRow}>{PAYMENT_METHODS.map((method) => <TouchableOpacity key={method.value} style={[styles.methodTile, paymentMethod === method.value && styles.methodSelected]} onPress={() => setPaymentMethod(method.value)} disabled={loading}><Text style={[styles.methodText, paymentMethod === method.value && styles.methodTextSelected]}>{method.label}</Text></TouchableOpacity>)}</View><Button title="Subscribe — GHS 10.00" onPress={() => void handleSubscribe()} loading={loading} fullWidth size="lg" /></>}
    {subscriptionActive && <FeedbackBanner tone="success" title="Ready to drive" message="Your subscription is active. Go online from Home when you are ready to receive rides." />}
    {refreshing && <ActivityIndicator color={colors.primary} style={styles.loader} />}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg }, eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.2 }, title: { ...typography.h1, color: colors.textPrimary }, subtitle: { ...typography.small, color: colors.textSecondary, marginTop: 3, marginBottom: spacing.lg },
  reviewPanel: { backgroundColor: colors.warningSoft, padding: 12, borderRadius: borderRadius.xl, marginBottom: 12 }, reviewLabel: { ...typography.label, color: colors.warning, marginBottom: 8 }, reviewRow: { flexDirection: 'row', gap: 8 }, reviewChip: { flex: 1, minHeight: 36, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, reviewChipActive: { backgroundColor: colors.primary }, reviewText: { ...typography.caption, color: colors.textSecondary }, reviewTextActive: { color: colors.textInverse, fontWeight: '700' },
  planCard: { backgroundColor: colors.surfaceRaised }, planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, planIcon: { width: 50, height: 50, borderRadius: borderRadius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, plan: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg }, price: { ...typography.h1, color: colors.primary, marginTop: 2 }, perDay: { ...typography.small, color: colors.textSecondary }, expiry: { ...typography.small, color: colors.textSecondary, marginTop: 5 },
  benefits: { marginTop: 12, gap: 12 }, sectionTitle: { ...typography.bodyBold, color: colors.textPrimary }, benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 }, check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, benefitText: { ...typography.small, color: colors.textSecondary, flex: 1 },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm }, methodRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md }, methodTile: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, methodSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, methodText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' }, methodTextSelected: { color: colors.primaryDark }, loader: { marginTop: spacing.md },
});
