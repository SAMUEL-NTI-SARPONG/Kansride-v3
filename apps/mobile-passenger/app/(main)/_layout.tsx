import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth-store';
import { developmentReviewModeEnabled } from '@kansride/config/mobile-runtime';
import { colors, layout, shadows, typography } from '@kansride/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const reviewMode = developmentReviewModeEnabled(
  process.env.NODE_ENV,
  process.env.EXPO_PUBLIC_UI_REVIEW_MODE,
);

export default function MainLayout() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuthStore();
  if (!reviewMode && isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!reviewMode && !isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { ...typography.caption, fontWeight: '700', marginTop: 2 },
        tabBarStyle: {
          height: layout.bottomTabContentHeight + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          ...shadows.md,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'time' : 'time-outline'} size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ride/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="ride-detail/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="saved-places"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="safety"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="support"
        options={{ href: null }}
      />
    </Tabs>
  );
}
