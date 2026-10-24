import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { Plugin } from './types';

const KEY = 'cinehub:plugins:v1';
let memo: Plugin[] | null = null;
let memoAt = 0;

// Every user's app calls this: enabled plugins installed by the admin arrive automatically.
export async function getPlugins(force = false): Promise<Plugin[]> {
  if (!force && memo && Date.now() - memoAt < 60_000) return memo;
  try {
    const { data, error } = await supabase
      .from('plugins')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: true });
    if (error) throw error;
    memo = (data ?? []) as Plugin[];
    memoAt = Date.now();
    await AsyncStorage.setItem(KEY, JSON.stringify(memo));
    return memo;
  } catch {
    // Offline or server problem: use the last saved copy.
    const raw = await AsyncStorage.getItem(KEY);
    memo = raw ? (JSON.parse(raw) as Plugin[]) : [];
    memoAt = Date.now();
    return memo;
  }
}

export function clearPluginCache() {
  memo = null;
}
