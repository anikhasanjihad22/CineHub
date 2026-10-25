import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Stream } from '../plugins/types';
import { resolveStreams } from '../plugins/resolver';

// Offline downloads.
// - A movie / episode is saved inside the app's own storage (documentDirectory/downloads/<id>/).
// - mp4 links are downloaded as one file. HLS (m3u8) links are downloaded piece by piece and a local playlist is written.
// - The list of downloads is kept in AsyncStorage, so it can be shown (and played) without internet.
// Downloads run while the app is open.

// expo-file-system keeps the classic API at "expo-file-system/legacy" (SDK 54+). Older layouts are handled too.
let FS: any;
try { FS = require('expo-file-system/legacy'); } catch { FS = require('expo-file-system'); }

const KEY = 'cinehub:downloads:v1';
const ROOT = () => `${FS.documentDirectory}downloads/`;

export type DlStatus = 'downloading' | 'done' | 'error';
export type DlItem = {
  id: string;
  tmdbId: number;
  type: 'movie' | 'tv';
  season: number;
  episode: number;
  title: string;
  subtitle: string;
  poster: string | null; // local file once saved, otherwise null
  status: DlStatus;
  progress: number; // 0..1
  size: number; // bytes
  localUri: string; // file to play when done
  format: 'hls' | 'mp4';
  error?: string;
  createdAt: number;
};

export type DlMeta = {
  tmdbId: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title: string;
  subtitle?: string;
  posterUrl?: string | null;
};

export const dlId = (type: string, tmdbId: number, season = 0, episode = 0) =>
  `${type}-${tmdbId}-${type === 'tv' ? season : 0}-${type === 'tv' ? episode : 0}`;

// ------------------------------------------------------------------ store
let items: DlItem[] = [];
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const cancelled = new Set<string>();
const running = new Set<string>();
let lastEmit = 0;

function emit(force = false) {
  const now = Date.now();
  if (!force && now - lastEmit < 400) return;
  lastEmit = now;
  listeners.forEach((l) => { try { l(); } catch {} });
}

async function persist() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

function load(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const list: DlItem[] = raw ? JSON.parse(raw) : [];
        // anything that was still running when the app closed was interrupted
        items = list.map((d) => (d.status === 'downloading' ? { ...d, status: 'error' as DlStatus, error: 'Interrupted. Tap retry to continue.' } : d));
      } catch { items = []; }
      emit(true);
    })();
  }
  return loaded;
}

function patch(id: string, p: Partial<DlItem>, save = false) {
  items = items.map((d) => (d.id === id ? { ...d, ...p } : d));
  emit(save);
  if (save) persist();
}

export function useDownloads(): DlItem[] {
  const [, setN] = useState(0);
  useEffect(() => {
    load();
    const l = () => setN((n) => n + 1);
    listeners.add(l);
    l();
    return () => { listeners.delete(l); };
  }, []);
  return items;
}

export function getDownload(id: string) { return items.find((d) => d.id === id); }

