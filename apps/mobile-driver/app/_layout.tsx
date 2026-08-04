import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuthStore } from '../src/stores/auth-store';
import { useDriverStore } from '../src/stores/driver-store';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30000 } },
});

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrateActiveRide = useDriverStore((s) => s.hydrateActiveRide);

  useEffect(() => {
    void initialize();
    void hydrateActiveRide();
  }, [initialize, hydrateActiveRide]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
