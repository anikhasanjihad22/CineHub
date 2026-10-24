# CineHub: project structure

Stack: Expo (React Native, TypeScript) + Supabase + TMDB. Android APK first.

```
cinehub/
  app.json                 app name, icon, package id
  package.json
  assets/                  logo-mark.svg, logo-full.svg, icons.svg
  src/
    theme.ts               colors, spacing (dark + amber, from the design)
    lib/
      supabase.ts          Supabase client
      tmdb.ts              trending, search, details (poster, cast, seasons)
    plugins/
      loader.ts            downloads enabled plugins, caches them offline
      sandbox.ts           runs plugin code with only allowed helpers
      resolver.ts          asks all stream plugins, merges, removes duplicates
      catalog.ts           Sports / News lists from catalog plugins
    screens/
      Welcome.tsx          Get Started / Sign In
      Login.tsx            email login + sign up
      Home.tsx             category chips, hero card, rows, platform row
      Search.tsx           TMDB search, then plugin catalogs
      Details.tsx          title page, seasons, Watch Now
      Player.tsx           video, "Server 1, 2, 3" switcher
      Profile.tsx          history, favorites, logout
      admin/
        Plugins.tsx        add / enable / disable / reorder / delete plugins
    components/            Logo, Icon, Chip, PosterCard, HeroCard, BottomNav
```

## Plugin format

A plugin is one JavaScript file plus the row in the `plugins` table.

Stream plugin (Movies / TV Shows):

```js
async function getStreams({ tmdbId, imdbId, type, title, year, season, episode }) {
  // fetch / parse with the allowed helpers, then return:
  return [{ url: "https://...", format: "hls", quality: "1080p", headers: {} }];
}
```

Catalog plugin (Sports / News):

```js
async function getCatalog({ category, page }) {
  return [{ id: "abc", title: "...", poster: "https://...", year: null }];
}
async function getLinks({ id }) {
  return [{ url: "https://...", format: "hls", quality: "auto", headers: {} }];
}
```

Sandbox helpers: `fetch`, `parseHtml(html)`, `log`. Nothing else
(no files, no login data, no other app data).

## How the rules you asked for work

- Admin installs a plugin: row saved in `plugins`. Every user's app loads it on next open.
- No duplicates: Movies/TV are always identified by TMDB id, so one title = one card.
- Many plugins: all stream plugins run at the same time (priority + timeout each).
  Working results merge into Server 1, 2, 3. Plugin names are never shown.
- No result in one plugin: the others still answer. Search falls back the same way.
- Sports/News have no TMDB id, so they come only from catalog plugins.

## Setup order

1. Supabase: create project, run `supabase.sql`, turn on Email login.
2. Make your account admin (last line of the SQL).
3. TMDB: free API key.
4. I give the app files one by one, you paste them into GitHub.
5. GitHub Actions builds the APK.
