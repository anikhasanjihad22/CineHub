// Test plugins for checking that the whole pipeline works.
// They return a public demo video (Big Buck Bunny test stream), not real movies.

export const SAMPLE_STREAM_PLUGIN = [
  '// Test stream plugin: gives a public demo video for any title.',
  '// ctx = { tmdbId, imdbId, type, title, year, season, episode }',
  'async function getStreams(ctx) {',
  '  return [',
  "    { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', format: 'hls', quality: 'auto' },",
  '  ];',
  '}',
].join('\n');

export const SAMPLE_CATALOG_PLUGIN = [
  '// Test catalog plugin (Sports / News): two demo items.',
  '// getCatalog({ category, page, query }) -> list of { id, title, poster }',
  '// getLinks({ id }) -> list of streams',
  'async function getCatalog(ctx) {',
  '  var items = [',
  "    { id: 'demo1', title: 'Demo Live Match', poster: null },",
  "    { id: 'demo2', title: 'Demo Daily News', poster: null },",
  '  ];',
  '  var q = (ctx.query || "").toLowerCase();',
  '  return items.filter(function (i) { return !q || i.title.toLowerCase().indexOf(q) >= 0; });',
  '}',
  'async function getLinks(ctx) {',
  "  return [{ url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', format: 'hls', quality: 'auto' }];",
  '}',
].join('\n');
