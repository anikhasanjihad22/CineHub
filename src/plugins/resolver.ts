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

// Language order: Hindi and Bangla links come first. If there are none, links in any other language are used.
// Plugins do not agree on how they write the language, so we look for the words in the text they gave us.
const PREFERRED = /\b(hindi|hin|bangla|bengali|bangali)\b|हिन्दी|বাংলা/i;
export const isPreferred = (s: Stream) => PREFERRED.test(s.info ?? '') || PREFERRED.test(s.label ?? '');

const GRACE_MS = 7000;

// Asks every matching plugin at the same time and builds the list of links to try.
// - Hindi / Bangla links are placed first, other languages after them.
// - The list is handed over (onUpdate) as soon as a Hindi / Bangla link exists, or after a short wait
//   if only other languages answered, or when every plugin has finished.
// - Links that arrive later are added to the end, so the one that is playing never changes under the viewer.
export async function resolveStreams(ctx: StreamCtx, onUpdate?: (list: Stream[]) => void): Promise<Stream[]> {
  const cat = ctx.type === 'movie' ? 'movies' : 'tv';
  const plugins = (await getPlugins()).filter(
    (p) => (!p.categories?.length || p.categories.includes(cat)) && capabilities(p).stream,
  );
  const clean: StreamCtx = ctx.type === 'movie' ? { ...ctx, season: undefined, episode: undefined } : ctx;

  const seen = new Set<string>();
  const preferred: Stream[] = [];
  const other: Stream[] = [];
  let handedOver: Stream[] = [];
  let released = false;
  let timer: any = null;

  const build = () => [...preferred, ...other].map((s, i) => ({ ...s, label: `Source ${i + 1}` }));

  const release = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    released = true;
    handedOver = build();
    if (handedOver.length) onUpdate?.(handedOver.slice());
  };

  const add = (list: Stream[]) => {
    let hasPreferred = false;
    let added = false;
    for (const s of list) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      added = true;
      if (isPreferred(s)) { preferred.push(s); hasPreferred = true; } else other.push(s);
    }
    if (!added) return;
    if (!released) {
      if (hasPreferred) release();
      else if (!timer) timer = setTimeout(release, GRACE_MS);
    } else {
      // Already started: new links only go to the end of what the player knows.
      const known = new Set(handedOver.map((x) => x.url));
      const fresh = [...preferred, ...other].filter((x) => !known.has(x.url));
      handedOver = [...handedOver, ...fresh].map((x, i) => ({ ...x, label: `Source ${i + 1}` }));
      onUpdate?.(handedOver.slice());
    }
  };

  await Promise.all(plugins.map((p) => runStreams(p, clean).then(add).catch(() => {})));
  if (!released) release();
  return handedOver.length ? handedOver.slice() : build();
}
