import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

let FS: any;
try { FS = require('expo-file-system/legacy'); } catch { FS = require('expo-file-system'); }

const key = (uid: string) => `cinehub:avatar:${uid}`;

// Picture cache shared by the whole app, so a new photo shows on Home, Profile and everywhere else at the same moment.
const cache = new Map<string, string | null>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((l) => { try { l(); } catch {} });

export async function getAvatar(uid: string): Promise<string | null> {
  try {
    const uri = await AsyncStorage.getItem(key(uid));
    if (!uri) return null;
    const info = await FS.getInfoAsync(uri);
    return info.exists ? uri : null;
  } catch { return null; }
}

// Use this in any screen: returns the profile picture file (or null) and updates by itself when it changes.
export function useAvatar(uid?: string | null): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    subs.add(l);
    if (uid && !cache.has(uid)) getAvatar(uid).then((u) => { cache.set(uid, u); emit(); });
    return () => { subs.delete(l); };
  }, [uid]);
  return uid ? cache.get(uid) ?? null : null;
}

// Opens the gallery, copies the chosen picture into the app's storage and remembers it.
export async function pickAvatar(uid: string): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
  });
  if (res.canceled || !res.assets?.length) return null;
  const dir = `${FS.documentDirectory}profile/`;
  try { await FS.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
  const dest = `${dir}avatar-${uid.slice(0, 8)}-${Date.now()}.jpg`; // new name each time so the picture refreshes
  await FS.copyAsync({ from: res.assets[0].uri, to: dest });
  const old = await AsyncStorage.getItem(key(uid));
  await AsyncStorage.setItem(key(uid), dest);
  if (old) { try { await FS.deleteAsync(old, { idempotent: true }); } catch {} }
  cache.set(uid, dest);
  emit();
  return dest;
}

export async function removeAvatar(uid: string) {
  try {
    const old = await AsyncStorage.getItem(key(uid));
    await AsyncStorage.removeItem(key(uid));
    if (old) await FS.deleteAsync(old, { idempotent: true });
  } catch {}
  cache.set(uid, null);
  emit();
}
