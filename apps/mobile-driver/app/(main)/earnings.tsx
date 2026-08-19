import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { Button, Card, FeedbackBanner, borderRadius, colors, spacing, typography } from '@kansride/ui';
import { useDriverInsets } from '../../src/ui/use-driver-insets';

const reviewMode = developmentReviewModeEnabled(process.env.NODE_ENV, process.env.EXPO_PUBLIC_UI_REVIEW_MODE);

interface EarningsData { todayPesewas: number; thisWeekPesewas: number; todayRides: number; weekRides: number }

function formatGhsFromPesewas(pesewas: number | null | undefined): string {
  return typeof pesewas === 'number' && Number.isSafeInteger(pesewas) && pesewas >= 0
    ? `GHS ${(pesewas / 100).toFixed(2)}` : '--';
}

export default function EarningsScreen() {
  const insets = useDriverInsets();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = async () => {
    try {
      setError(null);
      if (reviewMode) {
        setEarnings({ todayPesewas: 14850, thisWeekPesewas: 68200, todayRides: 7, weekRides: 31 });
        return;
      }
      setEarnings(await api.get<EarningsData>('/drivers/earnings'));
    } catch (err) {
      setEarnings(null);
      setError(err instanceof Error && err.name !== 'SESSION_EXPIRED' ? 'Could not load earnings. Try again.' : null);
    } finally { setLoading(false); }
  };

  useEffect(() => { void fetchEarnings(); }, []);

  if (loading) return <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]} showsVerticalScrollIndicator={false}>
    <View style={styles.headerRow}><View><Text style={styles.eyebrow}>DRIVER PERFORMANCE</Text><Text style={styles.title}>Earnings</Text></View><TouchableOpacity onPress={() => router.push('/(main)/history')} style={styles.historyButton} accessibilityRole="button"><Ionicons name="time-outline" size={18} color={colors.primary} /><Text style={styles.historyLink}>History</Text></TouchableOpacity></View>
    {error && !earnings && <FeedbackBanner tone="error" title="Earnings unavailable" message={error} action={<Button title="Retry" size="sm" onPress={() => void fetchEarnings()} />} />}
    {earnings && <>
      <Card variant="raised" shadow="md" padding="lg" style={styles.heroCard}><View style={styles.heroTop}><View style={styles.walletIcon}><Ionicons name="wallet" size={22} color={colors.textInverse} /></View><Text style={styles.period}>TODAY</Text></View><Text style={styles.amount}>{formatGhsFromPesewas(earnings.todayPesewas)}</Text><Text style={styles.helper}>{earnings.todayRides} completed rides today</Text></Card>
      <View style={styles.metricRow}><Card variant="outline" shadow="none" padding="md" style={styles.metricCard}><Text style={styles.metricLabel}>This week</Text><Text style={styles.metricValue}>{formatGhsFromPesewas(earnings.thisWeekPesewas)}</Text></Card><Card variant="outline" shadow="none" padding="md" style={styles.metricCard}><Text style={styles.metricLabel}>Weekly rides</Text><Text style={styles.metricValue}>{earnings.weekRides}</Text></Card></View>
      <View style={styles.tip}><Ionicons name="trending-up" size={20} color={colors.primary} /><View style={styles.tipCopy}><Text style={styles.tipTitle}>Keep your momentum</Text><Text style={styles.tipText}>Stay online during busy periods to improve your weekly total.</Text></View></View>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg }, centered: { alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }, eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.2 }, title: { ...typography.h1, color: colors.textPrimary },
  historyButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: borderRadius.full, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 6 }, historyLink: { ...typography.label, color: colors.primary },
  heroCard: { backgroundColor: colors.primary }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, walletIcon: { width: 42, height: 42, borderRadius: borderRadius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, period: { ...typography.label, color: colors.primarySoft }, amount: { ...typography.display, color: colors.textInverse, marginTop: spacing.lg }, helper: { ...typography.small, color: colors.primarySoft, marginTop: 2 },
  metricRow: { flexDirection: 'row', gap: 12, marginTop: 12 }, metricCard: { flex: 1 }, metricLabel: { ...typography.caption, color: colors.textSecondary }, metricValue: { ...typography.h3, color: colors.textPrimary, marginTop: 5 },
  tip: { marginTop: spacing.lg, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceInset, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, tipCopy: { flex: 1 }, tipTitle: { ...typography.bodyBold, color: colors.textPrimary }, tipText: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
});