// ------------------------------------------------------------------ helpers
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...(headers ?? {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function absolute(base: string, ref: string): string {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (ref.startsWith('//')) return base.split('//')[0] + ref;
  const m = base.match(/^(https?:\/\/[^/]+)(\/[^?#]*)?/i);
  if (!m) return ref;
  const origin = m[1];
  const dir = (m[2] ?? '/').replace(/[^/]*$/, '');
  if (ref.startsWith('/')) return origin + ref;
  const parts = (dir + ref).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.') out.push(p);
  }
  return origin + out.join('/');
}

async function sizeOf(uri: string): Promise<number> {
  try {
    const i: any = await FS.getInfoAsync(uri);
    return i.exists ? i.size || 0 : 0;
  } catch { return 0; }
}

async function removeDir(uri: string) {
  try { await FS.deleteAsync(uri, { idempotent: true }); } catch {}
}

class Cancel extends Error {}
function check(id: string) { if (cancelled.has(id)) throw new Cancel('cancelled'); }

// ------------------------------------------------------------------ mp4
async function downloadMp4(id: string, s: Stream, dir: string) {
  const target = `${dir}video.mp4`;
  const task = FS.createDownloadResumable(
    s.url, target, { headers: { 'User-Agent': UA, ...(s.headers ?? {}) } },
    (p: any) => {
      const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : 0;
      patch(id, { progress: total ? Math.min(0.99, p.totalBytesWritten / total) : 0, size: p.totalBytesWritten });
    },
  );
  const stop = setInterval(() => { if (cancelled.has(id)) { try { task.cancelAsync(); } catch {} } }, 500);
  try {
    const res = await task.downloadAsync();
    check(id);
    if (!res || res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res?.status ?? 0}`);
  } finally { clearInterval(stop); }
  const size = await sizeOf(target);
  if (size < 100_000) throw new Error('File is too small');
  return { localUri: target, size };
}

// ------------------------------------------------------------------ hls
type Line = { kind: 'text'; text: string } | { kind: 'uri'; url: string; name: string } | { kind: 'attr'; before: string; url: string; name: string; after: string };

async function downloadHls(id: string, s: Stream, dir: string) {
  const headers = { 'User-Agent': UA, ...(s.headers ?? {}) };
  let playlistUrl = s.url;
  let text = await fetchText(playlistUrl, s.headers);
  check(id);

  // master playlist: take the best quality variant
  if (/#EXT-X-STREAM-INF/i.test(text)) {
    const lines = text.split(/\r?\n/);
    let best = { bw: -1, url: '' };
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
      const bw = Number((lines[i].match(/BANDWIDTH=(\d+)/i) ?? [])[1] ?? 0);
      let j = i + 1;
      while (j < lines.length && (!lines[j].trim() || lines[j].startsWith('#'))) j++;
      if (j < lines.length && bw > best.bw) best = { bw, url: lines[j].trim() };
    }
    if (!best.url) throw new Error('No video found in playlist');
    playlistUrl = absolute(playlistUrl, best.url);
    text = await fetchText(playlistUrl, s.headers);
    check(id);
  }
  if (!/#EXTINF/i.test(text)) throw new Error('Playlist has no video pieces');

  // read the playlist and list everything that has to be downloaded
  const out: Line[] = [];
  let n = 0;
  for (const raw of text.split(/\r?\n/)) {
    const ln = raw.trim();
    if (!ln) continue;
    if (ln.startsWith('#')) {
      const m = ln.match(/^(#EXT-X-(?:KEY|MAP):.*?URI=")([^"]+)(".*)$/i);
      if (m) {
        const name = /EXT-X-KEY/i.test(ln) ? `key_${n++}.key` : `init_${n++}.mp4`;
        out.push({ kind: 'attr', before: m[1], url: absolute(playlistUrl, m[2]), name, after: m[3] });
      } else {
        out.push({ kind: 'text', text: ln });
      }
    } else {
      out.push({ kind: 'uri', url: absolute(playlistUrl, ln), name: `seg_${n++}.ts` });
    }
  }

  const jobs = out.filter((l) => l.kind !== 'text') as Exclude<Line, { kind: 'text' }>[];
  const segCount = jobs.filter((j) => j.kind === 'uri').length || 1;
  let done = 0;
  let bytes = 0;
  let next = 0;
  let failed: any = null;

  const worker = async () => {
    while (!failed) {
      const i = next++;
      if (i >= jobs.length) return;
      const job = jobs[i];
      const target = dir + job.name;
      try {
        check(id);
        let sz = await sizeOf(target);
        if (sz <= 0) {
          let ok = false;
          let last: any;
          for (let a = 0; a < 3 && !ok; a++) { // 3 tries per piece
            try {
              check(id);
              const r = await FS.downloadAsync(job.url, target, { headers });
              if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
              ok = true;
            } catch (e) { if (e instanceof Cancel) throw e; last = e; await removeDir(target); }
          }
          if (!ok) throw last ?? new Error('Download failed');
          sz = await sizeOf(target);
        }
        bytes += sz;
        if (job.kind === 'uri') done++;
        patch(id, { progress: Math.min(0.99, done / segCount), size: bytes });
      } catch (e) { failed = e; return; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (failed) throw failed;
  check(id);

  // local playlist that points at the downloaded files
  const lines = out.map((l) => (l.kind === 'text' ? l.text : l.kind === 'uri' ? l.name : `${l.before}${l.name}${l.after}`));
  const target = `${dir}index.m3u8`;
  await FS.writeAsStringAsync(target, lines.join('\n') + '\n');
  return { localUri: target, size: bytes };
}

// ------------------------------------------------------------------ public api
export function isActive(id: string) { return running.has(id); }

// Starts (or restarts) a download. `streams` are tried in order until one works.
export async function startDownload(meta: DlMeta, streams: Stream[]): Promise<string> {
  await load();
  const id = dlId(meta.type, meta.tmdbId, meta.season ?? 0, meta.episode ?? 0);
  if (running.has(id)) return id;
  const old = getDownload(id);
  if (old?.status === 'done') return id;

  const dir = `${ROOT()}${id}/`;
  try { await FS.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
  if (old) {
    // a retry starts clean, so a half-written piece from the last try can never be played
    try {
      const names: string[] = await FS.readDirectoryAsync(dir);
      await Promise.all(names.filter((x) => x !== 'poster.jpg').map((x) => removeDir(dir + x)));
    } catch {}
  }

  const base: DlItem = {
    id, tmdbId: meta.tmdbId, type: meta.type, season: meta.season ?? 0, episode: meta.episode ?? 0,
    title: meta.title, subtitle: meta.subtitle ?? '', poster: old?.poster ?? null,
    status: 'downloading', progress: old?.progress ?? 0, size: old?.size ?? 0, localUri: '', format: 'mp4',
    createdAt: old?.createdAt ?? Date.now(),
  };
  items = old ? items.map((d) => (d.id === id ? base : d)) : [base, ...items];
  cancelled.delete(id);
  running.add(id);
  emit(true);
  persist();

  (async () => {
    // poster copy, so the Downloads list looks right with no internet
    if (meta.posterUrl && !base.poster) {
      try {
        const r = await FS.downloadAsync(meta.posterUrl, `${dir}poster.jpg`);
        if (r.status === 200) patch(id, { poster: r.uri });
      } catch {}
    }
    let lastErr = '';
    try {
      const tryList = streams.slice(0, 6);
      for (const s of tryList) {
        check(id);
        const hls = s.format === 'hls' || /\.m3u8(\?|$)/i.test(s.url);
        try {
          patch(id, { progress: 0, size: 0, format: hls ? 'hls' : 'mp4' });
          const r = hls ? await downloadHls(id, s, dir) : await downloadMp4(id, s, dir);
          patch(id, { status: 'done', progress: 1, size: r.size, localUri: r.localUri, error: undefined }, true);
          return;
        } catch (e: any) {
          if (e instanceof Cancel || cancelled.has(id)) throw new Cancel('cancelled');
          lastErr = e?.message ?? 'Download failed';
          // clean the pieces of the failed try, then use the next server
          try {
            const names: string[] = await FS.readDirectoryAsync(dir);
            await Promise.all(names.filter((x) => x !== 'poster.jpg').map((x) => removeDir(dir + x)));
          } catch {}
        }
      }
      patch(id, { status: 'error', error: lastErr ? `Could not download (${lastErr})` : 'No server available to download', }, true);
    } catch (e) {
      // cancelled by the user: item is already removed from the list
    } finally {
      running.delete(id);
      cancelled.delete(id);
      emit(true);
    }
  })();
  return id;
}

// Retry after an error: finds the servers again and starts over.
export async function retryDownload(d: DlItem) {
  const meta: DlMeta = { tmdbId: d.tmdbId, type: d.type, season: d.season, episode: d.episode, title: d.title, subtitle: d.subtitle };
  patch(d.id, { status: 'downloading', progress: 0, error: undefined }, true);
  try {
    const streams = await resolveStreams({
      tmdbId: d.tmdbId, type: d.type, title: d.title, season: d.type === 'tv' ? d.season : undefined, episode: d.type === 'tv' ? d.episode : undefined,
    });
    if (!streams.length) throw new Error('no server');
    await startDownload(meta, streams);
  } catch {
    patch(d.id, { status: 'error', error: 'No server available to download right now' }, true);
  }
}

export async function removeDownload(id: string) {
  await load();
  if (running.has(id)) cancelled.add(id);
  items = items.filter((d) => d.id !== id);
  emit(true);
  await persist();
  // wait a moment so a running task can stop writing before the folder is removed
  setTimeout(() => removeDir(`${ROOT()}${id}/`), running.has(id) ? 1200 : 0);
}

export function formatSize(b: number): string {
  if (!b || b < 1) return '0 MB';
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.max(1, Math.round(b / 1024 ** 2))} MB`;
}
