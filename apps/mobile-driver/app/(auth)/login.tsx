import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../src/api/client';

export default function DriverLoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGetOTP = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) {
      Alert.alert('Invalid Number', 'Please enter a valid Ghana phone number');
      return;
    }

    const fullPhone = cleaned.startsWith('0') ? `+233${cleaned.slice(1)}` : `+233${cleaned}`;

    setLoading(true);
    try {
      await api.postNoAuth('/auth/request-otp', { phoneNumber: fullPhone });
      router.push({ pathname: '/(auth)/verify-otp', params: { phone: fullPhone } });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
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
          <TextInput
            style={styles.input}
            placeholder="24 XXX XXXX"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={10}
          />
        </View>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGetOTP}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Get OTP</Text>
          )}
        </TouchableOpacity>
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
  input: { flex: 1, paddingHorizontal: 8, fontSize: 16, color: '#1A1A2E' },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
