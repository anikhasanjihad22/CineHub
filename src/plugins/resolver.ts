import { getPlugins } from './loader';
import { runStreams } from './sandbox';
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

// Asks every matching stream plugin at the same time, merges the answers,
// removes repeated links and names them Server 1, Server 2, ...
// If one plugin finds nothing, the others still answer.
export async function resolveStreams(ctx: StreamCtx): Promise<Stream[]> {
  const cat = ctx.type === 'movie' ? 'movies' : 'tv';
  const plugins = (await getPlugins()).filter((p) => p.kind === 'stream' && p.categories.includes(cat));
  const results = await Promise.all(plugins.map((p) => runStreams(p, ctx).catch(() => [] as Stream[])));

  const seen = new Set<string>();
  const out: Stream[] = [];
  for (const list of results) {
    for (const s of list) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push(s);
    }
  }
  return out.map((s, i) => ({ ...s, label: `Server ${i + 1}` }));
}
