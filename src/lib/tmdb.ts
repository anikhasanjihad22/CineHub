import { TMDB_KEY, TMDB_REGION } from '../config';

const BASE = 'https://api.themoviedb.org/3';

export type MediaType = 'movie' | 'tv';

export type Title = {
  id: number;
  type: MediaType;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string;
  rating: number;
};

export type Detail = Title & {
  imdbId: string | null;
  runtime: number;
  genres: string[];
  seasons: { number: number; name: string; episodes: number }[];
};

export type Provider = { id: number; name: string; logo: string | null };

export const hasKey = () => !!TMDB_KEY && !TMDB_KEY.startsWith('PASTE');

export function img(path: string | null | undefined, size = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

async function call(path: string, params: Record<string, string | number> = {}) {
  const isToken = TMDB_KEY.length > 60;
  let qs = 'language=en-US';
  for (const k of Object.keys(params)) qs += `&${k}=${encodeURIComponent(String(params[k]))}`;
  if (!isToken) qs += `&api_key=${TMDB_KEY}`;
  const r = await fetch(`${BASE}${path}?${qs}`, isToken ? { headers: { Authorization: `Bearer ${TMDB_KEY}` } } : undefined);
  if (!r.ok) throw new Error(`TMDB error ${r.status}`);
  return r.json();
}

function norm(x: any, forced?: MediaType): Title | null {
  const type: string = forced ?? x.media_type;
  if (type !== 'movie' && type !== 'tv') return null;
  const date: string = x.release_date || x.first_air_date || '';
  return {
    id: x.id,
    type,
    title: x.title || x.name || '',
    overview: x.overview || '',
    poster: x.poster_path ?? null,
    backdrop: x.backdrop_path ?? null,
    year: date.slice(0, 4),
    rating: Math.round((x.vote_average || 0) * 10) / 10,
  };
}

function list(res: any, t?: MediaType): Title[] {
  const seen = new Set<string>();
  const out: Title[] = [];
  for (const x of res.results || []) {
    const n = norm(x, t);
    if (!n || !n.poster) continue;
    const k = n.type + n.id;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

export const trending = async (t: MediaType) => list(await call(`/trending/${t}/week`), t);
export const popular = async (t: MediaType, page = 1) => list(await call(`/${t}/popular`, { page }), t);
export const topRated = async (t: MediaType) => list(await call(`/${t}/top_rated`), t);
export const searchTitles = async (q: string) => list(await call('/search/multi', { query: q }));

export async function discover(t: MediaType, providerId: number, page = 1) {
  return list(
    await call(`/discover/${t}`, {
      with_watch_providers: providerId,
      watch_region: TMDB_REGION,
      sort_by: 'popularity.desc',
      page,
    }),
    t,
  );
}

export async function providers(t: MediaType): Promise<Provider[]> {
  const res = await call(`/watch/providers/${t}`, { watch_region: TMDB_REGION });
  const items: any[] = (res.results || []).filter((p: any) => p.logo_path);
  items.sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999));
  return items.slice(0, 14).map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path }));
}

export async function details(t: MediaType, id: number): Promise<Detail> {
  const x = await call(`/${t}/${id}`, { append_to_response: 'external_ids' });
  const base = norm(x, t)!;
  return {
    ...base,
    imdbId: x.imdb_id || x.external_ids?.imdb_id || null,
    runtime: x.runtime || (x.episode_run_time && x.episode_run_time[0]) || 0,
    genres: (x.genres || []).map((g: any) => g.name),
    seasons: (x.seasons || [])
      .filter((s: any) => s.season_number > 0)
      .map((s: any) => ({ number: s.season_number, name: s.name, episodes: s.episode_count })),
  };
}

export async function seasonEpisodes(id: number, n: number) {
  const x = await call(`/tv/${id}/season/${n}`);
  return (x.episodes || []).map((e: any) => ({
    number: e.episode_number as number,
    name: (e.name as string) || `Episode ${e.episode_number}`,
    overview: (e.overview as string) || '',
    still: (e.still_path as string) || null,
    runtime: (e.runtime as number) || 0,
  }));
}
