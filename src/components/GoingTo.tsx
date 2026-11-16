import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { metaFor, whenLabel, type EventOccurrence } from '@/lib/events';
import { useEvents } from '@/lib/use-events';
import { fonts, makeStyles, useColors } from '@/lib/theme';

/** Upcoming events someone tapped "I'm going" on. Renders nothing if there are none. */
export function GoingTo({ uid, name, isSelf }: { uid: string; name: string; isSelf?: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  const { events, going } = useEvents();
  const list = (events ?? []).filter((e) => (going.get(e.key) ?? []).includes(uid)).slice(0, 3);
  if (!list.length) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{isSelf ? 'You’re going to' : `${name} is going to`}</Text>
      {list.map((e: EventOccurrence) => {
        const meta = metaFor(e);
        return (
          <Pressable
            key={e.key}
            onPress={() => router.push({ pathname: '/event/[key]', params: { key: e.key } })}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`${e.title}, ${whenLabel(e)}, ${e.venue}`}
          >
            <View style={[styles.stripe, { backgroundColor: meta.color }]} />
            <View style={styles.flex}>
              <Text style={[styles.kind, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {e.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {whenLabel(e)} · {e.venue}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        );
      })}
      {!isSelf ? <Text style={styles.hint}>Going too? Say hi there, or tap Collab and plan it together.</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  wrap: { gap: 8 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingRight: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  stripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  kind: { fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1 },
  name: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text, marginTop: 1 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
}));
