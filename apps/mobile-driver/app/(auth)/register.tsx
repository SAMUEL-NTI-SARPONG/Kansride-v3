import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { useDriverStore } from '../../src/stores/driver-store';

export default function DriverRegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleColour, setVehicleColour] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const setDriverId = useDriverStore((s) => s.setDriverId);

  const handleRegister = async () => {
    if (!fullName.trim() || !plateNumber.trim() || !vehicleColour.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<{ driverId: string; message: string }>('/drivers/register', {
        licenseNumber: licenseNumber || 'N/A',
        vehicleRegistration: plateNumber,
        vehicleColour: vehicleColour,
        vehicleMake: 'Tricycle',
        vehicleModel: fullName,
      });

      setDriverId(response.driverId);
      Alert.alert('Success', response.message || 'Registration submitted!', [
        { text: 'OK', onPress: () => router.replace('/(main)/home') },
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Could not register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Driver Registration</Text>
      <Text style={styles.subtitle}>Complete your profile to start earning</Text>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#94A3B8"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.vehicleType}>
            <Text style={styles.vehicleTypeText}>Tricycle (Pragya)</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Plate Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. GR-1234-22"
            placeholderTextColor="#94A3B8"
            value={plateNumber}
            onChangeText={setPlateNumber}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Vehicle Colour</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Yellow"
            placeholderTextColor="#94A3B8"
            value={vehicleColour}
            onChangeText={setVehicleColour}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>License Number (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Driver's license number"
            placeholderTextColor="#94A3B8"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Register as Driver</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1A2E' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 32 },
  form: { gap: 20 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
  },
  vehicleType: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1B8B4B',
  },
  vehicleTypeText: { fontSize: 16, color: '#1B8B4B', fontWeight: '600' },
  button: {
    backgroundColor: '#1B8B4B',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
