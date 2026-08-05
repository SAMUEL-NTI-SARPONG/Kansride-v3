import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuthStore } from '../../src/stores/auth-store';

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#1B8B4B" />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarActiveTintColor: '#1B8B4B' }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
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
