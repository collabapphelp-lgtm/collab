import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/lib/theme';

type ChipProps = {
  label: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  size?: 'md' | 'sm';
};

/** Selectable pill used for skills, genres, instruments and sub-options. */
export function Chip({ label, emoji, selected, onPress, size = 'md' }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' && styles.chipSm,
        selected && styles.chipSelected,
        pressed && { opacity: 0.7 },
      ]}
    >
      {emoji ? <Text style={size === 'sm' ? styles.emojiSm : styles.emoji}>{emoji}</Text> : null}
      <Text style={[styles.label, size === 'sm' && styles.labelSm, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSm: { paddingHorizontal: 12, paddingVertical: 7, gap: 5 },
  chipSelected: { borderColor: colors.blue, backgroundColor: 'rgba(75,163,199,0.12)' },
  emoji: { fontSize: 16 },
  emojiSm: { fontSize: 14 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  labelSm: { fontSize: 14 },
  labelSelected: { color: colors.blue, fontFamily: fonts.bodySemibold },
});
