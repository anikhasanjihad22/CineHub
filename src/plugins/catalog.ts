import { getPlugins } from './loader';
import { capabilities, runCatalog, runLinks } from './sandbox';
import type { CatalogItem, Stream } from './types';

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const TTL = 60_000;
const cache = new Map<string, { at: number; items: CatalogItem[] }>();

export function clearCatalogCache() {
  cache.clear();
}

export const categoryLabel = (c: string) =>
  ({ home: 'Home', movies: 'Movies', tv: 'TV Shows', sports: 'Sports', news: 'News' } as Record<string, string>)[c] ??
  c.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

// Every category that an installed catalog plugin offers (sports, news, anime, live, ...).
export async function catalogCategories(): Promise<string[]> {
  const out: string[] = [];
  for (const p of await getPlugins()) {
    if (!capabilities(p).catalog) continue;
    for (const c of p.categories || []) {
      const k = String(c).trim().toLowerCase();
      if (k && !out.includes(k)) out.push(k);
    }
  }
  return out;
}

// Lists come from catalog plugins. The same title from different plugins becomes one card.
export async function loadCatalog(category: string, query = '', force = false): Promise<CatalogItem[]> {
  const ck = category + '|' + query;
  const hit = cache.get(ck);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.items;

  const plugins = (await getPlugins()).filter((p) => (p.categories || []).includes(category) && capabilities(p).catalog);
  const results = await Promise.all(plugins.map((p) => runCatalog(p, { category, page: 1, query }).then((items) => ({ p, items }))));
  const fallbackType = category === 'movies' ? 'movie' : category === 'tv' ? 'tv' : undefined;
  const q = norm(query);

  const map = new Map<string, CatalogItem>();
  for (const { p, items } of results) {
    // A plugin that ignores the search text and returns its whole list gets filtered here.
    const list = q && items.length > 30 ? items.filter((it) => q.split(' ').every((w) => norm(it.title).includes(w))) : items;
    for (const it of list) {
      const type = it.type ?? fallbackType;
      const key = it.tmdbId ? `tmdb:${type ?? ''}:${it.tmdbId}` : norm(it.title);
      if (!key) continue;
      const ex = map.get(key);
      if (ex) {
        ex.refs.push({ pluginId: p.id, id: it.id });
        for (const s of it.streams) if (!ex.streams.some((x) => x.url === s.url)) ex.streams.push(s);
        ex.poster = ex.poster || it.poster;
        ex.backdrop = ex.backdrop || it.backdrop;
        ex.overview = ex.overview || it.overview;
        ex.year = ex.year || it.year;
        ex.rating = ex.rating || it.rating;
        ex.tmdbId = ex.tmdbId || it.tmdbId;
      } else {
        map.set(key, {
          key, title: it.title, poster: it.poster, backdrop: it.backdrop, year: it.year, overview: it.overview,
          rating: it.rating, tmdbId: it.tmdbId, type, section: it.section || '', category,
          refs: [{ pluginId: p.id, id: it.id }], streams: it.streams.slice(),
        });
      }
    }
  }
  const items = Array.from(map.values());
  cache.set(ck, { at: Date.now(), items });
  return items;
}

// Groups a list into rows by the "section" the plugin gave (or one row with the fallback title).
export function groupSections(items: CatalogItem[], fallback: string): { title: string; items: CatalogItem[] }[] {
  const m = new Map<string, CatalogItem[]>();
  for (const it of items) {
    const t = it.section || fallback;
    if (!m.has(t)) m.set(t, []);
    m.get(t)!.push(it);
  }
  return Array.from(m.entries()).map(([title, list]) => ({ title, items: list }));
}

// Links for one catalog item: its own direct links first, then whatever the plugins' getLinks give.
export async function resolveCatalogLinks(item: CatalogItem, onUpdate?: (list: Stream[]) => void): Promise<Stream[]> {
  const seen = new Set<string>();
  const out: Stream[] = [];
  const add = (list: Stream[]) => {
    let added = false;
    for (const s of list) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push({ ...s, label: `Server ${out.length + 1}${s.quality ? ` (${s.quality})` : ''}` });
      added = true;
    }
    if (added) onUpdate?.(out.slice());
  };

  add(item.streams);
  const plugins = await getPlugins();
  await Promise.all(
    item.refs.map((r) => {
      const p = plugins.find((x) => x.id === r.pluginId);
      return p ? runLinks(p, { id: r.id, title: item.title, year: item.year }).then(add).catch(() => {}) : Promise.resolve();
    }),
  );
  return out.slice();
}
