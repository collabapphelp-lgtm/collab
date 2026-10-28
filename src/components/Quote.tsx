import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

/** The collaboration quotes, each used on one screen. */
export const QUOTES = {
  keller: { text: 'Alone, we can do so little; together, we can do so much.', author: 'Helen Keller' },
  maxwell: { text: 'Collaboration is multiplication.', author: 'John C. Maxwell' },
  // Widely shared but with no verifiable source, so it's shown without a name.
  ocean: { text: 'Individually, we are one drop. Together, we are an ocean.', author: undefined },
} as const;

type Props = { quote: { text: string; author?: string }; style?: ViewStyle; tone?: 'dark' | 'light' };

/** Quiet, centered quote for screens with breathing room. */
export function Quote({ quote, style, tone = 'dark' }: Props) {
  const light = tone === 'light';
  return (
    <View style={[styles.wrap, style]} accessible accessibilityLabel={`${quote.text}${quote.author ? `, ${quote.author}` : ''}`}>
      <Text style={[styles.mark, light && { color: 'rgba(255,255,255,0.6)' }]}>“</Text>
      <Text style={[styles.text, light && { color: colors.white }]}>{quote.text}</Text>
      {quote.author ? <Text style={[styles.author, light && { color: 'rgba(255,255,255,0.8)' }]}>— {quote.author}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 12 },
  mark: { fontFamily: fonts.heading, fontSize: 40, lineHeight: 40, color: colors.purple, marginBottom: -8 },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  author: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 8 },
});
