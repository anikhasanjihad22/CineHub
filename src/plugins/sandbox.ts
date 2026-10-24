import type { Plugin, Stream } from './types';

type Compiled = {
  getStreams?: (ctx: any) => Promise<any>;
  getCatalog?: (ctx: any) => Promise<any>;
  getLinks?: (ctx: any) => Promise<any>;
};

const cache = new Map<string, Compiled>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// The only network function a plugin gets (10 second limit).
function pluginFetch(url: string, opts?: any) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  return fetch(url, { ...(opts || {}), signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// Small helpers for reading web pages.
const utils = {
  strip: (html: string) => String(html).replace(/<[^>]*>/g, '').trim(),
  matchAll: (text: string, re: RegExp) => {
    const g = re.global ? re : new RegExp(re.source, re.flags + 'g');
    return Array.from(String(text).matchAll(g));
  },
  absUrl: (base: string, rel: string) => {
    if (/^https?:\/\//i.test(rel)) return rel;
    if (rel.startsWith('//')) return 'https:' + rel;
    const m = /^(https?:\/\/[^/]+)/i.exec(base);
    const origin = m ? m[1] : '';
    return rel.startsWith('/') ? origin + rel : origin + '/' + rel;
  },
  json: (text: string) => {
    try { return JSON.parse(text); } catch { return null; }
  },
};

function compile(p: Plugin): Compiled {
  const k = p.id + '|' + p.updated_at;
  const hit = cache.get(k);
  if (hit) return hit;

  // Plugin code only receives: fetch, utils, log. Other globals are hidden from it.
  const names = ['fetch', 'utils', 'log', 'console', 'globalThis', 'global', 'window', 'require', 'process'];
  const body =
    '"use strict";\n' +
    p.code +
    '\n;return {' +
    ' getStreams: typeof getStreams === "function" ? getStreams : undefined,' +
    ' getCatalog: typeof getCatalog === "function" ? getCatalog : undefined,' +
    ' getLinks: typeof getLinks === "function" ? getLinks : undefined };';

  const factory = new Function(...names, body);
  const noop = () => {};
  const compiled = factory(
    pluginFetch, utils, noop, { log: noop, warn: noop, error: noop },
    undefined, undefined, undefined, undefined, undefined,
  ) as Compiled;
  cache.set(k, compiled);
  return compiled;
}

function guessFormat(url: string): Stream['format'] {
  const u = url.split('?')[0].toLowerCase();
  if (u.endsWith('.m3u8')) return 'hls';
  if (u.endsWith('.mpd')) return 'dash';
  return 'mp4';
}

function cleanStreams(raw: any): Stream[] {
  if (!Array.isArray(raw)) return [];
  const out: Stream[] = [];
  for (const s of raw) {
    if (!s || typeof s.url !== 'string' || !/^https?:\/\//i.test(s.url)) continue;
    out.push({
      url: s.url,
      format: s.format === 'hls' || s.format === 'dash' || s.format === 'mp4' ? s.format : guessFormat(s.url),
      quality: typeof s.quality === 'string' ? s.quality : undefined,
      headers: s.headers && typeof s.headers === 'object' ? s.headers : undefined,
    });
  }
  return out;
}

export async function runStreams(p: Plugin, ctx: any): Promise<Stream[]> {
  const c = compile(p);
  if (!c.getStreams) return [];
  return cleanStreams(await withTimeout(Promise.resolve(c.getStreams(ctx)), p.timeout_ms));
}

export async function runCatalog(p: Plugin, ctx: any): Promise<{ id: string; title: string; poster: string | null }[]> {
  const c = compile(p);
  if (!c.getCatalog) return [];
  const raw = await withTimeout(Promise.resolve(c.getCatalog(ctx)), p.timeout_ms);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x: any) => x && x.id != null && typeof x.title === 'string')
    .map((x: any) => ({ id: String(x.id), title: x.title, poster: typeof x.poster === 'string' ? x.poster : null }));
}

export async function runLinks(p: Plugin, ctx: any): Promise<Stream[]> {
  const c = compile(p);
  if (!c.getLinks) return [];
  return cleanStreams(await withTimeout(Promise.resolve(c.getLinks(ctx)), p.timeout_ms));
}
