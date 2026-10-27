# CineHub plugins (how to write one)

Plugin = one JavaScript file (or a whole Nuvio repo). Manage plugins > paste a link > Fetch > Test > Install.
Every phone gets it automatically (within about a minute, or when the app opens, or on pull-to-refresh).

The app reads what the code can do. No need to choose a type:

| function | what it does | where it shows |
|---|---|---|
| `getStreams(ctx)` | video links for a TMDB movie / episode | Server 1, 2, 3 in the player |
| `getCatalog(ctx)` | its own lists | a page for each category you tick + rows on Home + Search |
| `getLinks(ctx)` | video links for one catalog item | Server 1, 2, 3 in the player |

## getStreams
Called with `{ tmdbId, imdbId, type: "movie"|"tv", title, year, season, episode }`.
Also works: `getStreams(tmdbId, mediaType, season, episode)`.
Return `[{ url, quality?, headers? }]`. `.m3u8`, `.mpd`, `.mp4`, http and https all work.
Other shapes are understood too: `file`, `link`, `stream`, `{ streams: [...] }`, `{ sources: [...] }`.

## getCatalog
Called with `{ category, page, query }`. If `query` is not empty, return only matching items.
Return a list (or `{ sections: [{ title, items }] }`). Each item:
`{ id, title, poster, backdrop, year, overview, rating, section, stream, tmdbId, type }`

- `section`: makes a row with that name on the page.
- `stream` (or `streams: [...]`): direct video link. Then `getLinks` is not needed.
- `tmdbId` + `type`: the item opens as a normal TMDB title and plays with the stream plugins.
- No `tmdbId`: the app looks the title up on TMDB by name (file names like `Inception.2010.1080p.mkv` are cleaned) and shows cast, genres and overview.

Custom categories (anime, cartoon, live ...) become their own tab on Home.

## Nuvio repositories
In Profile > Manage plugins, paste a Nuvio repo `manifest.json` link and press Fetch.
Every provider in that repo is downloaded and installed as a plugin, and each one gets a report line (ok / FAIL).
Providers can use `fetch`, `axios`, `crypto-js` and `cheerio-without-node-native`, like in Nuvio.

## Helpers inside a plugin
`fetch(url, opts)` (adds a browser User-Agent), `utils.tmdb(path, params)`, `utils.strip`, `utils.matchAll`,
`utils.absUrl`, `utils.json`, `utils.sleep`, `console.log` (shown in Test), `require('axios')`.
Also accepted: `module.exports = {...}`, `export const getStreams = ...`.

## Test button
Shows: found functions, number of links / items, first titles, posters, and the exact error if it fails.
A plugin that fails never breaks the app. Its last error is shown on its card in Manage plugins.

## Other formats (v3)
Profile > Manage plugins > paste a link > Fetch. CineHub converts these by itself:

| link | what you get |
|---|---|
| Nuvio repo `manifest.json` | every provider installed at once |
| Stremio addon (`manifest.json` or `stremio://...`) | streams for every movie / episode + the addon's own lists (Home rows, Search) |
| M3U / M3U8 / IPTV playlist | live TV, sports, radio as a category (default `live`) |
| single JavaScript file | normal plugin (`getStreams`, `getCatalog`, `getLinks`) |

Not possible inside this app: CloudStream `.cs3` and Aniyomi extensions (native Kotlin code), and torrent-only
results (a torrent hash has no direct video link; Stremio addons with a debrid service work because they return normal links).
