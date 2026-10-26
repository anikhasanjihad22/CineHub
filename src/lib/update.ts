import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { APP_VERSION } from '../theme';

let FS: any;
try { FS = require('expo-file-system/legacy'); } catch { FS = require('expo-file-system'); }

// One row in Supabase (table app_config) tells every phone which version is current.
//   version < min_version     -> the app is blocked until the person updates (forced update)
//   version < latest_version  -> a friendly "Update available" card that can be skipped
export type AppConfig = { latest_version: string; min_version: string; apk_url: string | null; notes: string | null };
export type UpdateState = 'ok' | 'optional' | 'required';

const KEY = 'cinehub:appconfig:v1';

export function compareVersions(a: string, b: string): number {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function stateOf(cfg: AppConfig | null): UpdateState {
  if (!cfg) return 'ok';
  if (compareVersions(APP_VERSION, cfg.min_version) < 0) return 'required';
  if (compareVersions(APP_VERSION, cfg.latest_version) < 0) return 'optional';
  return 'ok';
}

export async function fetchConfig(): Promise<AppConfig | null> {
  try {
    const { data, error } = await supabase.from('app_config').select('latest_version,min_version,apk_url,notes').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (data) { AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {}); return data as AppConfig; }
    return null;
  } catch {
    // Offline: use the last answer we got, so a forced update can not be skipped by switching the internet off.
    try { const raw = await AsyncStorage.getItem(KEY); return raw ? (JSON.parse(raw) as AppConfig) : null; } catch { return null; }
  }
}

// Checks when the app opens, every time it comes back to the front, and every 5 minutes.
export function useUpdateCheck() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const check = useCallback(() => { fetchConfig().then(setCfg); }, []);
  useEffect(() => {
    check();
    const t = setInterval(check, 5 * 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [check]);
  return { cfg, state: stateOf(cfg), recheck: check };
}

// ---- download + install the APK inside the app ----
export type ApkProgress = { done: number; total: number; speed: number };

const isDirectApk = (u: string) => /\.apk(\?|#|$)/i.test(u) || /github\.com\/.+\/releases\/(latest\/)?download\//i.test(u);

export function apkPath(version: string) { return `${FS.documentDirectory}update/CineHub-${version}.apk`; }

export async function downloadApk(cfg: AppConfig, onProgress: (p: ApkProgress) => void): Promise<string> {
  if (!cfg.apk_url) throw new Error('No download link is set yet.');
  if (!isDirectApk(cfg.apk_url)) {
    await Linking.openURL(cfg.apk_url);
    throw new Error('opened-in-browser');
  }
  const dir = `${FS.documentDirectory}update/`;
  try { await FS.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
  const path = apkPath(cfg.latest_version);
  let last = { t: Date.now(), b: 0, speed: 0 };
  const task = FS.createDownloadResumable(cfg.apk_url, path, {}, (p: any) => {
    const now = Date.now();
    if (now - last.t >= 500) {
      const inst = ((p.totalBytesWritten - last.b) / (now - last.t)) * 1000;
      last = { t: now, b: p.totalBytesWritten, speed: last.speed ? last.speed * 0.6 + inst * 0.4 : inst };
    }
    onProgress({ done: p.totalBytesWritten, total: p.totalBytesExpectedToWrite, speed: last.speed });
  });
  const res = await task.downloadAsync();
  if (!res || res.status < 200 || res.status >= 300) throw new Error(`Download failed (HTTP ${res?.status ?? 0})`);
  return path;
}

export async function installApk(path: string) {
  if (Platform.OS !== 'android') return;
  const IntentLauncher = require('expo-intent-launcher');
  const uri = await FS.getContentUriAsync(path);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri, flags: 1, type: 'application/vnd.android.package-archive',
  });
}
