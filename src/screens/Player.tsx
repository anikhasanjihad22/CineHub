import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { Icon, IconName } from '../components/Icon';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { SeekBar } from '../components/SeekBar';
import { colors, FILL, radius } from '../theme';
import { langTag, resolveStreams } from '../plugins/resolver';
import { resolveCatalogLinks } from '../plugins/catalog';
import type { Stream } from '../plugins/types';
import { getProgress, saveProgress } from '../lib/store';
import { openSupport } from '../lib/support';
import { dlId, startDownload, useDownloads } from '../lib/downloads';
import { details, img, seasonEpisodes } from '../lib/tmdb';

const START_TIMEOUT = 25_000;
const AUTONEXT_KEY = 'cinehub:autonext';
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Ep = { number: number; name: string; overview: string; still: string | null; runtime: number };
type Panel = null | 'menu' | 'servers' | 'speed' | 'tracks' | 'episodes';

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

function RoundBtn({ icon, onPress, size = 24, label }: { icon: IconName; onPress: () => void; size?: number; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.rbtn}>
      <Icon name={icon} size={size} />
      {!!label && <Text style={styles.rlabel}>{label}</Text>}
    </Pressable>
  );
}

function MenuRow({ icon, label, value, onPress }: { icon: IconName; label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.opt}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
        <Icon name={icon} size={22} />
        <Text style={styles.optText}>{label}</Text>
      </View>
      {!!value && <Text style={styles.menuVal}>{value}</Text>}
    </Pressable>
  );
}

