import { Platform } from 'react-native';

// True on Android TV / Google TV boxes (the system tells the app it runs in "tv" UI mode).
export const isTV: boolean =
  (Platform as any).isTV === true ||
  (Platform.OS === 'android' && (Platform as any).constants?.uiMode === 'tv');
