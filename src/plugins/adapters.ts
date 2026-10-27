// Turns other plugin formats into a normal CineHub plugin (plain JavaScript), so one installer handles them all:
//   - Stremio addon  (manifest.json with "resources")      -> streams + catalogs
//   - M3U / M3U8 playlist (live TV, IPTV, sports, radio)    -> catalog with direct streams
// Nuvio repos and plain JavaScript plugins are handled by the admin screen as before.

export type Adapted = { name: string; code: string; categories: string[]; format: 'stremio' | 'm3u' };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// stremio://host/manifest.json  ->  https://host/manifest.json
export const normalizeUrl = (u: string) => u.trim().replace(/^stremio:\/\//i, 'https://');

// ---------------------------------------------------------------- Stremio
const STREMIO_COMMON = `
var BASE = __BASE__;
async function j(url) { var r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
function mapStreams(d) {
  return ((d && d.streams) || []).filter(function (s) { return s && s.url; }).map(function (s) {
    return { url: s.url, name: s.name, title: s.title, description: s.description, behaviorHints: s.behaviorHints };
  });
}
`;

const STREMIO_STREAM = `
async function imdbOf(ctx) {
  if (ctx.imdbId) return ctx.imdbId;
  try {
    var ex = await utils.tmdb('/' + (ctx.type === 'tv' ? 'tv' : 'movie') + '/' + ctx.tmdbId + '/external_ids');
    return ex && ex.imdb_id;
  } catch (e) { return null; }
}
async function getStreams(ctx) {
  var imdb = await imdbOf(ctx);
  if (!imdb) return [];
  var series = ctx.type === 'tv';
  var id = series ? imdb + ':' + (ctx.season || 1) + ':' + (ctx.episode || 1) : imdb;
  return mapStreams(await j(BASE + '/stream/' + (series ? 'series' : 'movie') + '/' + id + '.json'));
}
`;

const STREMIO_CATALOG = `
var CATS = __CATS__;
var cache = {};
async function tmdbFor(imdb, kind) {
  var k = imdb + kind;
  if (cache[k] !== undefined) return cache[k];
  try {
    var f = await utils.tmdb('/find/' + imdb, { external_source: 'imdb_id' });
    var a = kind === 'tv' ? f.tv_results : f.movie_results;
    cache[k] = a && a[0] ? a[0].id : 0;
  } catch (e) { cache[k] = 0; }
  return cache[k];
}
async function getCatalog(ctx) {
  var cat = String(ctx.category || '').toLowerCase();
  var q = String(ctx.query || '').trim();
  var page = ctx.page || 1;
  var list = CATS.filter(function (c) { return c.cat === cat && (q ? c.search : !c.needsExtra); }).slice(0, 8);
  var out = [];
  await Promise.all(list.map(async function (c) {
    try {
      var extra = q ? 'search=' + encodeURIComponent(q) : (page > 1 && c.skip ? 'skip=' + ((page - 1) * 100) : '');
      var d = await j(BASE + '/catalog/' + c.type + '/' + c.id + (extra ? '/' + extra : '') + '.json');
      var metas = (d.metas || []).slice(0, 40);
      var items = await Promise.all(metas.map(async function (m) {
        var kind = (m.type === 'series' || c.type === 'series') ? 'tv' : ((m.type === 'movie' || c.type === 'movie') ? 'movie' : '');
        var tm = 0;
        if (kind && /^tt\\d+/.test(m.id || '')) tm = await tmdbFor(m.id, kind);
        return {
          id: c.type + '|' + m.id, title: m.name, poster: m.poster, backdrop: m.background,
          year: m.releaseInfo || m.year, rating: m.imdbRating, overview: m.description,
          section: c.name, type: kind || undefined, tmdbId: tm || undefined
        };
      }));
      out = out.concat(items);
    } catch (e) {}
  }));
  return out;
}
async function getLinks(ctx) {
  var p = String(ctx.id || '').split('|');
  return mapStreams(await j(BASE + '/stream/' + p[0] + '/' + p.slice(1).join('|') + '.json'));
}
`;

const catOf = (type: string) => (type === 'movie' ? 'movies' : type === 'series' ? 'tv' : slug(type) || 'live');

export function fromStremio(manifest: any, manifestUrl: string): Adapted | null {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.resources)) return null;
  const names = manifest.resources.map((r: any) => (typeof r === 'string' ? r : r?.name));
  const hasStream = names.includes('stream');
  const catalogs: any[] = names.includes('catalog') && Array.isArray(manifest.catalogs) ? manifest.catalogs : [];

  const cats = catalogs
    .map((c) => {
      const extra: any[] = Array.isArray(c.extra) ? c.extra : [];
      const required = extra.some((e) => e?.isRequired && e?.name !== 'search');
      return {
        type: String(c.type), id: String(c.id), name: String(c.name || c.id), cat: catOf(String(c.type)),
        search: extra.some((e) => e?.name === 'search'),
        skip: extra.some((e) => e?.name === 'skip'),
        needsExtra: required || extra.some((e) => e?.name === 'search' && e?.isRequired),
      };
    })
    .filter((c) => c.type && c.id);

  if (!hasStream && cats.length === 0) return null;
  const base = manifestUrl.replace(/[?#].*$/, '').replace(/\/manifest\.json$/i, '').replace(/\/$/, '');

  let code = STREMIO_COMMON.replace('__BASE__', JSON.stringify(base));
  const categories = new Set<string>();
  if (hasStream) {
    code += STREMIO_STREAM;
    categories.add('movies'); categories.add('tv');
  }
  if (cats.length) {
    code += STREMIO_CATALOG.replace('__CATS__', JSON.stringify(cats));
    cats.forEach((c) => categories.add(c.cat));
  }
  return { name: String(manifest.name || 'Stremio addon'), code, categories: Array.from(categories), format: 'stremio' };
}

// ---------------------------------------------------------------- M3U playlists
const M3U_JS = `
var URL = __URL__;
var CATEGORY = __CATEGORY__;
var memo = null, memoAt = 0;
async function load() {
  if (memo && Date.now() - memoAt < 600000) return memo;
  var r = await fetch(URL);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  var text = await r.text();
  var lines = text.split(/\\r?\\n/), out = [], cur = null;
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].trim();
    if (!ln) continue;
    if (ln.indexOf('#EXTINF') === 0) {
      var name = ln.substring(ln.lastIndexOf(',') + 1).trim();
      var logo = /tvg-logo="([^"]*)"/i.exec(ln);
      var grp = /group-title="([^"]*)"/i.exec(ln);
      cur = { name: name || (/tvg-name="([^"]*)"/i.exec(ln) || [])[1] || 'Channel', logo: logo ? logo[1] : '', group: grp ? grp[1] : '' };
    } else if (ln.charAt(0) !== '#' && /^https?:/i.test(ln)) {
      out.push({
        id: ln, title: (cur && cur.name) || ln, poster: cur && cur.logo, section: (cur && cur.group) || 'Channels',
        stream: ln
      });
      cur = null;
    }
  }
  memo = out; memoAt = Date.now();
  return out;
}
async function getCatalog(ctx) {
  var all = await load();
  var q = String(ctx.query || '').toLowerCase().trim();
  if (q) all = all.filter(function (x) { return x.title.toLowerCase().indexOf(q) >= 0; });
  return all.slice(0, 600);
}
`;

export function fromM3u(text: string, url: string, category = 'live'): Adapted | null {
  const t = String(text).replace(/^\uFEFF/, '').trimStart();
  if (!t.startsWith('#EXTM3U')) return null;
  if (/#EXT-X-(STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE)/i.test(t)) return null; // a single HLS stream, not a channel list
  if (!/#EXTINF/i.test(t)) return null;
  const code = M3U_JS.replace('__URL__', JSON.stringify(url.trim())).replace('__CATEGORY__', JSON.stringify(category));
  let host = 'Playlist';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  return { name: `Playlist ${host}`, code, categories: [category], format: 'm3u' };
}

// One call for the admin screen: returns what to install, or null if it is not one of these formats.
export function adapt(text: string, url: string): Adapted | null {
  const u = normalizeUrl(url);
  let j: any = null;
  try { j = JSON.parse(text); } catch {}
  if (j) return fromStremio(j, u);
  return fromM3u(text, u);
}
