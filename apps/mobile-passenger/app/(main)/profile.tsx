import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { get } from '../../src/api/client';
import { disconnectSocket } from '../../src/api/socket';
import { Ionicons } from '@expo/vector-icons';
import { Card, ListItem, StatusBadge, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { usePassengerInsets } from '../../src/ui/use-passenger-insets';

interface UserProfile {
  id: string;
  phone: string;
  name?: string;
  totalRides?: number;
  createdAt?: string;
}

export default function ProfileScreen() {
  const insets = usePassengerInsets();
  const { user, setUser, logout } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await get<UserProfile>('/users/me');
        setProfile(data);
        setUser({ id: data.id, phone: data.phone, name: data.name, totalRides: data.totalRides });
      } catch {
        // Use cached user data if available
        if (user) {
          setProfile({ id: user.id, phone: user.phone, name: user.name, totalRides: user.totalRides });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          disconnectSocket();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
      <Text style={styles.title}>Profile</Text>
      <Card variant="raised" shadow="md" padding="md" style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.name || 'P').charAt(0).toUpperCase()}</Text></View>
        <View style={styles.identity}><Text style={styles.name}>{profile?.name || 'Passenger'}</Text><Text style={styles.phone}>{profile?.phone || 'No phone number'}</Text><StatusBadge label="Verified passenger" tone="success" dot /></View>
      </Card>
      <View style={styles.statsCard}>
        <View><Text style={styles.statValue}>{profile?.totalRides ?? 0}</Text><Text style={styles.statLabel}>completed rides</Text></View>
        <View style={styles.statDivider} />
        <View><Text style={styles.statValue}>KansRide</Text><Text style={styles.statLabel}>trusted travel</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Your preferences</Text>
      <Card shadow="none" variant="outline" padding="xs" style={styles.menuCard}>
        <ListItem title="Saved places" subtitle="Home, work and favourite stops" leading={<View style={styles.menuIcon}><Ionicons name="bookmark-outline" size={20} color={colors.primary} /></View>} trailing={<Ionicons name="chevron-forward" size={19} color={colors.textMuted} />} onPress={() => router.push('/(main)/saved-places')} />
        <View style={styles.menuDivider} />
        <ListItem title="Safety centre" subtitle="Trip sharing and emergency options" leading={<View style={styles.menuIcon}><Ionicons name="shield-checkmark-outline" size={21} color={colors.primary} /></View>} trailing={<Ionicons name="chevron-forward" size={19} color={colors.textMuted} />} onPress={() => router.push('/(main)/safety')} />
        <View style={styles.menuDivider} />
        <ListItem title="Help and support" subtitle="Contact available support channels" leading={<View style={styles.menuIcon}><Ionicons name="headset-outline" size={21} color={colors.primary} /></View>} trailing={<Ionicons name="chevron-forward" size={19} color={colors.textMuted} />} onPress={() => router.push('/(main)/support')} />
        <View style={styles.menuDivider} />
        <ListItem title="Payment methods" subtitle="Unavailable during the controlled pilot" leading={<View style={styles.menuIcon}><Ionicons name="wallet-outline" size={21} color={colors.textMuted} /></View>} trailing={<StatusBadge label="Coming later" />} onPress={() => Alert.alert('Payment methods unavailable', 'Passenger payments are not available during the controlled pilot.')} />
      </Card>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityRole="button"><Ionicons name="log-out-outline" size={20} color={colors.error} /><Text style={styles.logoutText}>Log out</Text></TouchableOpacity>
      <Text style={styles.version}>KansRide Passenger · V1 controlled pilot</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.3 },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: 2, marginBottom: spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: borderRadius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.sm },
  avatarText: { ...typography.h2, color: colors.textInverse },
  identity: { flex: 1, alignItems: 'flex-start', gap: 3 },
  name: { ...typography.h3, color: colors.textPrimary },
  phone: { ...typography.small, color: colors.textSecondary, marginBottom: 4 },
  statsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: spacing.md, padding: spacing.md, borderRadius: borderRadius.xl, backgroundColor: colors.primarySoft },
  statValue: { ...typography.h3, color: colors.primaryDark, textAlign: 'center' },
  statLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  statDivider: { width: 1, height: 38, backgroundColor: colors.primarySoftBorder },
  sectionTitle: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.sm, letterSpacing: 0.5 },
  menuCard: { overflow: 'hidden' },
  menuIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 68 },
  logoutBtn: { minHeight: 52, marginTop: spacing.lg, borderRadius: borderRadius.xl, backgroundColor: colors.errorSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  logoutText: { ...typography.bodyBold, color: colors.error },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
