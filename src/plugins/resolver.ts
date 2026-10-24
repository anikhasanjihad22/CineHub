import { getPlugins } from './loader';
import { capabilities, runStreams } from './sandbox';
import type { Stream } from './types';

export type StreamCtx = {
  tmdbId: number;
  imdbId?: string | null;
  type: 'movie' | 'tv';
  title: string;
  year?: string;
  season?: number;
  episode?: number;
};

// Asks every matching plugin at the same time. Each answer is added the moment it arrives
// (onUpdate), so the video can start from the first working server while slower ones keep searching.
// Repeated links are removed and the servers are named Server 1, Server 2, ...
export async function resolveStreams(ctx: StreamCtx, onUpdate?: (list: Stream[]) => void): Promise<Stream[]> {
  const cat = ctx.type === 'movie' ? 'movies' : 'tv';
  const plugins = (await getPlugins()).filter(
    (p) => (!p.categories?.length || p.categories.includes(cat)) && capabilities(p).stream,
  );
  const clean: StreamCtx = ctx.type === 'movie' ? { ...ctx, season: undefined, episode: undefined } : ctx;

  const seen = new Set<string>();
  const out: Stream[] = [];
  const add = (list: Stream[], name: string) => {
    let added = false;
    for (const s of list) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push({ ...s, label: `${name}${s.quality ? ` (${s.quality})` : ''}` });
      added = true;
    }
    if (added) onUpdate?.(out.slice());
  };

  await Promise.all(plugins.map((p) => runStreams(p, clean).then((l) => add(l, p.name)).catch(() => {})));
  return out.slice();
}
