import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../../src/stores/auth-store';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#1B8B4B" />
      </View>
    );
  }
  if (isAuthenticated) return <Redirect href="/(main)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
