export const Colors = {
  bg: '#080b10',
  bg2: '#0d1117',
  bg3: '#111720',
  bg4: '#161d28',
  border: '#1e2d3d',
  border2: '#2a3f55',
  border3: '#1a2535',
  cyan: '#00d4ff',
  cyan2: '#0099bb',
  cyanAlpha: 'rgba(0,212,255,0.08)',
  green: '#22c55e',
  greenAlpha: 'rgba(34,197,94,0.12)',
  purple: '#8b5cf6',
  purpleAlpha: 'rgba(139,92,246,0.10)',
  red: '#ef4444',
  redAlpha: 'rgba(239,68,68,0.10)',
  amber: '#e8a020',
  text: '#c8d8e8',
  text2: '#6b8299',
  text3: '#3a5068',
} as const;

export const Fonts = {
  mono: 'SpaceMono',    // expo: @expo-google-fonts/space-mono
  sans: 'SpaceGrotesk', // expo: @expo-google-fonts/space-grotesk
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;