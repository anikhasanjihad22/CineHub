import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

let FS: any;
try { FS = require('expo-file-system/legacy'); } catch { FS = require('expo-file-system'); }

// Profile photo kept on this phone only (nothing is uploaded).
const key = (uid: string) => `cinehub:avatar:${uid}`;

export async function getAvatar(uid: string): Promise<string | null> {
  try {
    const uri = await AsyncStorage.getItem(key(uid));
    if (!uri) return null;
    const info = await FS.getInfoAsync(uri);
    return info.exists ? uri : null;
  } catch { return null; }
}

// Opens the gallery, copies the chosen picture into the app's storage and remembers it.
export async function pickAvatar(uid: string): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
  });
  if (res.canceled || !res.assets?.length) return null;
  const dir = `${FS.documentDirectory}profile/`;
  try { await FS.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
  const dest = `${dir}avatar-${uid.slice(0, 8)}-${Date.now()}.jpg`; // new name each time so the picture refreshes
  await FS.copyAsync({ from: res.assets[0].uri, to: dest });
  const old = await AsyncStorage.getItem(key(uid));
  await AsyncStorage.setItem(key(uid), dest);
  if (old) { try { await FS.deleteAsync(old, { idempotent: true }); } catch {} }
  return dest;
}

export async function removeAvatar(uid: string) {
  try {
    const old = await AsyncStorage.getItem(key(uid));
    await AsyncStorage.removeItem(key(uid));
    if (old) await FS.deleteAsync(old, { idempotent: true });
  } catch {}
}