export default function Player({ route, navigation }: any) {
  const p = route.params;
  const pRef = useRef(p);
  pRef.current = p;
  const isTmdb = p.kind === 'tmdb';
  const isLocal = p.kind === 'local'; // a downloaded file: plays with no internet
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ---- sources (hidden from the viewer: the app picks a working one by itself) ----
  const [servers, setServers] = useState<Stream[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'none'>('loading');
  const [searching, setSearching] = useState(true);
  const [allFailed, setAllFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);

  const serversRef = useRef<Stream[]>([]);
  const idxRef = useRef(0);
  const resumeRef = useRef(0);
  const resumedRef = useRef(false);
  const startTimer = useRef<any>(null);
  const errIdx = useRef(-1);

  // ---- ui state ----
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockHint, setLockHint] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [speed, setSpeed] = useState(1);
  const [flash, setFlash] = useState('');
  const [scrubbing, setScrubbing] = useState(false);

  // ---- playback state (read from the player twice a second) ----
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [subs, setSubs] = useState<any[]>([]);
  const [auds, setAuds] = useState<any[]>([]);
  const [curSub, setCurSub] = useState<any>(null);
  const [curAud, setCurAud] = useState<any>(null);

  // ---- series info ----
  const [seasons, setSeasons] = useState<{ number: number; episodes: number }[]>([]);
  const [eps, setEps] = useState<Ep[]>([]);
  const [panelSeason, setPanelSeason] = useState<number>(p.season ?? 1);
  const [panelEps, setPanelEps] = useState<Ep[]>([]);
  const [autoNext, setAutoNext] = useState(true);
  const [countdown, setCountdown] = useState(0);

  const unavailable = !searching && (phase === 'none' || allFailed);
  const fade = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<any>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<any>(null);
  const flashTimer = useRef<any>(null);

  const player = useVideoPlayer(null, (pl: any) => {
    pl.loop = false;
    try { pl.timeUpdateEventInterval = 0.5; } catch {}
  });

  // ------------------------------------------------------------------ orientation
  // Opening the player turns the phone to landscape by itself; leaving puts it back to portrait.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    const restore = () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); };
    const unsub = navigation.addListener('beforeRemove', restore);
    return () => { unsub(); restore(); };
  }, [navigation]);

  useEffect(() => {
    AsyncStorage.getItem(AUTONEXT_KEY).then((v) => { if (v === '0') setAutoNext(false); }).catch(() => {});
  }, []);

  // ------------------------------------------------------------------ 1) find sources
  const epKey = `${p.tmdbId ?? p.item?.key ?? ''}:${p.season ?? 0}:${p.episode ?? 0}`;
  useEffect(() => {
    let alive = true;
    serversRef.current = []; idxRef.current = 0; errIdx.current = -1;
    setServers([]); setIdx(0); setPhase('loading'); setAllFailed(false); setSearching(true);
    setStarted(false); setEnded(false); setCountdown(0); setPos(0); setDur(0);
    if (isLocal) {
      const one: Stream[] = [{ url: p.localUri, format: p.format === 'hls' ? 'hls' : 'mp4', label: 'Offline' }];
      serversRef.current = one;
      setServers(one); setPhase('ready'); setSearching(false);
      return () => { alive = false; };
    }
    (async () => {
      try {
        if (isTmdb) {
          resumeRef.current = await getProgress(p.tmdbId, p.type, p.season ?? 0, p.episode ?? 0).catch(() => 0);
        }
        const onUpdate = (list: Stream[]) => {
          if (!alive) return;
          serversRef.current = list;
          setServers(list);
          setPhase('ready');
        };
        const final = isTmdb
          ? await resolveStreams(
              { tmdbId: p.tmdbId, imdbId: p.imdbId, type: p.type, title: p.title, year: p.year, season: p.season, episode: p.episode },
              onUpdate,
            )
          : await resolveCatalogLinks(p.item, onUpdate);
        if (!alive) return;
        serversRef.current = final;
        setServers(final);
        setPhase(final.length ? 'ready' : 'none');
      } catch {
        if (alive) setPhase(serversRef.current.length ? 'ready' : 'none');
      } finally {
        if (alive) setSearching(false);
      }
    })();
    return () => { alive = false; };
  }, [attempt, epKey]);

  function tryNext() {
    const next = idxRef.current + 1;
    if (next < serversRef.current.length) {
      idxRef.current = next;
      setIdx(next);
    } else {
      setAllFailed(true);
    }
  }

  // A slower source answered after every source so far had failed: move on to it.
  useEffect(() => {
    if (allFailed && servers.length > idxRef.current + 1) {
      setAllFailed(false);
      tryNext();
    }
  }, [servers.length]);

  // ------------------------------------------------------------------ 2) load the chosen source
  const current = servers[idx];
  useEffect(() => {
    if (!current) return;
    idxRef.current = idx;
    resumedRef.current = false;
    errIdx.current = -1;
    let cancelled = false;
    const src: any = { uri: current.url };
    if (current.headers) src.headers = current.headers;
    if (current.format === 'hls' || current.format === 'dash') src.contentType = current.format;

    clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => { if (!cancelled) tryNext(); }, START_TIMEOUT);

    (async () => {
      try {
        const pl: any = player;
        if (pl.replaceAsync) await pl.replaceAsync(src);
        else pl.replace(src);
        if (!cancelled) player.play();
      } catch {
        if (!cancelled) tryNext();
      }
    })();
    return () => { cancelled = true; clearTimeout(startTimer.current); };
  }, [current?.url, attempt, epKey]);

  // ------------------------------------------------------------------ 3) player events
  const readTracks = useCallback(() => {
    try {
      const pl: any = player;
      setSubs(Array.from(pl.availableSubtitleTracks ?? []));
      setAuds(Array.from(pl.availableAudioTracks ?? []));
      setCurSub(pl.subtitleTrack ?? null);
      setCurAud(pl.audioTrack ?? null);
    } catch {}
  }, [player]);

  useEffect(() => {
    const sub = player.addListener('statusChange', (e: any) => {
      if (e.status === 'readyToPlay') {
        clearTimeout(startTimer.current);
        setAllFailed(false);
        setStarted(true);
        try { (player as any).playbackRate = speed; } catch {}
        if (!resumedRef.current && resumeRef.current > 10) {
          resumedRef.current = true;
          try { player.currentTime = resumeRef.current; } catch {}
        }
        readTracks();
      } else if (e.status === 'error') {
        clearTimeout(startTimer.current);
        if (errIdx.current === idxRef.current) return;
        errIdx.current = idxRef.current;
        tryNext();
      }
    });
    const end = (player as any).addListener('playToEnd', () => setEnded(true));
    return () => { sub.remove(); end.remove(); };
  }, [player, speed]);

  // read position / state from the player
  useEffect(() => {
    const t = setInterval(() => {
      try {
        const pl: any = player;
        setPos(pl.currentTime || 0);
        setDur(pl.duration || 0);
        setPlaying(!!pl.playing);
        setBuf(pl.bufferedPosition || 0);
        setBuffering(pl.status === 'loading');
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, [player]);

  // ------------------------------------------------------------------ 4) watch progress
  async function save() {
    const q = pRef.current;
    if (q.kind !== 'tmdb') return;
    try {
      const t = player.currentTime;
      const d = player.duration;
      if (t > 5) await saveProgress({ id: q.tmdbId, type: q.type, season: q.season ?? 0, episode: q.episode ?? 0, progress: t, duration: d || 0 });
    } catch {}
  }
  useEffect(() => {
    const t = setInterval(save, 10_000);
    return () => clearInterval(t);
  }, []);

  async function close() {
    await save();
    try { player.pause(); } catch {}
    navigation.goBack();
  }

  // ------------------------------------------------------------------ series: seasons, episodes, next episode
  useEffect(() => {
    if (!isTmdb || p.type !== 'tv') return;
    details('tv', p.tmdbId)
      .then((d) => setSeasons(d.seasons.map((s) => ({ number: s.number, episodes: s.episodes }))))
      .catch(() => {});
  }, [p.tmdbId]);

  useEffect(() => {
    if (!isTmdb || p.type !== 'tv') return;
    seasonEpisodes(p.tmdbId, p.season ?? 1).then(setEps).catch(() => setEps([]));
  }, [p.tmdbId, p.season]);

  useEffect(() => {
    if (panel !== 'episodes' || !isTmdb) return;
    setPanelEps([]);
    seasonEpisodes(p.tmdbId, panelSeason).then(setPanelEps).catch(() => setPanelEps([]));
  }, [panel, panelSeason]);

  const curSeason = p.season ?? 1;
  const curEp = p.episode ?? 1;
  let nextEp: { season: number; episode: number } | null = null;
  if (isTmdb && p.type === 'tv') {
    const s = seasons.find((x) => x.number === curSeason);
    if (s && curEp < s.episodes) nextEp = { season: curSeason, episode: curEp + 1 };
    else if (s) {
      const later = seasons.filter((x) => x.number > curSeason).sort((a, b) => a.number - b.number)[0];
      if (later) nextEp = { season: later.number, episode: 1 };
    } else if (eps.length && curEp < eps.length) {
      nextEp = { season: curSeason, episode: curEp + 1 };
    }
  }

  async function goEpisode(s: number, e: number) {
    await save();
    setPanel(null);
    resumeRef.current = 0;
    navigation.setParams({ season: s, episode: e });
  }

  // "Up next" countdown after an episode ends
  useEffect(() => {
    if (!ended || !nextEp || !autoNext) { setCountdown(0); return; }
    const target = nextEp;
    let c = 6;
    setCountdown(c);
    const t = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(t);
        setCountdown(0);
        goEpisode(target.season, target.episode);
      } else {
        setCountdown(c);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [ended]);
  const upNext = ended && !!nextEp;

  // ------------------------------------------------------------------ controls
  useEffect(() => {
    Animated.timing(fade, { toValue: visible && !locked ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [visible, locked]);

  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (visible && playing && !panel && !scrubbing && !locked) {
      hideTimer.current = setTimeout(() => setVisible(false), 3500);
    }
    return () => clearTimeout(hideTimer.current);
  }, [visible, playing, panel, scrubbing, locked]);

  function seekTo(t: number) {
    try { player.currentTime = Math.max(0, Math.min(t, dur || t)); } catch {}
    setPos(t);
  }
  function skip(sec: number) {
    seekTo((player.currentTime || 0) + sec);
    setFlash(sec > 0 ? `+${sec}s` : `${sec}s`);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 600);
  }
  function togglePlay() {
    try {
      if (ended) { player.currentTime = 0; setEnded(false); }
      if (player.playing) player.pause(); else player.play();
    } catch {}
    setPlaying(!playing);
    setVisible(true);
  }

  function onTap(e: any) {
    if (locked) {
      setLockHint(true);
      setTimeout(() => setLockHint(false), 2500);
      return;
    }
    const now = Date.now();
    const x = e.nativeEvent.locationX;
    if (now - lastTap.current < 300) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      skip(x < width / 2 ? -10 : 10);
      return;
    }
    lastTap.current = now;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setVisible((v) => !v), 260);
  }

  function setRate(r: number) {
    setSpeed(r);
    try { (player as any).playbackRate = r; } catch {}
    setPanel(null);
  }
  function pickSub(t: any) {
    try { (player as any).subtitleTrack = t; } catch {}
    setCurSub(t);
  }
  function pickAud(t: any) {
    try { (player as any).audioTrack = t; } catch {}
    setCurAud(t);
  }

  // ---- 3-dot menu: server choice and download ----
  const dls = useDownloads();
  const dl = isTmdb ? dls.find((d) => d.id === dlId(p.type, p.tmdbId, p.season ?? 0, p.episode ?? 0)) : undefined;

  function pickServer(i: number) {
    setPanel(null);
    if (i === idxRef.current && started) return;
    try { resumeRef.current = Math.max(player.currentTime || 0, 0); } catch {}
    setStarted(false);
    setAllFailed(false);
    errIdx.current = -1;
    idxRef.current = i;
    setIdx(i);
    flashMsg(`Server ${i + 1}`);
  }

  function flashMsg(t: string) {
    setFlash(t);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 1400);
  }

  function download() {
    setPanel(null);
    if (!isTmdb || (dl && (dl.status === 'done' || dl.status === 'downloading'))) return;
    // the working server first, then the others as a back-up
    const order = [servers[idx], ...servers.filter((_, i) => i !== idx)].filter(Boolean) as Stream[];
    if (!order.length) return flashMsg('No server to download from');
    startDownload(
      {
        tmdbId: p.tmdbId, type: p.type, season: p.season, episode: p.episode, title: p.title,
        subtitle: p.type === 'tv' ? `S${curSeason}:E${curEp}${epName ? '  ' + epName : ''}` : p.year ?? '',
        posterUrl: p.poster ? img(p.poster, 'w342') : null,
      },
      order,
    ).catch(() => {});
    flashMsg('Download started. See the Downloads tab.');
  }

  const hasTracks = subs.length > 0 || auds.length > 1;
  const epName = eps.find((x) => x.number === curEp)?.name;
  const subTitle = isLocal ? (p.subtitle ?? '') : isTmdb && p.type === 'tv' ? `S${curSeason}:E${curEp}${epName ? '  ' + epName : ''}` : '';

  // ------------------------------------------------------------------ "not available" screen
  if (unavailable) {
    return (
      <Screen>
        <StatusBar hidden={false} />
        <Pressable onPress={close} style={styles.backPlain} hitSlop={8}><Icon name="back" size={22} /></Pressable>
        <ScrollView contentContainerStyle={styles.na} showsVerticalScrollIndicator={false}>
          <View style={styles.naIcon}><Icon name="info" size={30} color={colors.muted} /></View>
          <Text style={styles.naTitle}>Not available</Text>
          <Text style={styles.naText}>
            {p.title ? `"${p.title}" ` : 'This title '}is not available right now. It may be added soon, so please try again later.
          </Text>
          <View style={styles.naBtns}>
            <Button label="Try again" icon="refresh" variant="light" onPress={() => setAttempt((a) => a + 1)} style={{ flex: 1 }} />
            <Button label="Support" icon="send" variant="secondary" onPress={openSupport} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const showSpinner = !started || buffering;
  const sidePad = { paddingLeft: Math.max(insets.left, 24), paddingRight: Math.max(insets.right, 24) };

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <View style={[FILL, styles.box]}>
        <VideoView player={player} style={FILL} nativeControls={false} allowsFullscreen={false} contentFit={fit} />

        {/* tap layer: tap = show / hide controls, double tap = skip 10 seconds */}
        <Pressable style={FILL} onPress={onTap} />

        {showSpinner && (
          <View style={styles.center} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            {!started && <Text style={styles.loadText}>Loading...</Text>}
          </View>
        )}

        {!!flash && (
          <View style={styles.center} pointerEvents="none">
            <View style={styles.flash}><Text style={styles.flashText}>{flash}</Text></View>
          </View>
        )}

        <Animated.View style={[FILL, { opacity: fade }]} pointerEvents={visible && !locked ? 'box-none' : 'none'}>
          <View style={styles.dim} pointerEvents="none" />

          {/* top bar */}
          <View style={[styles.topBar, sidePad, { paddingTop: Math.max(insets.top, 14) }]}>
            <RoundBtn icon="back" onPress={close} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.title} numberOfLines={1}>{p.title}</Text>
              {!!subTitle && <Text style={styles.subtitle} numberOfLines={1}>{subTitle}</Text>}
            </View>
            <RoundBtn icon="more" size={26} onPress={() => setPanel('menu')} />
          </View>

          {/* centre buttons */}
          {started && !showSpinner && (
            <View style={styles.centerRow} pointerEvents="box-none">
              <Pressable onPress={() => skip(-10)} hitSlop={10} style={styles.skipBtn}><Icon name="rewind" size={38} /></Pressable>
              <Pressable onPress={togglePlay} hitSlop={10} style={[styles.playBtn, { width: 74, height: 74, borderRadius: 37 }]}>
                <Icon name={playing ? 'pause' : 'play'} size={38} />
              </Pressable>
              <Pressable onPress={() => skip(10)} hitSlop={10} style={styles.skipBtn}><Icon name="forward" size={38} /></Pressable>
            </View>
          )}

          {/* bottom bar */}
          <View style={[styles.bottomBar, sidePad, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.timeRow}>
              <Text style={styles.time}>{fmt(pos)}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.time}>-{fmt(Math.max(dur - pos, 0))}</Text>
            </View>
            <SeekBar
              position={pos} duration={dur} buffered={buf}
              onStart={() => setScrubbing(true)}
              onCommit={(t) => { setScrubbing(false); seekTo(t); }}
            />
            <View style={styles.tools}>
              <RoundBtn icon="speed" size={22} label={speed === 1 ? 'Speed' : `${speed}x`} onPress={() => setPanel('speed')} />
              <RoundBtn icon="aspect" size={22} label={fit === 'contain' ? 'Fit' : 'Fill'} onPress={() => setFit((f) => (f === 'contain' ? 'cover' : 'contain'))} />
              {hasTracks && <RoundBtn icon="subtitles" size={22} label="Audio & subtitles" onPress={() => { readTracks(); setPanel('tracks'); }} />}
              {isTmdb && p.type === 'tv' && <RoundBtn icon="episodes" size={22} label="Episodes" onPress={() => { setPanelSeason(curSeason); setPanel('episodes'); }} />}
              {!!nextEp && <RoundBtn icon="next" size={22} label="Next" onPress={() => goEpisode(nextEp!.season, nextEp!.episode)} />}
              <View style={{ flex: 1 }} />
              <RoundBtn icon="lock" size={22} label="Lock" onPress={() => { setLocked(true); setVisible(false); }} />
            </View>
          </View>
        </Animated.View>

        {locked && lockHint && (
          <View style={[styles.lockWrap, { left: Math.max(insets.left, 20) }]}>
            <Pressable onPress={() => { setLocked(false); setLockHint(false); setVisible(true); }} style={styles.lockBtn}>
              <Icon name="unlock" size={22} />
              <Text style={styles.lockText}>Unlock</Text>
            </Pressable>
          </View>
        )}

        {upNext && (
          <View style={[styles.upNext, { right: Math.max(insets.right, 16), bottom: 96 }]}>
            <Text style={styles.upLabel}>Up next</Text>
            <Text style={styles.upTitle} numberOfLines={1}>Season {nextEp!.season}, Episode {nextEp!.episode}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable onPress={() => goEpisode(nextEp!.season, nextEp!.episode)} style={styles.upPlay}>
                <Icon name="play" size={14} color="#000" />
                <Text style={styles.upPlayText}>{countdown > 0 ? `Play (${countdown})` : 'Play now'}</Text>
              </Pressable>
              <Pressable onPress={() => { setEnded(false); setVisible(true); }} style={styles.upCancel}>
                <Text style={styles.upCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* side sheet (landscape) / bottom sheet (portrait) */}
      <Modal visible={!!panel} transparent animationType="fade" onRequestClose={() => setPanel(null)} statusBarTranslucent>
        <Pressable style={[styles.backdrop, { alignItems: 'flex-end' }]} onPress={() => setPanel(null)}>
          <Pressable
            onPress={() => {}}
            style={[styles.sheet, { width: Math.min(360, width * 0.55), height: '100%', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }]}
          >
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{panel === 'menu' ? 'Options' : panel === 'servers' ? 'Choose server' : panel === 'speed' ? 'Playback speed' : panel === 'tracks' ? 'Audio & subtitles' : 'Episodes'}</Text>
              <Pressable onPress={() => setPanel(null)} hitSlop={10}><Icon name="close" size={22} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              {panel === 'menu' && (
                <>
                  {!isLocal && (
                    <MenuRow icon="server" label="Server" value={servers.length ? `Server ${idx + 1}` : '...'} onPress={() => setPanel('servers')} />
                  )}
                  {isTmdb && (
                    <MenuRow
                      icon={dl?.status === 'done' ? 'check' : 'download'}
                      label={dl?.status === 'done' ? 'Downloaded' : dl?.status === 'downloading' ? 'Downloading...' : dl?.status === 'error' ? 'Download again' : 'Download'}
                      value={dl?.status === 'downloading' ? `${Math.round(dl.progress * 100)}%` : ''}
                      onPress={download}
                    />
                  )}
                  <MenuRow icon="speed" label="Playback speed" value={speed === 1 ? 'Normal' : `${speed}x`} onPress={() => setPanel('speed')} />
                  {hasTracks && <MenuRow icon="subtitles" label="Audio & subtitles" onPress={() => { readTracks(); setPanel('tracks'); }} />}
                  <MenuRow icon="aspect" label="Picture" value={fit === 'contain' ? 'Fit' : 'Fill'} onPress={() => { setFit((f) => (f === 'contain' ? 'cover' : 'contain')); setPanel(null); }} />
                  {isTmdb && p.type === 'tv' && <MenuRow icon="episodes" label="Episodes" onPress={() => { setPanelSeason(curSeason); setPanel('episodes'); }} />}
                </>
              )}

              {panel === 'servers' && (
                <>
                  {servers.length === 0 && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}
                  {servers.map((sv, i) => {
                    const on = i === idx;
                    const tag = [langTag(sv), sv.quality].filter(Boolean).join(' · ');
                    return (
                      <Pressable key={sv.url} onPress={() => pickServer(i)} style={styles.opt}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={[styles.optText, on && { fontWeight: '800' }]}>Server {i + 1}</Text>
                          {!!tag && <Text style={styles.epMeta}>{tag}</Text>}
                        </View>
                        {on && <Icon name="check" size={20} color={colors.accent} />}
                      </Pressable>
                    );
                  })}
                  {searching && servers.length > 0 && <Text style={[styles.epMeta, { marginTop: 14 }]}>Looking for more servers...</Text>}
                  <Text style={[styles.epMeta, { marginTop: 14, lineHeight: 18 }]}>If a server does not play, pick another one. The app also switches by itself when a server fails.</Text>
                </>
              )}

              {panel === 'speed' && SPEEDS.map((r) => (
                <Pressable key={r} onPress={() => setRate(r)} style={styles.opt}>
                  <Text style={[styles.optText, r === speed && { fontWeight: '800' }]}>{r === 1 ? 'Normal' : `${r}x`}</Text>
                  {r === speed && <Icon name="check" size={20} color={colors.accent} />}
                </Pressable>
              ))}

              {panel === 'tracks' && (
                <>
                  {auds.length > 1 && <Text style={styles.optGroup}>Audio</Text>}
                  {auds.length > 1 && auds.map((t, i) => {
                    const on = !!curAud && (curAud.id ?? curAud.label) === (t.id ?? t.label);
                    return (
                      <Pressable key={'a' + i} onPress={() => pickAud(t)} style={styles.opt}>
                        <Text style={[styles.optText, on && { fontWeight: '800' }]}>{t.label || t.language || `Track ${i + 1}`}</Text>
                        {on && <Icon name="check" size={20} color={colors.accent} />}
                      </Pressable>
                    );
                  })}
                  {subs.length > 0 && <Text style={styles.optGroup}>Subtitles</Text>}
                  {subs.length > 0 && (
                    <Pressable onPress={() => pickSub(null)} style={styles.opt}>
                      <Text style={[styles.optText, !curSub && { fontWeight: '800' }]}>Off</Text>
                      {!curSub && <Icon name="check" size={20} color={colors.accent} />}
                    </Pressable>
                  )}
                  {subs.map((t, i) => {
                    const on = !!curSub && (curSub.id ?? curSub.label) === (t.id ?? t.label);
                    return (
                      <Pressable key={'s' + i} onPress={() => pickSub(t)} style={styles.opt}>
                        <Text style={[styles.optText, on && { fontWeight: '800' }]}>{t.label || t.language || `Subtitle ${i + 1}`}</Text>
                        {on && <Icon name="check" size={20} color={colors.accent} />}
                      </Pressable>
                    );
                  })}
                </>
              )}

              {panel === 'episodes' && (
                <>
                  {seasons.length > 1 && (
                    <View style={{ marginBottom: 14 }}>
                      <Chips
                        padded={false}
                        items={seasons.map((s) => ({ key: String(s.number), label: `Season ${s.number}` }))}
                        value={String(panelSeason)} onChange={(k) => setPanelSeason(Number(k))}
                      />
                    </View>
                  )}
                  {panelEps.length === 0 && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}
                  {panelEps.map((e) => {
                    const on = panelSeason === curSeason && e.number === curEp;
                    return (
                      <Pressable key={e.number} onPress={() => goEpisode(panelSeason, e.number)} style={styles.opt}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={[styles.optText, on && { color: colors.accent, fontWeight: '800' }]} numberOfLines={1}>{e.number}. {e.name}</Text>
                          {!!e.runtime && <Text style={styles.epMeta}>{e.runtime} min</Text>}
                        </View>
                        {on && <Icon name="check" size={20} color={colors.accent} />}
                      </Pressable>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  box: { backgroundColor: '#000', overflow: 'hidden' },
  center: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  loadText: { color: colors.textDim, marginTop: 10, fontSize: 13 },
  dim: { ...FILL, backgroundColor: 'rgba(0,0,0,0.5)' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  rbtn: { alignItems: 'center', justifyContent: 'center', minWidth: 40, height: 44, paddingHorizontal: 6 },
  rlabel: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
  centerRow: { ...FILL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 },
  skipBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: -4 },
  time: { color: '#fff', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flash: { paddingHorizontal: 18, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  flashText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  lockWrap: { position: 'absolute', top: '40%' },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.65)' },
  lockText: { color: '#fff', fontWeight: '700' },
  upNext: { position: 'absolute', width: 230, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(20,20,24,0.95)', borderWidth: 1, borderColor: colors.borderStrong },
  upLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  upTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  upPlay: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.sm, backgroundColor: '#fff' },
  upPlayText: { color: '#000', fontWeight: '800', fontSize: 13 },
  upCancel: { paddingHorizontal: 12, height: 36, borderRadius: radius.sm, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  upCancelText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  infoTitle: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  infoSub: { color: colors.muted, fontSize: 14, marginTop: 4 },
  infoHead: { color: colors.text, fontSize: 17, fontWeight: '800' },
  epRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  epThumb: { width: 120, height: 68, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  epPlay: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  epTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  epMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, padding: 20 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optText: { color: '#fff', fontSize: 15 },
  menuVal: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  optGroup: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 },
  backPlain: { width: 44, height: 44, margin: 10, alignItems: 'center', justifyContent: 'center' },
  na: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 30, maxWidth: 520, alignSelf: 'center', width: '100%' },
  naBtns: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 22 },
  naIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  naTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 14 },
  naText: { color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
});
