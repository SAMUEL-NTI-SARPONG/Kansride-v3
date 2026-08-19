import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../../src/stores/auth-store';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { colors } from '@kansride/ui';

const reviewMode = developmentReviewModeEnabled(process.env.NODE_ENV, process.env.EXPO_PUBLIC_UI_REVIEW_MODE);

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isAuthenticated && !reviewMode) return <Redirect href="/(main)/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
