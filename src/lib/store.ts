import { supabase } from './supabase';
import type { MediaType } from './tmdb';

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// ---- favorites ----
export async function getFavorites(): Promise<{ tmdb_id: number; media_type: MediaType }[]> {
  const { data } = await supabase.from('favorites').select('tmdb_id,media_type').order('created_at', { ascending: false });
  return (data ?? []) as any;
}

export async function isFavorite(id: number, type: MediaType): Promise<boolean> {
  const { data } = await supabase.from('favorites').select('tmdb_id').eq('tmdb_id', id).eq('media_type', type).maybeSingle();
  return !!data;
}

export async function toggleFavorite(id: number, type: MediaType): Promise<boolean> {
  const user = await uid();
  if (!user) return false;
  if (await isFavorite(id, type)) {
    await supabase.from('favorites').delete().eq('tmdb_id', id).eq('media_type', type).eq('user_id', user);
    return false;
  }
  await supabase.from('favorites').insert({ user_id: user, tmdb_id: id, media_type: type });
  return true;
}

// ---- watch history ----
export async function recentHistory(type: MediaType): Promise<number[]> {
  const { data } = await supabase
    .from('watch_history')
    .select('tmdb_id,media_type,progress_seconds,duration_seconds,updated_at')
    .eq('media_type', type)
    .order('updated_at', { ascending: false })
    .limit(30);
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const r of (data ?? []) as any[]) {
    if (seen.has(r.tmdb_id)) continue;
    seen.add(r.tmdb_id);
    const done = r.duration_seconds > 0 && r.progress_seconds / r.duration_seconds > 0.95;
    if (!done) ids.push(r.tmdb_id);
  }
  return ids.slice(0, 10);
}

export async function getProgress(id: number, type: MediaType, season: number, episode: number): Promise<number> {
  const { data } = await supabase
    .from('watch_history')
    .select('progress_seconds')
    .eq('tmdb_id', id).eq('media_type', type).eq('season', season).eq('episode', episode)
    .maybeSingle();
  return data?.progress_seconds ?? 0;
}

export async function saveProgress(p: {
  id: number; type: MediaType; season: number; episode: number; progress: number; duration: number;
}) {
  const user = await uid();
  if (!user) return;
  await supabase.from('watch_history').upsert(
    {
      user_id: user,
      tmdb_id: p.id,
      media_type: p.type,
      season: p.season,
      episode: p.episode,
      progress_seconds: Math.floor(p.progress),
      duration_seconds: Math.floor(p.duration),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,tmdb_id,media_type,season,episode' },
  );
}
