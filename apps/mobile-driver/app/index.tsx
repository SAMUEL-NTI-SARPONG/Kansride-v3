import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/auth-store';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { colors } from '@kansride/ui';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.EXPO_PUBLIC_UI_REVIEW_MODE,
);

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (!reviewMode && isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return isAuthenticated || reviewMode ? (
    <Redirect href="/(main)/home" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
