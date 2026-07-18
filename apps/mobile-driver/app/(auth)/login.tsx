import { View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';

export default function DriverLoginScreen() {
  const [phone, setPhone] = useState('');

  const handleGetOTP = () => {
    router.push({ pathname: '/(auth)/verify-otp', params: { phone } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>KansRide</Text>
        <Text style={styles.badge}>DRIVER</Text>
        <Text style={styles.subtitle}>Earn with your tricycle</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.phoneInput}>
          <Text style={styles.prefix}>+233</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.placeholder}>Enter your phone number</Text>
          </View>
        </View>
        <View style={styles.button}>
          <Text style={styles.buttonText} onPress={handleGetOTP}>
            Get OTP
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB', padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 36, fontWeight: '700', color: '#1B8B4B' },
  badge: {
    backgroundColor: '#FFB800',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  subtitle: { fontSize: 16, color: '#64748B', marginTop: 8 },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 52,
  },
  prefix: { paddingHorizontal: 16, fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  inputWrapper: { flex: 1, paddingHorizontal: 8 },
  placeholder: { color: '#94A3B8', fontSize: 16 },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
