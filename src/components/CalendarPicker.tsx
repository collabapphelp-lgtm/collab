import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts, makeStyles, useColors } from '@/lib/theme';

/** A month grid. `range` lets you tap a start day then an end day; otherwise one day is picked. */
type Props = {
  /** First and last selectable days (local midnight). Days outside are greyed out. */
  min: Date;
  max: Date;
  mode: 'single' | 'range';
  start: Date | null;
  end?: Date | null;
  onChange: (start: Date, end: Date | null) => void;
  /** About 80% of the normal size, centered (used in the event forms). */
  compact?: boolean;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function CalendarPicker({ min, max, mode, start, end, onChange, compact }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const [month, setMonth] = useState(() => {
    const base = start ?? min;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= days; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const minMs = dayMs(min);
  const maxMs = dayMs(max);
  const s = start ? dayMs(start) : null;
  const e = end ? dayMs(end) : null;
  const canPrev = new Date(month.getFullYear(), month.getMonth(), 0).getTime() >= minMs;
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime() <= maxMs;
  const todayMs = dayMs(new Date());

  function tap(d: Date) {
    if (mode === 'single') return onChange(d, null);
    const t = dayMs(d);
    // First tap (or tap before the start) starts a new range; the next tap closes it.
    if (s === null || e !== null || t < s) return onChange(d, null);
    onChange(new Date(s), d);
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => canPrev && setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          disabled={!canPrev}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={canPrev ? colors.text : colors.border} />
        </Pressable>
        <Text style={[styles.month, compact && styles.monthCompact]}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <Pressable
          onPress={() => canNext && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          disabled={!canNext}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={canNext ? colors.text : colors.border} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={[styles.cell, compact && styles.cellCompact]} />;
          const t = dayMs(d);
          const off = t < minMs || t > maxMs;
          const isStart = s === t;
          const isEnd = e === t;
          const inside = s !== null && e !== null && t > s && t < e;
          const picked = isStart || isEnd;
          return (
            <View key={i} style={[styles.cell, compact && styles.cellCompact, inside && styles.band, isStart && e !== null && styles.bandStart, isEnd && styles.bandEnd]}>
              <Pressable
                onPress={() => !off && tap(d)}
                disabled={off}
                style={[styles.day, compact && styles.dayCompact, picked && styles.dayOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: picked, disabled: off }}
                accessibilityLabel={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              >
                <Text style={[styles.dayText, compact && styles.dayTextCompact, t === todayMs && styles.today, off && styles.off, picked && styles.dayTextOn]}>{d.getDate()}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { backgroundColor: colors.white, borderRadius: 18, padding: 12, gap: 6 },
  wrapCompact: { width: '80%', alignSelf: 'center', padding: 10, gap: 4, borderRadius: 16 },
  monthCompact: { fontSize: 14 },
  cellCompact: { height: 34 },
  dayCompact: { width: 30, height: 30, borderRadius: 15 },
  dayTextCompact: { fontSize: 13 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 4 },
  month: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  band: { backgroundColor: '#E3F0F6' },
  bandStart: { backgroundColor: '#E3F0F6', borderTopLeftRadius: 21, borderBottomLeftRadius: 21 },
  bandEnd: { backgroundColor: '#E3F0F6', borderTopRightRadius: 21, borderBottomRightRadius: 21 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.blue },
  dayText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  dayTextOn: { color: colors.white, fontFamily: fonts.bodySemibold },
  today: { color: colors.blue, fontFamily: fonts.bodySemibold },
  off: { color: colors.border },
}));
