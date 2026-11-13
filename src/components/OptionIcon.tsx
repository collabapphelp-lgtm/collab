import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@/lib/theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * One consistent set of single-color line icons for roles and instruments.
 * (Emoji differ in color/style per phone and read as clutter in a grid; these stay calm and scannable.)
 */
const ICONS: Record<string, IconName> = {
  // paths
  musician: 'music',
  content: 'video-vintage',
  // musician roles
  instrumentalist: 'music-note',
  vocalist: 'microphone-variant',
  producer: 'laptop',
  dj: 'album',
  songwriter: 'pencil',
  engineer: 'tune-vertical',
  // content roles
  streamer: 'television-classic',
  longform: 'youtube',
  shortform: 'cellphone',
  podcast: 'podcast',
  photographer: 'camera',
  videographer: 'video-vintage',
  editor: 'content-cut',
  // instruments
  guitar: 'guitar-acoustic',
  piano: 'piano',
  bass: 'guitar-electric',
  strings: 'violin',
  percussion: 'instrument-triangle',
  woodwinds: 'saxophone',
  brass: 'trumpet',
  // profile types
  individual: 'account',
  group: 'account-group',
};

export function iconFor(value?: string): IconName | undefined {
  return value ? ICONS[value] : undefined;
}

/** Round icon badge for big option rows/cards. */
export function OptionIcon(props: { value: string; fallback?: string; size?: number; selected?: boolean }) {
  const size = props.size ?? 36;
  const name = iconFor(props.value);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, props.selected ? styles.on : styles.off]}>
      {name ? (
        <MaterialCommunityIcons name={name} size={Math.round(size * 0.52)} color={props.selected ? colors.white : colors.blue} />
      ) : (
        <Text style={{ fontSize: size * 0.5 }}>{props.fallback}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  off: { backgroundColor: '#E6F1F7' },
  on: { backgroundColor: colors.blue },
});
