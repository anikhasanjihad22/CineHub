import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Chips } from '../components/Chips';
import { colors, radius } from '../theme';
import { resolveStreams } from '../plugins/resolver';
import { resolveCatalogLinks } from '../plugins/catalog';
import type { Stream } from '../plugins/types';
import { getProgress, saveProgress } from '../lib/store';

export default function Player({ route, navigation }: any) {
  const p = route.params;
  const isTmdb = p.kind === 'tmdb';
  const { width } = useWindowDimensions();

  const [servers, setServers] = useState<Stream[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'none'>('loading');
  const [allFailed, setAllFailed] = useState(false);

  const serversRef = useRef<Stream[]>([]);
  const idxRef = useRef(0);
  const resumeRef = useRef(0);
  const resumedRef = useRef(false);

  const player = useVideoPlayer(null, (pl) => { pl.loop = false; });

  // 1) Ask all plugins for links (Server 1, 2, 3 ...)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (isTmdb) {
          resumeRef.current = await getProgress(p.tmdbId, p.type, p.season ?? 0, p.episode ?? 0).catch(() => 0);
        }
        const list = isTmdb
          ? await resolveStreams({
              tmdbId: p.tmdbId, imdbId: p.imdbId, type: p.type, title: p.title, year: p.year, season: p.season, episode: p.episode,
            })
          : await resolveCatalogLinks(p.item);
        if (!alive) return;
        serversRef.current = list;
        setServers(list);
        setPhase(list.length ? 'ready' : 'none');
      } catch {
        if (alive) setPhase('none');
      }
    })();
    return () => { alive = false; };
  }, []);

  // 2) Load the chosen server into the player
  useEffect(() => {
    idxRef.current = idx;
    const s = servers[idx];
    if (!s) return;
    resumedRef.current = false;
    const src: any = { uri: s.url };
    if (s.headers) src.headers = s.headers;
    if (s.format === 'hls' || s.format === 'dash') src.contentType = s.format;
    (async () => {
      try {
        const pl: any = player;
        if (pl.replaceAsync) await pl.replaceAsync(src);
        else pl.replace(src);
        player.play();
      } catch {
        tryNext();
      }
    })();
  }, [servers, idx]);

  function tryNext() {
    if (idxRef.current + 1 < serversRef.current.length) setIdx(idxRef.current + 1);
    else setAllFailed(true);
  }

  // 3) If a server fails, move to the next one automatically
  useEffect(() => {
    const sub = player.addListener('statusChange', (e: any) => {
      if (e.status === 'readyToPlay') {
        setAllFailed(false);
        if (!resumedRef.current && resumeRef.current > 10) {
          resumedRef.current = true;
          try { player.currentTime = resumeRef.current; } catch {}
        }
      } else if (e.status === 'error') {
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
          <Text style={styles.note}>No servers available for this title right now. Please try again later.</Text>
        )}

        {servers.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.label}>Servers</Text>
            <Chips
              padded={false}
              items={servers.map((s, i) => ({ key: String(i), label: s.label ?? `Server ${i + 1}` }))}
              value={String(idx)}
              onChange={(k) => { setAllFailed(false); setIdx(Number(k)); }}
            />
            {allFailed && <Text style={styles.note}>This server is not working. Pick another one.</Text>}
          </View>
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
