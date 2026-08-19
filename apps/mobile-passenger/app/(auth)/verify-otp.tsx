import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useRef } from 'react';
import { useAuthStore } from '../../src/stores/auth-store';
import { postPublic } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, borderRadius, colors, shadows, spacing, typography } from '@kansride/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyOTPScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const setTokens = useAuthStore((s) => s.setTokens);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (index === 5 && value) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await postPublic<{
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          phoneNumber: string;
          firstName?: string | null;
          lastName?: string | null;
        };
      }>('/auth/verify-otp', { phoneNumber: phone, code: otpCode });

      await setTokens(response.accessToken, response.refreshToken);
      useAuthStore.getState().setUser({
        id: response.user.id,
        phone: response.user.phoneNumber,
        name: [response.user.firstName, response.user.lastName]
          .filter(Boolean)
          .join(' ') || undefined,
      });

      router.replace('/(main)/home');
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.hero}>
          <View style={styles.iconShell}><Ionicons name="chatbubble-ellipses-outline" size={29} color={colors.primary} /></View>
          <Text style={styles.title}>Check your messages</Text>
          <Text style={styles.subtitle}>We sent a 6-digit verification code to{`\n`}<Text style={styles.phone}>{phone}</Text></Text>
        </View>
        <Card variant="raised" shadow="lg" padding="lg" style={styles.card}>
          <Text style={styles.codeLabel}>SECURE CODE</Text>
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref; }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value.slice(-1), i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                editable={!loading}
                autoFocus={i === 0}
                accessibilityLabel={`Code digit ${i + 1}`}
              />
            ))}
          </View>
          <Button title="Verify and continue" onPress={() => void handleVerify()} loading={loading} disabled={otp.join('').length !== 6} fullWidth size="lg" />
          <TouchableOpacity
        style={[styles.resendBtn, (loading || resending) && styles.resendDisabled]}
        onPress={async () => {
          // Surface the real outcome of the resend instead of always telling
          // the user a new code was sent. Previously a network failure or a
          // rate-limit rejection was swallowed and the success alert was shown
          // anyway, leaving the user waiting for an SMS that would never
          // arrive. Await the request and branch on the result; disable the
          // button while the resend is in flight.
          if (resending) return;
          setResending(true);
          try {
            await postPublic('/auth/request-otp', { phoneNumber: phone });
            Alert.alert('OTP Resent', 'A new code has been sent to your phone');
          } catch (err) {
            Alert.alert(
              'Resend failed',
              err instanceof Error && err.message
                ? err.message
                : 'Could not send a new code. Please try again in a moment.',
            );
          } finally {
            setResending(false);
          }
        }}
        disabled={loading || resending}
      >
            {resending && <ActivityIndicator size="small" color={colors.primary} />}
            <Text style={styles.resendText}>{resending ? 'Sending a new code…' : 'Didn’t receive it? Resend code'}</Text>
          </TouchableOpacity>
        </Card>
        <Text style={styles.help}>Codes expire for your security. Never share this code with a driver.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  backButton: { width: 46, height: 46, borderRadius: borderRadius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, ...shadows.sm },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  iconShell: { width: 64, height: 64, borderRadius: borderRadius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  phone: { color: colors.textPrimary, fontWeight: '700' },
  card: { gap: spacing.lg },
  codeLabel: { ...typography.label, color: colors.textSecondary, textAlign: 'center', letterSpacing: 1.2 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  otpBox: {
    width: 44,
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  resendBtn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  resendDisabled: { backgroundColor: colors.disabledSurface, borderRadius: borderRadius.lg },
  resendText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  help: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
});
