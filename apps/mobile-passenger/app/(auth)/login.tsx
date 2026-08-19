import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { postPublic } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TextInput, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGetOTP = async () => {
    const cleanPhone = phone.replace(/\s/g, '');
    if (cleanPhone.length < 9) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    const fullPhone = cleanPhone.startsWith('0')
      ? `+233${cleanPhone.slice(1)}`
      : `+233${cleanPhone}`;
    setLoading(true);

    try {
      await postPublic('/auth/request-otp', { phoneNumber: fullPhone });
      router.push({ pathname: '/(auth)/verify-otp', params: { phone: fullPhone } });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.brandMark}>
            <Ionicons name="navigate" size={29} color={colors.textInverse} />
          </View>
          <Text style={styles.eyebrow}>WELCOME TO</Text>
          <Text style={styles.logo}>KansRide</Text>
          <Text style={styles.subtitle}>Comfortable, dependable tricycle rides across Sekondi–Takoradi.</Text>
        </View>
        <Card variant="raised" shadow="lg" padding="lg" style={styles.form}>
          <Text style={styles.formTitle}>Let’s get you moving</Text>
          <Text style={styles.formCopy}>Enter your mobile number and we’ll send a secure one-time code.</Text>
          <TextInput
            label="Mobile number"
            placeholder="24 000 0000"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            editable={!loading}
            helperText="Use a Ghana mobile number"
            leftAccessory={<Text style={styles.prefix}>+233</Text>}
            accessibilityLabel="Ghana mobile number"
          />
          <Button
            title="Continue securely"
            onPress={() => void handleGetOTP()}
            loading={loading}
            fullWidth
            size="lg"
            trailing={!loading ? <Ionicons name="arrow-forward" size={18} color={colors.textInverse} /> : undefined}
          />
        </Card>
        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
          <Text style={styles.trustText}>Your number is used only to secure your KansRide account.</Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  brandMark: { width: 64, height: 64, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginBottom: spacing.md, ...shadows.md },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.8 },
  logo: { ...typography.display, color: colors.textPrimary, marginTop: 2 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center', maxWidth: 330 },
  form: { gap: spacing.sm },
  formTitle: { ...typography.h2, color: colors.textPrimary },
  formCopy: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.md },
  prefix: { ...typography.bodyBold, color: colors.primary, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border },
  trustRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.md },
  trustText: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
});
