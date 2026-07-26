import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../../src/stores/auth-store';

export default function AuthLayout() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#1B8B4B" />
      </View>
    );
  }
  if (!isAuthenticated && pathname.endsWith('/register')) {
    return <Redirect href="/(auth)/login" />;
  }
  if (isAuthenticated && !pathname.endsWith('/register')) {
    return <Redirect href="/(main)/home" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
