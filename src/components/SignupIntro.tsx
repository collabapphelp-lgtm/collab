import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/lib/theme';

/** "What happens after signup" on Get Started: a 3-step timeline with step 1 marked "You're here". */
export function SignupIntro() {
  return <Timeline />;
}

const TIMELINE = [
  { title: 'Create your account', body: 'Takes under a minute' },
  { title: 'Build your creative profile', body: 'Your craft, your sound, your best work' },
  { title: 'Match and make something', body: 'Connect with creatives who fit your vision' },
];

function Timeline() {
  return (
    <View style={t.wrap} accessibilityLabel="How it works: create your account, build your creative profile, then match and make something">
      {TIMELINE.map((s, i) => {
        const active = i === 0;
        const last = i === TIMELINE.length - 1;
        return (
          <View key={s.title} style={t.row}>
            <View style={t.railCol}>
              <View style={[t.dot, active && t.dotActive]}>
                <Text style={[t.num, active && t.numActive]}>{i + 1}</Text>
              </View>
              {!last ? <View style={t.rail} /> : null}
            </View>
            <View style={[t.text, !last && { paddingBottom: 14 }]}>
              <View style={t.titleRow}>
                <Text style={[t.title, active && t.titleActive]}>{s.title}</Text>
                {active ? <Text style={t.here}>You’re here</Text> : null}
              </View>
              <Text style={t.body}>{s.body}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const t = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 12 },
  railCol: { alignItems: 'center', width: 26 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  num: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textMuted },
  numActive: { color: colors.white },
  rail: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  text: { flex: 1, paddingTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  titleActive: { color: colors.blue },
  here: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.blue,
    backgroundColor: 'rgba(75,163,199,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
});
