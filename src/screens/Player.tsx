import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Chips } from '../components/Chips';
import { colors, radius } from '../theme';
import { useAuth } from '../lib/auth';
import { resolveStreams } from '../plugins/resolver';
import { resolveCatalogLinks } from '../plugins/catalog';
import type { Stream } from '../plugins/types';
import { getProgress, saveProgress } from '../lib/store';

const START_TIMEOUT = 20_000;

export default function Player({ route, navigation }: any) {
  const p = route.params;
  const isTmdb = p.kind === 'tmdb';
  const { isAdmin } = useAuth();
  const { width } = useWindowDimensions();

  const [servers, setServers] = useState<Stream[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'none'>('loading');
  const [searching, setSearching] = useState(true);
  const [allFailed, setAllFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const serversRef = useRef<Stream[]>([]);
  const idxRef = useRef(0);
  const resumeRef = useRef(0);
  const resumedRef = useRef(false);
  const startTimer = useRef<any>(null);
  const errIdx = useRef(-1);

  const player = useVideoPlayer(null, (pl) => { pl.loop = false; });

  // 1) Ask all plugins for links. Servers appear one by one as plugins answer,
  //    and the video starts from the first one that arrives.
  useEffect(() => {
    let alive = true;
    serversRef.current = []; idxRef.current = 0; errIdx.current = -1;
    setServers([]); setIdx(0); setPhase('loading'); setAllFailed(false); setSearching(true);
    (async () => {
      try {
        if (isTmdb && attempt === 0) {
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
  }, [attempt]);

  function tryNext() {
    const next = idxRef.current + 1;
    if (next < serversRef.current.length) {
      idxRef.current = next;
      setIdx(next);
    } else {
      setAllFailed(true);
    }
  }

  // A slower plugin answered after every server so far had failed: move on to its link.
  useEffect(() => {
    if (allFailed && servers.length > idxRef.current + 1) {
      setAllFailed(false);
      tryNext();
    }
  }, [servers.length]);

  // 2) Load the chosen server into the player (only when the link itself changes).
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
  }, [current?.url, attempt]);

  // 3) If a server fails, move to the next one automatically
  useEffect(() => {
    const sub = player.addListener('statusChange', (e: any) => {
      if (e.status === 'readyToPlay') {
        clearTimeout(startTimer.current);
        setAllFailed(false);
        if (!resumedRef.current && resumeRef.current > 10) {
          resumedRef.current = true;
          try { player.currentTime = resumeRef.current; } catch {}
        }
      } else if (e.status === 'error') {
        clearTimeout(startTimer.current);
        if (errIdx.current === idxRef.current) return;
        errIdx.current = idxRef.current;
        tryNext();
      }
    });
    return () => sub.remove();
  }, [player]);

  // 4) Save watch progress every 10 seconds
  async function save() {
    if (!isTmdb) return;
    try {
      const t = player.currentTime;
      const d = player.duration;
      if (t > 5) await saveProgress({ id: p.tmdbId, type: p.type, season: p.season ?? 0, episode: p.episode ?? 0, progress: t, duration: d || 0 });
    } catch {}
  }
  useEffect(() => {
    const t = setInterval(save, 10_000);
    return () => clearInterval(t);
  }, []);

  async function close() {
    await save();
    navigation.goBack();
  }

  const sub = isTmdb && p.type === 'tv' ? `Season ${p.season}  Episode ${p.episode}` : '';
  const retry = () => setAttempt((a) => a + 1);

  return (
    <Screen>
      <View style={{ width, height: width * 9 / 16, backgroundColor: '#000' }}>
        <VideoView player={player} style={{ flex: 1 }} nativeControls allowsFullscreen contentFit="contain" />
        {phase === 'loading' && (
          <View style={styles.overlay}><ActivityIndicator color={colors.amberSolid} /></View>
        )}
        <Pressable onPress={close} style={styles.back}><Icon name="back" /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.title}>{p.title}</Text>
        {!!sub && <Text style={styles.sub}>{sub}</Text>}

        {phase === 'loading' && <Text style={styles.note}>Finding the best servers...</Text>}
        {phase === 'none' && (
          <>
            <Text style={styles.note}>No servers available for this title right now. Please try again later.</Text>
            {isAdmin && (
              <Text style={styles.note}>
                Admin tip: Profile, Manage plugins, then press Test on your plugin to see why it returns nothing.
              </Text>
            )}
          </>
        )}

        {servers.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.label}>Servers</Text>
            <Chips
              padded={false}
              items={servers.map((s, i) => ({ key: String(i), label: s.label ?? `Server ${i + 1}` }))}
              value={String(idx)}
              onChange={(k) => { setAllFailed(false); errIdx.current = -1; idxRef.current = Number(k); setIdx(Number(k)); }}
            />
            {searching && <Text style={styles.note}>Looking for more servers...</Text>}
            {allFailed && !searching && <Text style={styles.note}>This server is not working. Pick another one.</Text>}
          </View>
        )}

        {!searching && (phase === 'none' || allFailed) && (
          <Pressable style={styles.next} onPress={retry}>
            <Text style={styles.nextText}>Search again</Text>
          </Pressable>
        )}

        {isTmdb && p.type === 'tv' && (
          <Pressable
            style={styles.next}
            onPress={() => { save(); navigation.replace('Player', { ...p, episode: (p.episode ?? 1) + 1 }); }}
          >
            <Text style={styles.nextText}>Next episode</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', top: 12, left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4 },
  note: { color: colors.muted, fontSize: 14, marginTop: 14, lineHeight: 20 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  next: { marginTop: 24, height: 50, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: colors.text, fontWeight: '600', fontSize: 15 },
});
