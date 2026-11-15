import { LinearGradient as ExpoLinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import { darkSurface, useScheme } from '@/lib/theme';

/**
 * expo-linear-gradient, but light washes (pastel page backgrounds, cream fades) turn into dark
 * surfaces in dark mode. Brand colors, photo shades and already-dark gradients are left as they are.
 */
export function LinearGradient(props: LinearGradientProps) {
  const dark = useScheme() === 'dark';
  const colors = dark ? (props.colors.map((c) => (typeof c === 'string' ? darkSurface(c) : c)) as unknown as LinearGradientProps['colors']) : props.colors;
  return <ExpoLinearGradient {...props} colors={colors} />;
}
