import { TMDB_KEY } from '../config';
import type { Caps, Plugin, RawCatalogItem, Stream } from './types';

type Fn = (...args: any[]) => any;
type Compiled = { getStreams?: Fn; getCatalog?: Fn; getLinks?: Fn };

const compiledCache = new Map<string, Compiled>();
const errors = new Map<string, string>();
let logSink: string[] | null = null;

const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';


// Small UTF-8 TextDecoder for phones that do not have one (some providers use it).
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = class {
    decode(buf?: any) {
      const b: number[] = buf ? Array.from(buf as ArrayLike<number>).map((x) => x & 255) : [];
      let out = '';
      for (let i = 0; i < b.length; ) {
        const c = b[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xe0) out += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
        else if (c < 0xf0) out += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
        else {
          const cp = (((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63)) - 0x10000;
          out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
        }
      }
      return out;
    }
  };
}

const msg = (e: any) => String(e?.message ?? e ?? 'Unknown error');

// Last error of each plugin (kept on this phone; the admin sees it in Manage plugins).
export const getPluginError = (id: string) => errors.get(id) ?? '';
const setErr = (id: string | undefined, e: string) => { if (id) { if (e) errors.set(id, e); else errors.delete(id); } };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${Math.round(ms / 1000)}s`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

const limitMs = (p: { timeout_ms?: number }) => Math.min(Math.max(p.timeout_ms || 0, 15_000), 60_000);

// The network function a plugin gets (https and plain http both work).
function pluginFetch(url: any, opts: any = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  const headers: Record<string, string> = {};
  const h = opts?.headers;
  if (h && typeof h.forEach === 'function' && !Array.isArray(h)) h.forEach((v: string, k: string) => { headers[k] = v; });
  else if (Array.isArray(h)) for (const [k, v] of h) headers[k] = v;
  else if (h && typeof h === 'object') Object.assign(headers, h);
  const has = (n: string) => Object.keys(headers).some((k) => k.toLowerCase() === n);
  if (!has('user-agent')) headers['User-Agent'] = UA;
  if (!has('accept-language')) headers['Accept-Language'] = 'en-US,en;q=0.9';
  const rest = { ...(opts || {}) };
  delete rest.signal;
  return fetch(String(url), { ...rest, headers, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function tmdbCall(path: string, params: Record<string, any> = {}) {
  const isToken = TMDB_KEY.length > 60;
  let qs = 'language=en-US';
  for (const k of Object.keys(params)) qs += `&${k}=${encodeURIComponent(String(params[k]))}`;
  if (!isToken) qs += `&api_key=${TMDB_KEY}`;
  const r = await fetch(`https://api.themoviedb.org/3${path.startsWith('/') ? path : '/' + path}?${qs}`, isToken ? { headers: { Authorization: `Bearer ${TMDB_KEY}` } } : undefined);
  return r.json();
}

// Small helpers for reading web pages. Plugins use them as `utils.xxx`.
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
  tmdb: tmdbCall,
  sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
};

