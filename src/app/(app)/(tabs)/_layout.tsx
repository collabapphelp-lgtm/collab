import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '@/lib/theme';
import { useMatches } from '@/lib/use-matches';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? on : off} size={size} color={color as string} />;
  };

export const unstable_settings = { initialRouteName: 'discover' };

export default function TabsLayout() {
  const { unreadCount } = useMatches();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen name="connections" options={{ title: 'Connections', tabBarIcon: icon('people', 'people-outline') }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: icon('chatbubbles', 'chatbubbles-outline'),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.red, fontFamily: fonts.bodySemibold, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
