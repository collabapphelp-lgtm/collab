import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fonts, makeStyles, useColors } from '@/lib/theme';

/**
 * Pick a clock time. iPhone: Apple's spinning wheel. Android: the system clock dialog.
 * Web (UI previews only): a static look-alike so screens can be reviewed in a browser.
 *
 * `value` is minutes after midnight (0–1439).
 */
type Props = { value: number; onChange: (mins: number) => void };

const asDate = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
};
const asMins = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const clockText = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export function TimeWheel({ value, onChange }: Props) {
  const styles = useStyles();
  const colors = useColors();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.card}>
        <DateTimePicker
          value={asDate(value)}
          mode="time"
          display="spinner"
          themeVariant="light"
          textColor={colors.text}
          onChange={(_, d) => d && onChange(asMins(d))}
          style={styles.ios}
        />
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <Pressable
        onPress={() =>
          DateTimePickerAndroid.open({ value: asDate(value), mode: 'time', is24Hour: false, onChange: (_, d) => d && onChange(asMins(d)) })
        }
        style={styles.androidBtn}
        accessibilityRole="button"
      >
        <Text style={styles.androidText}>{clockText(value)}</Text>
        <Text style={styles.androidHint}>Tap to change</Text>
      </Pressable>
    );
  }

  return <WebPreviewWheel value={value} />;
}

/** Browser preview only: shows what the iPhone wheel looks like at this time. */
function WebPreviewWheel({ value }: { value: number }) {
  const styles = useStyles();
  const h = Math.floor(value / 60);
  const m = value % 60;
  const hours = [-2, -1, 0, 1, 2].map((o) => (((((h % 12) || 12) - 1 + o + 12) % 12) + 1));
  const mins = [-2, -1, 0, 1, 2].map((o) => String((m + o + 60) % 60).padStart(2, '0'));
  const ampm = h < 12 ? ['', '', 'AM', 'PM', ''] : ['', 'AM', 'PM', '', ''];
  const col = (items: (string | number)[], w: number) => (
    <View style={{ width: w, alignItems: 'center' }}>
      {items.map((t, i) => (
        <Text key={i} style={[styles.wheelText, i === 2 ? styles.wheelOn : i === 1 || i === 3 ? styles.wheelNear : styles.wheelFar]}>
          {t}
        </Text>
      ))}
    </View>
  );
  return (
    <View style={styles.card}>
      <View style={styles.wheel}>
        <View style={styles.wheelBand} />
        {col(hours, 60)}
        {col(mins, 60)}
        {col(ampm, 60)}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden', alignItems: 'center' },
  ios: { height: 180, alignSelf: 'stretch' },
  androidBtn: { backgroundColor: colors.white, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  androidText: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  androidHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  wheel: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, gap: 6, position: 'relative' },
  wheelBand: { position: 'absolute', left: 12, right: 12, top: 10 + 2 * 32, height: 32, borderRadius: 8, backgroundColor: '#EEF0F3' },
  wheelText: { height: 32, lineHeight: 32, fontFamily: fonts.body, color: colors.text },
  wheelOn: { fontSize: 21, fontFamily: fonts.bodyMedium },
  wheelNear: { fontSize: 18, opacity: 0.45 },
  wheelFar: { fontSize: 15, opacity: 0.2 },
}));
