import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Quote, QUOTES } from '@/components/Quote';
import { useAuth } from '@/lib/auth-context';
import { getProfile } from '@/lib/discover';
import type { UserProfile } from '@/lib/types';
import { colors, fonts } from '@/lib/theme';

// "It's a match!" — shown over Discover right after a mutual like.
export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();
  const [them, setThem] = useState<UserProfile | null>(null);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (id) getProfile(id).then(setThem).catch(() => {});
  }, [id]);

  return (
    <LinearGradient colors={['rgba(75,163,199,0.97)', 'rgba(163,153,199,0.97)']} style={styles.fill}>
      <View style={styles.content}>
        <View style={styles.avatars}>
          <Avatar uri={me?.photoURL} name={me?.firstName ?? ''} seed={me?.id ?? 'me'} size={116} style={[styles.avatar, styles.left]} />
          <Avatar uri={them?.photoURL} name={them?.firstName ?? ''} seed={them?.id ?? 'them'} size={116} style={[styles.avatar, styles.right]} />
        </View>

        <Text style={styles.title}>It’s a match!</Text>
        <Text style={styles.body}>
          You and {them?.firstName ?? 'this creative'} both want to collab. Say hi and start making something.
        </Text>

        <Quote quote={QUOTES.maxwell} tone="light" style={{ marginTop: 28 }} />
      </View>

      <View style={styles.buttons}>
        <Button title="Send a message" onPress={() => router.replace('/messages')} />
        <Button title="Keep browsing" variant="secondary" onPress={() => router.back()} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, padding: 24, paddingTop: 80, paddingBottom: 48, justifyContent: 'space-between' },
  content: { alignItems: 'center', gap: 12 },
  avatars: { flexDirection: 'row', marginBottom: 20 },
  avatar: { borderWidth: 4, borderColor: colors.white },
  left: { transform: [{ rotate: '-8deg' }], marginRight: -18 },
  right: { transform: [{ rotate: '8deg' }] },
  title: { fontFamily: fonts.heading, fontSize: 40, color: colors.white, textAlign: 'center' },
  body: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24, color: colors.white, textAlign: 'center', maxWidth: 320 },
  buttons: { gap: 12 },
});
