// Ready-made plugins for checking that everything works. Press "Test" in Manage plugins to try them.
// They use a public demo video (Big Buck Bunny test stream), not real movies.

const DEMO = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export const SAMPLE_STREAM_PLUGIN = [
  '// Stream plugin: gives video links for any Movie / TV title.',
  '// ctx = { tmdbId, imdbId, type: "movie" | "tv", title, year, season, episode }',
  '// Also works: async function getStreams(tmdbId, mediaType, season, episode)',
  'async function getStreams(ctx) {',
  '  return [',
  `    { url: '${DEMO}', quality: 'auto' },`,
  '  ];',
  '}',
].join('\n');

export const SAMPLE_CATALOG_PLUGIN = [
  '// Catalog plugin: its own lists. Every category you tick gets its own page in the app.',
  '// getCatalog({ category, page, query }) -> list of items. "section" makes a row on the page.',
  '// Item: { id, title, poster, backdrop, year, overview, section, stream | streams, tmdbId, type }',
  'async function getCatalog(ctx) {',
  '  var items = [',
  "    { id: 'demo1', title: 'Demo Live Match', poster: null, section: 'Live now' },",
  "    { id: 'demo2', title: 'Demo Daily News', poster: null, section: 'Today' },",
  '  ];',
  '  var q = (ctx.query || "").toLowerCase();',
  '  return items.filter(function (i) { return !q || i.title.toLowerCase().indexOf(q) >= 0; });',
  '}',
  '// Used when an item has no direct "stream". Return the video links for that item.',
  'async function getLinks(ctx) {',
  `  return [{ url: '${DEMO}', quality: 'auto' }];`,
  '}',
].join('\n');

export const SAMPLE_LOCAL_PLUGIN = [
  '// Your own server on the same Wi-Fi (plain http is allowed).',
  '// Change BASE to your computer / phone address. Not localhost: use the Wi-Fi IP, e.g. 192.168.0.10',
  "var BASE = 'http://192.168.0.10:8080';",
  '',
  '// Your server returns a list like: [{ "name": "Inception.2010.1080p.mkv", "file": "/movies/Inception.mkv" }]',
  'async function getCatalog(ctx) {',
  "  var r = await fetch(BASE + '/list.json');",
  '  var list = await r.json();',
  '  var q = (ctx.query || "").toLowerCase();',
  '  return list',
  '    .filter(function (x) { return !q || x.name.toLowerCase().indexOf(q) >= 0; })',
  '    .map(function (x) {',
  '      return {',
  '        id: x.file,',
  '        title: x.name,            // the app cleans file names and finds cast / poster info on TMDB',
  "        section: 'My server',",
  '        stream: BASE + x.file,    // direct video link',
  '      };',
  '    });',
  '}',
].join('\n');
