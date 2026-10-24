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

export type Cast = { id: number; name: string; character: string; photo: string | null };

export type Detail = Title & {
  imdbId: string | null;
  runtime: number;
  genres: string[];
  seasons: { number: number; name: string; episodes: number }[];
  cast: Cast[];
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
export const similar = async (t: MediaType, id: number) => list(await call(`/${t}/${id}/recommendations`), t);
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
  const x = await call(`/${t}/${id}`, { append_to_response: 'external_ids,credits' });
  const base = norm(x, t)!;
  return {
    ...base,
    imdbId: x.imdb_id || x.external_ids?.imdb_id || null,
    runtime: x.runtime || (x.episode_run_time && x.episode_run_time[0]) || 0,
    genres: (x.genres || []).map((g: any) => g.name),
    seasons: (x.seasons || [])
      .filter((s: any) => s.season_number > 0)
      .map((s: any) => ({ number: s.season_number, name: s.name, episodes: s.episode_count })),
    cast: ((x.credits?.cast || []) as any[])
      .slice(0, 24)
      .map((c) => ({ id: c.id, name: c.name || '', character: c.character || '', photo: c.profile_path ?? null })),
  };
}

// Turns a file-like name ("Inception.2010.1080p.BluRay.x264.mkv") into a clean title and year.
export function cleanTitle(raw: string): { title: string; year?: string } {
  let s = String(raw).replace(/\.(mkv|mp4|avi|mov|m4v|webm|ts)$/i, '');
  const ym = /[\s.(\[_-]((?:19|20)\d{2})(?=[\s.)\]_-]|$)/.exec(s);
  const year = ym ? ym[1] : undefined;
  s = s.replace(/[._]+/g, ' ');
  if (ym) {
    const i = s.search(/[\s(\[-]((?:19|20)\d{2})(?=[\s)\]-]|$)/);
    if (i > 0) s = s.slice(0, i);
  }
  s = s.replace(/[\[(][^\])]*[\])]/g, ' ');
  s = s.replace(/\b(2160p|1440p|1080p|720p|480p|360p|4k|uhd|hdr|blu-?ray|brrip|bdrip|web-?dl|webrip|hdrip|dvdrip|hdtv|x26[45]|h ?26[45]|hevc|aac|atmos|esub|s\d{1,2}e\d{1,2})\b.*$/i, '');
  return { title: s.replace(/\s+/g, ' ').trim(), year };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// For items that come from a plugin / your own server (no TMDB id): finds the same title on TMDB
// so the page can show the cast, genres, overview and a backdrop. Only an exact title match is used.
export async function matchTitle(rawTitle: string, hint?: MediaType, yearHint?: string): Promise<Detail | null> {
  const { title, year: y2 } = cleanTitle(rawTitle);
  const year = yearHint || y2;
  if (!title) return null;
  const res = await call(hint ? `/search/${hint}` : '/search/multi', { query: title });
  const found: Title[] = [];
  for (const x of res.results || []) {
    const n = norm(x, hint);
    if (n) found.push(n);
  }
  const exact = found.filter((t) => slug(t.title) === slug(title));
  const pick = (year ? exact.find((t) => t.year === year) : undefined) ?? exact[0];
  return pick ? details(pick.type, pick.id) : null;
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
