import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { useAuthStore } from '../../src/stores/auth-store';

export default function VerifyOTPScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleVerify = () => {
    // TODO: Call API to verify OTP
    setAuthenticated(true);
    router.replace('/(main)/home');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}</Text>
      <View style={styles.otpRow}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.otpBox}>
            <Text style={styles.otpDigit}>{otp[i] || ''}</Text>
          </View>
        ))}
      </View>
      <View style={styles.button}>
        <Text style={styles.buttonText} onPress={handleVerify}>
          Verify
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