// Tiny axios look-alike, because many plugins are written with axios.
const axiosShim: any = (() => {
  const call = async (method: string, url: string, data?: any, cfg: any = {}) => {
    const headers: Record<string, string> = { ...(cfg.headers || {}) };
    let body: any;
    if (data !== undefined && method !== 'GET') {
      if (typeof data === 'string') body = data;
      else {
        body = JSON.stringify(data);
        if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
      }
    }
    let u = String(url);
    if (cfg.params) {
      const qs = Object.keys(cfg.params).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(cfg.params[k]))}`).join('&');
      u += (u.includes('?') ? '&' : '?') + qs;
    }
    const r = await pluginFetch(u, { method, headers, body });
    const text = await r.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch {}
    if (!r.ok) {
      const e: any = new Error(`Request failed with status code ${r.status}`);
      e.response = { status: r.status, data: parsed };
      throw e;
    }
    return { data: parsed, status: r.status, statusText: r.statusText, headers: {} };
  };
  const ax: any = (cfg: any) => call(String(cfg.method || 'GET').toUpperCase(), cfg.url, cfg.data, cfg);
  ax.get = (u: string, c?: any) => call('GET', u, undefined, c);
  ax.post = (u: string, d?: any, c?: any) => call('POST', u, d, c);
  ax.put = (u: string, d?: any, c?: any) => call('PUT', u, d, c);
  ax.head = (u: string, c?: any) => call('HEAD', u, undefined, c);
  ax.request = (cfg: any) => call(String(cfg.method || 'GET').toUpperCase(), cfg.url, cfg.data, cfg);
  ax.create = () => ax;
  ax.default = ax;
  return ax;
})();

// Same modules Nuvio providers can use: axios, crypto-js, cheerio-without-node-native.
const loaded: Record<string, any> = {};
function makeRequire() {
  return (name: string) => {
    if (name === 'axios') return axiosShim;
    if (name === 'crypto-js' || name === 'cheerio-without-node-native' || name === 'cheerio') {
      if (!loaded[name]) {
        // Static strings so the app bundler includes the packages.
        if (name === 'crypto-js') loaded[name] = require('crypto-js');
        else loaded[name] = require('cheerio-without-node-native');
      }
      return loaded[name];
    }
    throw new Error(`require('${name}') is not available. Plugins can use fetch, axios, crypto-js and cheerio-without-node-native.`);
  };
}

// Accepts plugins written as plain functions, module.exports = {...}, or ES module style.
function transformSource(src: string): string {
  return String(src)
    .replace(/^\uFEFF/, '')
    .replace(/^(\s*)export\s+default\s+/gm, '$1module.exports.default = ')
    .replace(/^(\s*)export\s+(?=async\s+function|function|const|let|var|class)/gm, '$1')
    .replace(/^(\s*)export\s*\{([^}]*)\}\s*;?/gm, (_m, sp: string, names: string) => `${sp}Object.assign(module.exports, { ${names} });`)
    .replace(/^(\s*)import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/gm, "$1var $2 = require('$3');")
    .replace(/^(\s*)import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (_m, sp: string, names: string, mod: string) => `${sp}var { ${names.replace(/\s+as\s+/g, ': ')} } = require('${mod}');`)
    .replace(/^(\s*)import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/gm, "$1var $2 = require('$3');");
}

const STREAM_NAMES = ['getStreams', 'getStream', 'getSources'];
const CATALOG_NAMES = ['getCatalog', 'getHome', 'getItems'];
const LINK_NAMES = ['getLinks', 'getLink'];

function lookup(names: string[]) {
  return '(' + names.map((n) => `typeof ${n} === "function" ? ${n} : `).join('') + `__pick(${JSON.stringify(names)}))`;
}

export function compileCode(code: string): Compiled {
  const body =
    'return (function () {\n' +
    transformSource(code) +
    '\n;\n' +
    'var __m = module.exports || {};\n' +
    'var __d = (__m && typeof __m.default === "object" && __m.default) || {};\n' +
    'function __pick(names) { for (var i = 0; i < names.length; i++) { var n = names[i];' +
    ' if (typeof __m[n] === "function") return __m[n];' +
    ' if (typeof __d[n] === "function") return __d[n];' +
    ' if (typeof exports[n] === "function") return exports[n]; } return undefined; }\n' +
    'return { getStreams: ' + lookup(STREAM_NAMES) + ', getCatalog: ' + lookup(CATALOG_NAMES) + ', getLinks: ' + lookup(LINK_NAMES) + ' };\n' +
    '}).call(undefined);';

  const names = ['fetch', 'utils', 'log', 'console', 'module', 'exports', 'require', 'process', 'global', 'window', 'self'];
  const mod: { exports: any } = { exports: {} };
  const sink = (...a: any[]) => { if (logSink) logSink.push(a.map((x) => (typeof x === 'string' ? x : safeJson(x))).join(' ').slice(0, 300)); };
  const consoleShim = { log: sink, info: sink, warn: sink, error: sink, debug: sink };
  // eslint-disable-next-line no-new-func
  const factory = new Function(...names, body);
  return factory(pluginFetch, utils, sink, consoleShim, mod, mod.exports, makeRequire(), { env: {} }, globalThis, globalThis, globalThis) as Compiled;
}

function safeJson(x: any) { try { return JSON.stringify(x); } catch { return String(x); } }

function compile(p: Plugin): Compiled {
  const k = `${p.id}|${p.updated_at}|${p.code?.length ?? 0}`;
  const hit = compiledCache.get(k);
  if (hit) return hit;
  const c = compileCode(p.code);
  compiledCache.set(k, c);
  return c;
}

export function inspectCode(code: string): Caps {
  try {
    const c = compileCode(code);
    return { stream: !!c.getStreams, catalog: !!c.getCatalog, links: !!c.getLinks };
  } catch (e) {
    return { stream: false, catalog: false, links: false, error: msg(e) };
  }
}

// Reads what the plugin can do. A broken plugin never crashes the app; its error is remembered.
export function capabilities(p: Plugin): Caps {
  try {
    const c = compile(p);
    return { stream: !!c.getStreams, catalog: !!c.getCatalog, links: !!c.getLinks };
  } catch (e) {
    setErr(p.id, 'Code error: ' + msg(e));
    return { stream: false, catalog: false, links: false, error: msg(e) };
  }
}

// ---------- cleaning what plugins return ----------

const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const imgUrl = (v: any) => {
  const s = str(v);
  return s ? (s.startsWith('//') ? 'https:' + s : s) : null;
};

const URL_KEYS = ['url', 'link', 'file', 'src', 'stream', 'streamUrl', 'playUrl', 'videoUrl', 'm3u8', 'hls', 'mp4', 'source'];

function pickUrl(o: any): string | null {
  if (typeof o === 'string') return o;
  if (!o || typeof o !== 'object') return null;
  for (const k of URL_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

function toList(raw: any): any[] {
  if (!raw) return [];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.flatMap((x) => (x && typeof x === 'object' && !pickUrl(x) ? toList(x) : [x]));
  if (typeof raw === 'object') {
    for (const k of ['streams', 'sources', 'links', 'results', 'data']) if (Array.isArray(raw[k])) return toList(raw[k]);
    if (pickUrl(raw)) return [raw];
  }
  return [];
}

function guessFormat(url: string): Stream['format'] {
  const u = url.toLowerCase();
  if (/\.m3u8(\?|#|\/|$)/.test(u) || /[?&](format|type)=m3u8/.test(u)) return 'hls';
  if (/\.mpd(\?|#|$)/.test(u)) return 'dash';
  if (/\.(mp4|mkv|webm|mov|m4v)(\?|#|$)/.test(u)) return 'mp4';
  return undefined;
}

function pickHeaders(s: any): Record<string, string> | undefined {
  if (!s || typeof s !== 'object') return undefined;
  const h: Record<string, string> = {};
  const add = (o: any) => {
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (typeof o[k] === 'string') h[k] = o[k];
  };
  add(s.headers);
  add(s.behaviorHints?.proxyHeaders?.request);
  add(s.behaviorHints?.headers);
  if (typeof s.referer === 'string') h['Referer'] = s.referer;
  if (typeof s.referrer === 'string') h['Referer'] = s.referrer;
  if (typeof s.userAgent === 'string') h['User-Agent'] = s.userAgent;
  return Object.keys(h).length ? h : undefined;
}

function pickQuality(s: any): string | undefined {
  if (!s || typeof s !== 'object') return undefined;
  const direct = s.quality ?? s.resolution ?? s.label;
  if (typeof direct === 'string' || typeof direct === 'number') return String(direct).slice(0, 12);
  const text = `${s.name ?? ''} ${s.title ?? ''}`;
  const m = /(2160|1440|1080|720|480|360)p|4k/i.exec(text);
  return m ? m[0].toLowerCase() : undefined;
}

function pickInfo(o: any): string | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const parts: string[] = [];
  for (const k of ['name', 'title', 'description', 'language', 'lang', 'audio', 'label', 'server', 'source']) {
    const v = o[k];
    if (typeof v === 'string' && v) parts.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') parts.push(x);
  }
  return parts.length ? parts.join(' ').slice(0, 400) : undefined;
}

export function cleanStreams(raw: any): Stream[] {
  const out: Stream[] = [];
  const seen = new Set<string>();
  for (const s of toList(raw)) {
    let url = pickUrl(s);
    if (!url) continue;
    url = url.trim();
    if (url.startsWith('//')) url = 'https:' + url;
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const obj = typeof s === 'object' ? s : {};
    let format: Stream['format'];
    if (obj.format === 'hls' || obj.format === 'dash' || obj.format === 'mp4') format = obj.format;
    else if (obj.type === 'hls' || obj.type === 'dash' || obj.isM3U8 === true) format = obj.type === 'dash' ? 'dash' : 'hls';
    else format = guessFormat(url);
    out.push({ url, format, quality: pickQuality(obj), headers: pickHeaders(obj), info: pickInfo(obj) });
  }
  return out;
}

function toItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.sections)) {
      return raw.sections.flatMap((s: any) =>
        (Array.isArray(s?.items) ? s.items : []).map((it: any) => ({ section: s.title ?? s.name, ...it })),
      );
    }
    for (const k of ['items', 'results', 'list', 'data', 'movies', 'shows']) if (Array.isArray(raw[k])) return raw[k];
  }
  return [];
}

function normItem(x: any): RawCatalogItem | null {
  if (!x || typeof x !== 'object') return null;
  const title = str(x.title) ?? str(x.name);
  const id = x.id ?? x.slug ?? x.url ?? x.link ?? title;
  if (!title || id == null) return null;

  const t0 = x.type ?? x.mediaType ?? x.media_type;
  const type = t0 === 'tv' || t0 === 'series' || t0 === 'show' ? 'tv' : t0 === 'movie' || t0 === 'film' ? 'movie' : undefined;
  const tm = Number(x.tmdbId ?? x.tmdb_id ?? x.tmdb);
  const rating = Number(x.rating ?? x.vote_average);
  const date = str(x.releaseDate) ?? str(x.release_date) ?? str(x.date);
  const y0 = x.year != null ? String(x.year).trim() : '';
  const year = y0 || (date && /^\d{4}/.test(date) ? date.slice(0, 4) : undefined);

  const direct = str(x.stream) ?? str(x.streamUrl) ?? str(x.playUrl) ?? str(x.videoUrl) ?? str(x.m3u8) ?? str(x.hls) ?? str(x.mp4);
  const streams = cleanStreams(Array.isArray(x.streams) ? x.streams : Array.isArray(x.links) ? x.links : Array.isArray(x.sources) ? x.sources : direct ? [{ ...x, url: direct }] : null);

  return {
    id: String(id),
    title,
    poster: imgUrl(x.poster ?? x.image ?? x.thumbnail ?? x.cover ?? x.logo ?? x.icon),
    backdrop: imgUrl(x.backdrop ?? x.banner ?? x.background ?? x.fanart),
    year,
    overview: str(x.overview) ?? str(x.description) ?? str(x.plot) ?? undefined,
    rating: Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : undefined,
    tmdbId: Number.isFinite(tm) && tm > 0 ? tm : undefined,
    type,
    section: str(x.section) ?? str(x.group) ?? str(x.row) ?? undefined,
    streams,
  };
}

// ---------- running plugins ----------

// Nuvio providers are called as getStreams(tmdbId, mediaType, season, episode).
// Our own style is getStreams(ctx). We tell them apart by the parameter list
// (several parameters, or a default value like mediaType = "movie", means Nuvio style).
function isPositional(fn: Fn): boolean {
  if (fn.length >= 2) return true;
  try {
    const src = Function.prototype.toString.call(fn);
    const m = /^[^(]*\(([^)]*)\)/.exec(src) || /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/.exec(src);
    if (m) return !/^\s*[{\[]/.test(m[1]) && /[,=]/.test(m[1]) || /^\s*(tmdbId|tmdb_id|tmdb|id)\s*$/i.test(m[1]);
  } catch {}
  return false;
}

function callStreams(fn: Fn, ctx: any) {
  if (isPositional(fn)) return fn(String(ctx.tmdbId), ctx.type, ctx.season, ctx.episode);
  return fn(ctx);
}

export async function runStreams(p: Plugin, ctx: any): Promise<Stream[]> {
  try {
    const c = compile(p);
    if (!c.getStreams) return [];
    const full = { ...ctx, mediaType: ctx.type, id: ctx.tmdbId };
    const raw = await withTimeout((async () => callStreams(c.getStreams!, full))(), limitMs(p));
    setErr(p.id, '');
    return cleanStreams(raw);
  } catch (e) {
    setErr(p.id, 'getStreams: ' + msg(e));
    return [];
  }
}

export async function runCatalog(p: Plugin, ctx: any): Promise<RawCatalogItem[]> {
  try {
    const c = compile(p);
    if (!c.getCatalog) return [];
    const raw = await withTimeout((async () => c.getCatalog!(ctx))(), limitMs(p));
    setErr(p.id, '');
    return toItems(raw).map(normItem).filter(Boolean) as RawCatalogItem[];
  } catch (e) {
    setErr(p.id, 'getCatalog: ' + msg(e));
    return [];
  }
}

export async function runLinks(p: Plugin, ctx: any): Promise<Stream[]> {
  try {
    const c = compile(p);
    if (!c.getLinks) return [];
    const raw = await withTimeout((async () => c.getLinks!(ctx))(), limitMs(p));
    setErr(p.id, '');
    return cleanStreams(raw);
  } catch (e) {
    setErr(p.id, 'getLinks: ' + msg(e));
    return [];
  }
}

// ---------- test button (Manage plugins) ----------

export type TestInput = { name: string; code: string; categories: string[]; timeout_ms: number };

export async function testPlugin(input: TestInput): Promise<string[]> {
  const out: string[] = [];
  logSink = [];
  const limit = limitMs(input);
  const secs = (t0: number) => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  try {
    let c: Compiled;
    try {
      c = compileCode(input.code);
    } catch (e) {
      return ['Code error: ' + msg(e), 'Fix the syntax or remove unsupported imports, then test again.'];
    }
    const found = [c.getStreams && 'getStreams', c.getCatalog && 'getCatalog', c.getLinks && 'getLinks'].filter(Boolean);
    if (!found.length) return ['No getStreams / getCatalog function found in this code.'];
    out.push('Found: ' + found.join(', '));

    if (c.getStreams) {
      const tv = !input.categories.includes('movies') && input.categories.includes('tv');
      const ctx: any = tv
        ? { tmdbId: 1396, imdbId: 'tt0903747', type: 'tv', title: 'Breaking Bad', year: '2008', season: 1, episode: 1 }
        : { tmdbId: 550, imdbId: 'tt0137523', type: 'movie', title: 'Fight Club', year: '1999' };
      const t0 = Date.now();
      try {
        const raw = await withTimeout((async () => callStreams(c.getStreams!, { ...ctx, mediaType: ctx.type, id: ctx.tmdbId }))(), limit);
        const s = cleanStreams(raw);
        out.push(`getStreams (${ctx.title}): ${s.length} link(s) in ${secs(t0)}`);
        s.slice(0, 3).forEach((x) => out.push('  ' + (x.format ?? 'auto') + (x.quality ? ' ' + x.quality : '') + '  ' + x.url.slice(0, 70)));
        if (!s.length) out.push('  Nothing returned. The site may not have this title, or it blocked the request.');
      } catch (e) {
        out.push('getStreams error: ' + msg(e));
      }
    }

    let firstItem: RawCatalogItem | null = null;
    if (c.getCatalog) {
      const cats = input.categories.length ? input.categories : ['movies'];
      for (const cat of cats) {
        const t0 = Date.now();
        try {
          const raw = await withTimeout((async () => c.getCatalog!({ category: cat, page: 1, query: '' }))(), limit);
          const items = toItems(raw).map(normItem).filter(Boolean) as RawCatalogItem[];
          out.push(`getCatalog (${cat}): ${items.length} item(s) in ${secs(t0)}`);
          if (items.length) {
            if (!firstItem) firstItem = items[0];
            const withPoster = items.filter((i) => i.poster).length;
            const sections = Array.from(new Set(items.map((i) => i.section).filter(Boolean)));
            out.push('  first: ' + items.slice(0, 3).map((i) => i.title).join(', '));
            out.push(`  posters: ${withPoster}/${items.length}` + (sections.length ? `  sections: ${sections.slice(0, 4).join(', ')}` : ''));
            if (!items.some((i) => i.streams.length) && !c.getLinks) out.push('  No links: add getLinks, or give each item a "stream" url.');
          }
        } catch (e) {
          out.push(`getCatalog (${cat}) error: ${msg(e)}`);
        }
      }
    }

    if (c.getLinks && firstItem && !firstItem.streams.length) {
      const t0 = Date.now();
      try {
        const raw = await withTimeout((async () => c.getLinks!({ id: firstItem!.id, title: firstItem!.title }))(), limit);
        const s = cleanStreams(raw);
        out.push(`getLinks (${firstItem.title}): ${s.length} link(s) in ${secs(t0)}`);
        s.slice(0, 2).forEach((x) => out.push('  ' + x.url.slice(0, 70)));
      } catch (e) {
        out.push('getLinks error: ' + msg(e));
      }
    }

    if (logSink && logSink.length) out.push('Logs: ' + logSink.slice(0, 6).join(' | '));
    return out;
  } finally {
    logSink = null;
  }
}
