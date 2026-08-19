import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/auth-store';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { colors } from '@kansride/ui';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.EXPO_PUBLIC_UI_REVIEW_MODE,
);

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (!reviewMode && isLoading) {
    return (
      <View style={styles.loader}>
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

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
