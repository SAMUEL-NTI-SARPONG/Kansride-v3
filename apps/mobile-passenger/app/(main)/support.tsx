import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useRideStore } from '../../src/stores/ride-store';
import { supportAvailability, supportLink, type SupportChannel } from '../../src/support';

const channels: Array<{ key: SupportChannel; label: string; config?: string }> = [
  { key: 'phone', label: 'Call support', config: process.env.EXPO_PUBLIC_SUPPORT_PHONE },
  { key: 'whatsapp', label: 'WhatsApp support', config: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP },
  { key: 'email', label: 'Email support', config: process.env.EXPO_PUBLIC_SUPPORT_EMAIL },
];

export default function SupportScreen() {
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

  return <View style={styles.container}>
    <TouchableOpacity onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>Back</Text></TouchableOpacity>
    <Text style={styles.title}>Support</Text>
    <Text style={styles.note}>Support availability depends on the configured deployment channels. No 24-hour support promise is made.</Text>
    {activeRide && <View style={styles.reference}><Text style={styles.label}>Active ride reference</Text><Text style={styles.value}>{activeRide.id.slice(0, 8)}</Text></View>}
    {channels.map((channel) => <TouchableOpacity key={channel.key} style={[styles.channel, !availability[channel.key] && styles.unavailable]} onPress={() => void openChannel(channel.key, channel.config)} disabled={opening !== null} accessibilityRole="button" accessibilityLabel={channel.label}><Text style={styles.channelText}>{channel.label}</Text><Text style={styles.state}>{availability[channel.key] ? (opening === channel.key ? 'Opening…' : 'Available') : 'Unavailable for this deployment'}</Text></TouchableOpacity>)}
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, paddingTop: 60, gap: 12 }, back: { color: '#1B8B4B', fontWeight: '700' }, title: { fontSize: 26, fontWeight: '700', color: '#1A1A2E' }, note: { color: '#64748B', lineHeight: 20 }, reference: { backgroundColor: '#FFF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }, label: { color: '#64748B', fontSize: 12 }, value: { color: '#1A1A2E', fontWeight: '700', marginTop: 4 }, channel: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' }, unavailable: { borderColor: '#E2E8F0', opacity: 0.7 }, channelText: { color: '#1A1A2E', fontSize: 16, fontWeight: '700' }, state: { color: '#64748B', marginTop: 4 }, });
