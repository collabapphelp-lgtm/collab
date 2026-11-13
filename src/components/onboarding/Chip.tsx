import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { iconFor } from '@/components/OptionIcon';
import { colors, fonts, radius } from '@/lib/theme';

type ChipProps = {
  label: string;
  /** Ignored: emoji read as clutter in a grid. Pass `value` to get a matching line icon instead. */
  emoji?: string;
  /** Option value; roles and instruments get a small line icon. */
  value?: string;
  selected: boolean;
  onPress: () => void;
  size?: 'md' | 'sm';
};

/** Selectable pill used for skills, genres, instruments and sub-options. */
export function Chip({ label, value, selected, onPress, size = 'md' }: ChipProps) {
  const icon = iconFor(value);
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
      {icon ? <MaterialCommunityIcons name={icon} size={size === 'sm' ? 15 : 17} color={selected ? colors.blue : colors.textSecondary} /> : null}
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
  chipSelected: { borderColor: colors.blue, backgroundColor: '#E1F0F7' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  labelSm: { fontSize: 14 },
  labelSelected: { color: colors.blue, fontFamily: fonts.bodySemibold },
});
