import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/lib/theme';
import { OptionIcon } from '@/components/OptionIcon';

type Props = {
  label: string;
  emoji: string;
  /** Option value, used to pick a line icon (falls back to the emoji). */
  value?: string;
  selected: boolean;
  onPress: () => void;
  /** Extra line under the label (e.g. "Guitar, Drums"). */
  detail?: string;
  /** Shown under the row when selected, e.g. sub-option chips. */
  children?: ReactNode;
  expandable?: boolean;
};

/** Full-width selectable row. Expandable rows reveal their children once selected. */
export function OptionRow({ label, emoji, value, selected, onPress, detail, children, expandable }: Props) {
  return (
    <View style={[styles.wrap, selected && styles.wrapSelected]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, expanded: expandable ? selected : undefined }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <OptionIcon value={value ?? ''} fallback={emoji} size={36} selected={selected} />
        <View style={styles.text}>
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      </Pressable>
      {selected && children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  wrapSelected: { borderColor: colors.blue, backgroundColor: '#F1F8FB' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  text: { flex: 1 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
  labelSelected: { fontFamily: fonts.bodySemibold, color: colors.blue },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  checkMark: { color: colors.white, fontSize: 13, fontFamily: fonts.bodySemibold, marginTop: -1 },
  children: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
});
