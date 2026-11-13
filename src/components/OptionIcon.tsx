import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Clean line icons for the big option rows/cards (chips stay text-only). */
const ICONS: Record<string, IconName> = {
  musician: 'musical-notes-outline',
  content: 'videocam-outline',
  instrumentalist: 'musical-note-outline',
  vocalist: 'mic-outline',
  producer: 'laptop-outline',
  dj: 'disc-outline',
  songwriter: 'create-outline',
  engineer: 'options-outline',
  streamer: 'tv-outline',
  longform: 'film-outline',
  shortform: 'phone-portrait-outline',
  podcast: 'radio-outline',
  photographer: 'camera-outline',
  videographer: 'videocam-outline',
  editor: 'cut-outline',
};

export function OptionIcon(props: { value: string; fallback?: string; size?: number; selected?: boolean }) {
  const size = props.size ?? 36;
  const name = ICONS[props.value];
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        props.selected ? styles.on : styles.off,
      ]}
    >
      {name ? (
        <Ionicons name={name} size={Math.round(size * 0.52)} color={props.selected ? colors.white : colors.blue} />
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
