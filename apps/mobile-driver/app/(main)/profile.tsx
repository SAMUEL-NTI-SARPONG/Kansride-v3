import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDriverStore } from '../../src/stores/driver-store';
import { api } from '../../src/api/client';
import * as socketClient from '../../src/api/socket';
import { stopLocationWatch } from '../../src/services/location';
import { Card, ListItem, StatusBadge, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { useDriverInsets } from '../../src/ui/use-driver-insets';

interface UserProfile { id: string; phoneNumber: string; firstName?: string; lastName?: string; role: string }
interface DriverProfile { isDriver: boolean; driverId?: string; rating?: string; completedRides?: number; vehicle?: { registrationNumber?: string; colour?: string; type?: string } | null }

export default function DriverProfileScreen() {
  const insets = useDriverInsets();
  const logout = useAuthStore((s) => s.logout);
  const driverReset = useDriverStore((s) => s.reset);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void (async () => {
    try {
      const [user, driver] = await Promise.all([api.get<UserProfile>('/users/me'), api.get<DriverProfile>('/drivers/me')]);
      setUserProfile(user); setDriverProfile(driver);
    } catch {
      const reviewUser = useAuthStore.getState().user;
      if (reviewUser?.id === 'ui-review-driver') {
        setUserProfile({ id: reviewUser.id, phoneNumber: reviewUser.phoneNumber, role: reviewUser.role, firstName: 'Kwame', lastName: 'Mensah' });
        setDriverProfile({ isDriver: true, driverId: reviewUser.id, rating: '4.8', completedRides: 86, vehicle: { registrationNumber: 'WR 0000-26', colour: 'Green', type: 'Tricycle' } });
      }
    } finally { setLoading(false); }
  })(); }, []);

  const handleLogout = () => Alert.alert('Log out', 'Do you want to end this driver session?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: async () => { socketClient.disconnect(); stopLocationWatch(); driverReset(); await logout(); router.replace('/(auth)/login'); } }]);

  if (loading) return <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  const displayName = userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim() : 'Driver';

  return <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>DRIVER ACCOUNT</Text><Text style={styles.title}>Profile</Text>
    <Card variant="raised" shadow="md" padding="md" style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{displayName.charAt(0)}</Text></View><View style={styles.identity}><Text style={styles.name}>{displayName}</Text><Text style={styles.phone}>{userProfile?.phoneNumber || '+233 XX XXX XXXX'}</Text><StatusBadge label="Approved driver" tone="success" dot /></View></Card>
    <View style={styles.stats}><View><Text style={styles.statValue}>{driverProfile?.rating || '--'}</Text><Text style={styles.statLabel}>rating</Text></View><View style={styles.divider} /><View><Text style={styles.statValue}>{driverProfile?.completedRides ?? 0}</Text><Text style={styles.statLabel}>completed rides</Text></View></View>
    {driverProfile?.vehicle && <Card variant="outline" shadow="none" padding="md" style={styles.vehicleCard}><View style={styles.vehicleIcon}><Ionicons name="car-sport-outline" size={24} color={colors.primary} /></View><View style={styles.vehicleCopy}><Text style={styles.vehicleTitle}>{driverProfile.vehicle.colour || ''} {driverProfile.vehicle.type || 'Tricycle'}</Text><Text style={styles.vehiclePlate}>{driverProfile.vehicle.registrationNumber || 'Plate unavailable'}</Text></View><StatusBadge label="Verified" tone="success" /></Card>}
    <Text style={styles.section}>DRIVER TOOLS</Text><Card variant="outline" shadow="none" padding="xs" style={styles.menu}><ListItem title="Documents" subtitle="Licence and vehicle verification" leading={<View style={styles.menuIcon}><Ionicons name="document-text-outline" size={20} color={colors.primary} /></View>} trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />} onPress={() => Alert.alert('Documents', 'Document management is handled by the pilot operations team.')} /><View style={styles.menuDivider} /><ListItem title="Safety and support" subtitle="Get help from KansRide operations" leading={<View style={styles.menuIcon}><Ionicons name="headset-outline" size={20} color={colors.primary} /></View>} trailing={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />} onPress={() => Alert.alert('Support', 'Use your configured pilot support channel.')} /></Card>
    <ListItem title="Log out" leading={<Ionicons name="log-out-outline" size={21} color={colors.error} />} onPress={handleLogout} style={styles.logout} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: spacing.lg }, centered: { alignItems: 'center', justifyContent: 'center' }, eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.2 }, title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, avatar: { width: 60, height: 60, borderRadius: borderRadius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.sm }, avatarText: { ...typography.h2, color: colors.textInverse }, identity: { flex: 1, alignItems: 'flex-start', gap: 3 }, name: { ...typography.h3, color: colors.textPrimary }, phone: { ...typography.small, color: colors.textSecondary },
  stats: { marginTop: 12, padding: spacing.md, borderRadius: borderRadius.xl, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, statValue: { ...typography.h3, color: colors.primaryDark, textAlign: 'center' }, statLabel: { ...typography.caption, color: colors.textSecondary }, divider: { width: 1, height: 36, backgroundColor: colors.primarySoftBorder },
  vehicleCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, vehicleIcon: { width: 46, height: 46, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, vehicleCopy: { flex: 1 }, vehicleTitle: { ...typography.bodyBold, color: colors.textPrimary }, vehiclePlate: { ...typography.small, color: colors.textSecondary },
  section: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.sm }, menu: { overflow: 'hidden' }, menuIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 68 }, logout: { marginTop: spacing.lg, backgroundColor: colors.errorSoft },
});
