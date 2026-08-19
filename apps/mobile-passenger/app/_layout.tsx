import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuthStore } from '../src/stores/auth-store';
import { useRideStore } from '../src/stores/ride-store';
import { colors } from '@kansride/ui';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30000 } },
});

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrateActiveRide = useRideStore((state) => state.hydrateActiveRide);

  useEffect(() => {
    void hydrate();
    void hydrateActiveRide();
  }, [hydrate, hydrateActiveRide]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
