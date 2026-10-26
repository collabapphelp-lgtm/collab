// Collab brand tokens — kept in sync with the web prototype's CSS variables.
export const colors = {
  yellow: '#E5C547',
  gold: '#F5B731',
  blue: '#4BA3C7',
  purple: '#A399C7',
  red: '#E54B4B',
  orange: '#D97742',
  teal: '#4DBFBF',

  bg: '#FFFFFF',
  bgSecondary: '#F8F9FA',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E8E8E8',
  white: '#FFFFFF',
};

export const gradients = {
  welcome: ['#C5DAE8', '#E8E5DC'] as const,
  primaryButton: [colors.yellow, colors.gold] as const,
};

export const radius = { sm: 8, md: 16, full: 999 };

export const fonts = {
  // Loaded in src/app/_layout.tsx
  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemibold: 'Outfit_600SemiBold',
  heading: 'SpaceGrotesk_700Bold',
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
};
