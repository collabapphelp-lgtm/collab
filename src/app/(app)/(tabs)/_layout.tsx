import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts, makeStyles, useColors } from '@/lib/theme';
import { useMatches } from '@/lib/use-matches';
import { useLikedYou } from '@/lib/liked-you';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Active tab gets a filled icon on a soft tinted pill.
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <TabPill on={on} off={off} color={color} focused={focused} />;
  };

function TabPill({ on, off, color, focused }: { on: IconName; off: IconName; color: ColorValue; focused: boolean }) {
  const styles = useStyles();
  return (
      <View style={[styles.pill, focused && styles.pillOn]}>
        <Ionicons name={focused ? on : off} size={27} color={color as string} />
      </View>
  );
}

export default function TabsLayout() {
  const styles = useStyles();
  const colors = useColors();
  const { unreadCount } = useMatches();
  const { likedYou } = useLikedYou();
  const likedCount = likedYou?.length ?? 0;
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: '#8A8F98',
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 6 },
        tabBarStyle: [styles.bar, { height: 74 + insets.bottom, paddingBottom: Math.max(insets.bottom, 10) }],
        tabBarBadgeStyle: styles.badge,
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen name="events" options={{ title: 'Events', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Collabs',
          tabBarIcon: icon('chatbubbles', 'chatbubbles-outline'),
          // Unread chats + group invites, or (if none) people waiting on your answer in purple.
          tabBarBadge: unreadCount > 0 ? unreadCount : likedCount > 0 ? likedCount : undefined,
          tabBarBadgeStyle: [styles.badge, unreadCount === 0 && likedCount > 0 && { backgroundColor: colors.purple }],
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: 0,
    shadowColor: '#2A3B4D',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  pill: { width: 52, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: 'rgba(75,163,199,0.14)' },
  label: { fontFamily: fonts.bodySemibold, fontSize: 11, marginTop: 4 },
  badge: { backgroundColor: colors.red, fontFamily: fonts.bodySemibold, fontSize: 11, top: 2 },
}));
