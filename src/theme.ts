// CineHub design tokens. One place for every colour, size and shadow in the app.
import { Platform } from 'react-native';

export const colors = {
  bg: '#000000',
  surface: '#111114',
  surface2: '#1B1B20',
  surface3: '#2A2A31',
  glass: 'rgba(28,28,32,0.94)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.76)',
  muted: 'rgba(255,255,255,0.5)',
  accent: '#E50914',
  accentSoft: 'rgba(229,9,20,0.16)',
  accentPressed: '#B8070F',
  onAccent: '#FFFFFF',
  gold: '#F5C518',
  success: '#32D74B',
  danger: '#FF453A',
  overlay: 'rgba(0,0,0,0.6)',
  scrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)', '#000000'] as const,
};

export const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

// iOS-like generous corners
export const radius = { xs: 8, sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const type = {
  large: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  h1: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 12, lineHeight: 17 },
};

export const shadow = Platform.select({
  android: { elevation: 12 },
  default: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
}) as any;

// Space kept at the bottom of every tab page so the floating tab bar never covers content.
export const NAV_SPACE = 112;

export const SUPPORT_URL = 'https://t.me/rnexflix';
// Keep in sync with "version" in app.json. The update system compares this number with the server.
export const APP_VERSION = '3.0.0';
