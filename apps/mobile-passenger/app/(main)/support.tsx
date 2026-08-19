import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useRideStore } from '../../src/stores/ride-store';
import { supportAvailability, supportLink, type SupportChannel } from '../../src/support';
import { Ionicons } from '@expo/vector-icons';
import { Card, ListItem, StatusBadge, borderRadius, colors, spacing, typography } from '@kansride/ui';
import { usePassengerInsets } from '../../src/ui/use-passenger-insets';

const channels: Array<{ key: SupportChannel; label: string; config?: string }> = [
  { key: 'phone', label: 'Call support', config: process.env.EXPO_PUBLIC_SUPPORT_PHONE },
  { key: 'whatsapp', label: 'WhatsApp support', config: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP },
  { key: 'email', label: 'Email support', config: process.env.EXPO_PUBLIC_SUPPORT_EMAIL },
];

export default function SupportScreen() {
  const insets = usePassengerInsets();
  const activeRide = useRideStore((state) => state.activeRide);
  const availability = supportAvailability({ phone: process.env.EXPO_PUBLIC_SUPPORT_PHONE, whatsapp: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP, email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL });
  const [opening, setOpening] = useState<SupportChannel | null>(null);

  const openChannel = async (channel: SupportChannel, configured?: string) => {
    const url = supportLink(channel, configured, activeRide?.id);
    if (!url) { Alert.alert('Channel unavailable', 'This support channel is not configured for the current deployment.'); return; }
    setOpening(channel);
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Channel unavailable', 'This device cannot open the configured support channel.');
    } finally { setOpening(null); }
  };

  return <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
    <Text style={styles.eyebrow}>WE’RE HERE TO HELP</Text><Text style={styles.title}>Support</Text><Text style={styles.note}>Choose any channel marked available. Hours depend on the current pilot support team.</Text>
    {activeRide && <Card variant="raised" shadow="sm" padding="md" style={styles.reference}><View style={styles.referenceIcon}><Ionicons name="navigate" size={20} color={colors.primary} /></View><View style={styles.referenceCopy}><Text style={styles.label}>Active ride reference</Text><Text style={styles.value}>{activeRide.id.slice(0, 8)}</Text></View><StatusBadge label="Active" tone="success" dot /></Card>}
    <Text style={styles.section}>Contact options</Text>
    <Card variant="outline" shadow="none" padding="xs" style={styles.channels}>{channels.map((channel, index) => <View key={channel.key}><ListItem title={channel.label} subtitle={availability[channel.key] ? (opening === channel.key ? 'Opening…' : 'Available for this deployment') : 'Unavailable for this deployment'} leading={<View style={[styles.channelIcon, !availability[channel.key] && styles.channelIconUnavailable]}><Ionicons name={channel.key === 'phone' ? 'call-outline' : channel.key === 'whatsapp' ? 'logo-whatsapp' : 'mail-outline'} size={21} color={availability[channel.key] ? colors.primary : colors.textMuted} /></View>} trailing={availability[channel.key] ? <Ionicons name="open-outline" size={18} color={colors.primary} /> : <StatusBadge label="Offline" />} onPress={() => void openChannel(channel.key, channel.config)} disabled={opening !== null || !availability[channel.key]} accessibilityLabel={channel.label} />{index < channels.length - 1 && <View style={styles.divider} />}</View>)}</Card>
    <View style={styles.promise}><Ionicons name="information-circle-outline" size={20} color={colors.info} /><Text style={styles.promiseText}>We never fabricate support availability. Unconfigured channels remain clearly unavailable.</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg }, backButton: { width: 44, height: 44, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.3 }, title: { ...typography.h1, color: colors.textPrimary }, note: { ...typography.small, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  reference: { flexDirection: 'row', alignItems: 'center', gap: 12 }, referenceIcon: { width: 42, height: 42, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, referenceCopy: { flex: 1 }, label: { ...typography.caption, color: colors.textSecondary }, value: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 1 },
  section: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.sm }, channels: { overflow: 'hidden' }, channelIcon: { width: 42, height: 42, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, channelIconUnavailable: { backgroundColor: colors.surfaceInset }, divider: { height: 1, backgroundColor: colors.border, marginLeft: 70 },
  promise: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.infoSoft, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.lg }, promiseText: { ...typography.caption, color: colors.info, flex: 1 },
});
