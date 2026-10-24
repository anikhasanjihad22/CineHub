import { getPlugins } from './loader';
import { runCatalog, runLinks } from './sandbox';
import type { CatalogItem, Stream } from './types';

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Sports / News: these have no TMDB id, so lists come only from catalog plugins.
// Same title from different plugins becomes one card.
export async function loadCatalog(category: string, query?: string): Promise<CatalogItem[]> {
  const plugins = (await getPlugins()).filter((p) => p.kind === 'catalog' && p.categories.includes(category));
  const results = await Promise.all(
    plugins.map((p) =>
      runCatalog(p, { category, page: 1, query: query || '' })
        .then((items) => ({ p, items }))
        .catch(() => ({ p, items: [] as { id: string; title: string; poster: string | null }[] })),
    ),
  );

  const map = new Map<string, CatalogItem>();
  for (const { p, items } of results) {
    for (const it of items) {
      const key = norm(it.title);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.refs.push({ pluginId: p.id, id: it.id });
        if (!existing.poster && it.poster) existing.poster = it.poster;
      } else {
        map.set(key, { key, title: it.title, poster: it.poster, refs: [{ pluginId: p.id, id: it.id }] });
      }
    }
  }
  return Array.from(map.values());
}

export async function resolveCatalogLinks(item: CatalogItem): Promise<Stream[]> {
  const plugins = await getPlugins();
  const lists = await Promise.all(
    item.refs.map((r) => {
      const p = plugins.find((x) => x.id === r.pluginId);
      return p ? runLinks(p, { id: r.id, title: item.title }).catch(() => [] as Stream[]) : Promise.resolve([] as Stream[]);
    }),
  );
  const seen = new Set<string>();
  const out: Stream[] = [];
  for (const l of lists) for (const s of l) if (!seen.has(s.url)) { seen.add(s.url); out.push(s); }
  return out.map((s, i) => ({ ...s, label: `Server ${i + 1}` }));
}
