import { Alert, Linking } from 'react-native';
import { SUPPORT_URL } from '../theme';

// Opens the Telegram support chat.
export async function openSupport() {
  try {
    await Linking.openURL(SUPPORT_URL);
  } catch {
    Alert.alert('Support', `Open this link in Telegram:\n${SUPPORT_URL}`);
  }
}
