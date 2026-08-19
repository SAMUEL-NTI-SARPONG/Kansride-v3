import { View, Text, TextInput, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { useDriverStore } from '../../src/stores/driver-store';
import { useAuthStore } from '../../src/stores/auth-store';
import { Button, Card, borderRadius, colors, spacing, typography } from '@kansride/ui';
import { useDriverInsets } from '../../src/ui/use-driver-insets';

export default function DriverRegisterScreen() {
  const insets = useDriverInsets();
  const [fullName, setFullName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleColour, setVehicleColour] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const setDriverId = useDriverStore((s) => s.setDriverId);
  const logout = useAuthStore((s) => s.logout);

  const handleRegister = async () => {
    if (
      !fullName.trim()
      || !plateNumber.trim()
      || !vehicleColour.trim()
      || !vehicleMake.trim()
      || !vehicleModel.trim()
      || !licenseNumber.trim()
    ) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const [firstName, ...lastNameParts] = fullName.trim().split(/\s+/);
      const response = await api.post<{ driverId: string; message: string }>('/drivers/register', {
        firstName,
        lastName: lastNameParts.join(' ') || undefined,
        licenseNumber,
        vehicleRegistration: plateNumber,
        vehicleColour: vehicleColour,
        vehicleMake,
        vehicleModel,
      });

      setDriverId(response.driverId);
      Alert.alert('Success', response.message || 'Registration submitted!', [
        {
          text: 'OK',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Could not register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={styles.eyebrow}>DRIVER APPLICATION</Text><Text style={styles.title}>Tell us about you</Text>
      <Text style={styles.subtitle}>Complete your driver and tricycle details for review.</Text>

      <Card variant="raised" shadow="md" padding="lg" style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Vehicle Make</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. TVS"
            placeholderTextColor={colors.textMuted}
            value={vehicleMake}
            onChangeText={setVehicleMake}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Vehicle Model</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. King Deluxe"
            placeholderTextColor={colors.textMuted}
            value={vehicleModel}
            onChangeText={setVehicleModel}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textMuted}
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
            placeholderTextColor={colors.textMuted}
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
            placeholderTextColor={colors.textMuted}
            value={vehicleColour}
            onChangeText={setVehicleColour}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>License Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Driver's license number"
            placeholderTextColor={colors.textMuted}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />
        </View>

        <Button title="Submit driver application" onPress={() => void handleRegister()} loading={loading} fullWidth size="lg" />
      </Card>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  eyebrow: { ...typography.label, color: colors.primary, letterSpacing: 1.2 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.small, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  form: { gap: spacing.md },
  field: { gap: 6 },
  label: { ...typography.small, fontWeight: '600', color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },
  vehicleType: {
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.lg,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  vehicleTypeText: { fontSize: 16, color: colors.primaryDark, fontWeight: '600' },
});
