import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Plugin } from './types';

const KEY = 'cinehub:plugins:v2';
const TTL = 60_000;
let memo: Plugin[] | null = null;
let memoAt = 0;
let sig: string | null = null;
let inflight: Promise<Plugin[]> | null = null;
const listeners = new Set<() => void>();

// Screens listen here and reload by themselves when the admin installs, edits, enables or removes a plugin.
export function onPluginsChanged(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const signature = (ps: Plugin[]) => ps.map((p) => `${p.id}:${p.updated_at}:${p.enabled}:${p.priority}:${(p.categories || []).join(',')}`).join('|');

function publish(ps: Plugin[]) {
  const s = signature(ps);
  const changed = sig !== null && s !== sig;
  sig = s;
  memo = ps;
  memoAt = Date.now();
  if (changed) listeners.forEach((cb) => { try { cb(); } catch {} });
}

// Every user's app calls this: enabled plugins installed by the admin arrive automatically.
export function getPlugins(force = false): Promise<Plugin[]> {
  if (!force && memo && Date.now() - memoAt < TTL) return Promise.resolve(memo);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('plugins')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: true });
      if (error) throw error;
      const list = ((data ?? []) as Plugin[]).map((p) => ({ ...p, categories: (p.categories ?? []).map((c) => String(c).toLowerCase()) }));
      publish(list);
      AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
      return list;
    } catch {
      // Offline or server problem: keep what we have, try again soon.
      if (!memo) {
        const raw = await AsyncStorage.getItem(KEY).catch(() => null);
        try { memo = raw ? (JSON.parse(raw) as Plugin[]) : []; } catch { memo = []; }
      }
      memoAt = Date.now() - (TTL - 10_000);
      return memo;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearPluginCache() {
  memo = null;
}

// Re-downloads plugins right now (pull to refresh, after the admin changes something).
export function refreshPlugins() {
  return getPlugins(true);
}

// Keeps every phone up to date: checks when the app opens and every 45 seconds while it is open.
export function startPluginSync() {
  const tick = () => { getPlugins(true).catch(() => {}); };
  const timer = setInterval(tick, 45_000);
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tick(); });
  return () => { clearInterval(timer); sub.remove(); };
}
