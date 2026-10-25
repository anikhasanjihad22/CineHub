// CineHub design tokens. One place for every colour, size and shadow in the app.
export const colors = {
  bg: '#0A0A0C',
  surface: '#141418',
  surface2: '#1C1C22',
  surface3: '#26262E',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.74)',
  muted: 'rgba(255,255,255,0.5)',
  accent: '#E50914',
  accentPressed: '#B8070F',
  onAccent: '#FFFFFF',
  gold: '#F5C518',
  success: '#3DDC84',
  danger: '#FF5A5F',
  overlay: 'rgba(0,0,0,0.6)',
  scrim: ['rgba(10,10,12,0)', 'rgba(10,10,12,0.75)', '#0A0A0C'] as const,
};

// Same as StyleSheet.absoluteFillObject (written out so it also works on newer React Native).
export const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const type = {
  h1: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 17 },
};

export const SUPPORT_URL = 'https://t.me/rnexflix';
export const APP_VERSION = '2.0.0';
