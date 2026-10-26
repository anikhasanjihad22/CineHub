import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { PosterRow, SectionTitle, Skeleton } from '../components/Poster';
import { colors, FILL, radius } from '../theme';
import { Cast, Detail, details, hasKey, img, matchTitle, seasonEpisodes, similar, Title } from '../lib/tmdb';
import { isFavorite, toggleFavorite } from '../lib/store';
import { openSupport } from '../lib/support';
import { dlId, quickDownload, useDownloads } from '../lib/downloads';
import { Focusable } from '../components/Focusable';
import { isTV } from '../lib/platform';
import type { CatalogItem } from '../plugins/types';

type Ep = { number: number; name: string; overview: string; still: string | null; runtime: number };

// Two ways to open this page:
//  1) { id, type }  a TMDB title. Plays with the stream plugins.
//  2) { item }      an item from a plugin. Plays its own links.
//                   Cast, genres and overview are taken from TMDB by matching the title.
export default function Details({ route, navigation }: any) {
  const item: CatalogItem | undefined = route.params.item;
  const { id, type } = route.params;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [fav, setFav] = useState(false);
  const [season, setSeason] = useState(1);
  const [eps, setEps] = useState<Ep[]>([]);
  const [more, setMore] = useState<Title[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState('');
  const dls = useDownloads();

  useEffect(() => {
    setError('');
    if (item) {
      if (!hasKey()) return;
      matchTitle(item.title, item.type, item.year).then(setD).catch(() => {});
      return;
    }
    details(type, id)
      .then((x) => {
        setD(x);
        if (x.type === 'tv' && x.seasons.length) setSeason(x.seasons[0].number);
      })
      .catch((e) => setError(e?.message ?? 'Could not load.'));
    isFavorite(id, type).then(setFav).catch(() => {});
    similar(type, id).then((l) => setMore(l.slice(0, 20))).catch(() => {});
  }, [id, type, item, attempt]);

  useEffect(() => {
    if (item || type !== 'tv') return;
    setEps([]);
    seasonEpisodes(id, season).then(setEps).catch(() => setEps([]));
  }, [id, type, season, item]);

  function play(s = 0, e = 0) {
    if (item) return navigation.navigate('Player', { kind: 'catalog', item, title: item.title });
    if (!d) return;
    navigation.navigate('Player', {
      kind: 'tmdb', tmdbId: d.id, imdbId: d.imdbId, type: d.type, title: d.title, year: d.year, season: s, episode: e, poster: d.poster,
    });
  }

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const dlState = (s = 0, e = 0) => {
    if (!d) return undefined;
    return dls.find((x) => x.id === dlId(d.type, d.id, s, e));
  };
  async function download(s = 0, e = 0) {
    if (!d) return;
    const cur = dlState(s, e);
    if (cur?.status === 'done') return say('Already downloaded');
    if (cur?.status === 'downloading') return say('Already downloading');
    say('Looking for a server...');
    const r = await quickDownload({
      tmdbId: d.id, type: d.type, season: s, episode: e, title: d.title,
      subtitle: d.type === 'tv' ? `S${s}:E${e}` : d.year ?? '', posterUrl: d.poster ? img(d.poster, 'w342') : null,
    });
    say(r === 'none' ? 'No server available to download right now' : r === 'exists' ? 'Already in Downloads' : 'Download started');
  }

  if (error) {
    return (
      <Screen>
        <Pressable onPress={() => navigation.goBack()} style={styles.backPlain} hitSlop={8}><Icon name="back" size={22} /></Pressable>
        <View style={styles.errBox}>
          <Icon name="info" size={36} color={colors.muted} />
          <Text style={styles.errTitle}>Could not load this title</Text>
          <Text style={styles.errText}>{error}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Button label="Try again" small icon="refresh" onPress={() => setAttempt((a) => a + 1)} />
            <Button label="Support" small variant="secondary" icon="send" onPress={openSupport} />
          </View>
        </View>
      </Screen>
    );
  }

  if (!item && !d) {
    return (
      <Screen edges={['bottom']}>
        <Skeleton width="100%" height={width * 1.1} radiusPx={0} />
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton width="70%" height={28} />
          <Skeleton width="45%" height={14} />
          <Skeleton width="100%" height={48} />
        </View>
        <Pressable onPress={() => navigation.goBack()} style={[styles.back, { top: insets.top + 10 }]} hitSlop={8}><Icon name="back" /></Pressable>
      </Screen>
    );
  }

  // What the page shows: the plugin's own data first, TMDB fills the gaps.
  const title = item ? item.title : d!.title;
  const overview = item ? item.overview || d?.overview || '' : d!.overview;
  const cover = item
    ? img(d?.poster, 'w780') || item.poster || item.backdrop || img(d?.backdrop, 'w780')
    : img(d!.poster, 'w780') ?? img(d!.backdrop, 'w780');
  const year = item ? item.year || d?.year : d!.year;
  const rating = item ? item.rating || d?.rating : d!.rating;
  const runtime = d?.runtime || 0;
  const isTv = item ? false : d!.type === 'tv';
  const genres = d?.genres ?? [];
  const cast: Cast[] = d?.cast ?? [];
  const heroH = isTV ? Math.round(width * 0.4) : Math.min(Math.round(width * 1.15), 520);

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ width, height: heroH, backgroundColor: colors.surface }}>
          {cover && <Image source={{ uri: cover }} style={FILL} resizeMode="cover" />}
          <LinearGradient colors={['rgba(10,10,12,0.55)', 'rgba(10,10,12,0)']} style={styles.topFade} />
          <LinearGradient colors={colors.scrim} locations={[0, 0.6, 1]} style={styles.bottomFade} />
        </View>
        <Pressable onPress={() => navigation.goBack()} style={[styles.back, { top: insets.top + 10 }]} hitSlop={8}><Icon name="back" /></Pressable>

        <View style={{ paddingHorizontal: 20, marginTop: -70, maxWidth: isTV ? 760 : undefined }}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.metaRow}>
            {!!year && <Text style={styles.meta}>{year}</Text>}
            {!!rating && (
              <View style={styles.rate}>
                <Icon name="star" size={12} color={colors.gold} />
                <Text style={styles.rateText}>{rating}</Text>
              </View>
            )}
            {isTv && d ? <Text style={styles.meta}>{d.seasons.length} season{d.seasons.length === 1 ? '' : 's'}</Text> : runtime ? <Text style={styles.meta}>{runtime} min</Text> : null}
            <View style={styles.hd}><Text style={styles.hdText}>HD</Text></View>
          </View>

          <View style={{ marginTop: 18, gap: 10 }}>
            <Button
              label={isTv ? `Play S${season} E1` : 'Play'} variant="light" icon="play"
              onPress={() => (isTv ? play(season, 1) : play())}
            />
            {!item && d && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  label={fav ? 'In My List' : 'My List'} variant="secondary" icon={fav ? 'check' : 'plus'} style={{ flex: 1 }}
                  onPress={async () => setFav(await toggleFavorite(d.id, d.type))}
                />
                {!isTv && (
                  <Button
                    label={dlState()?.status === 'done' ? 'Downloaded' : dlState()?.status === 'downloading' ? `${Math.max(0, Math.round((dlState()!.progress) * 100))}%` : 'Download'}
                    variant="secondary" icon={dlState()?.status === 'done' ? 'check' : 'download'} style={{ flex: 1 }}
                    onPress={() => download()}
                  />
                )}
              </View>
            )}
          </View>

          {!!overview && (
            <Pressable onPress={() => setExpanded((e) => !e)} style={{ marginTop: 18 }}>
              <Text style={styles.overview} numberOfLines={expanded ? undefined : 4}>{overview}</Text>
              {overview.length > 200 && <Text style={styles.more}>{expanded ? 'Show less' : 'Read more'}</Text>}
            </Pressable>
          )}

          {genres.length > 0 && (
            <View style={styles.genres}>
              {genres.map((g) => <View key={g} style={styles.genre}><Text style={styles.genreText}>{g}</Text></View>)}
            </View>
          )}
        </View>

        {isTv && d && (
          <View style={{ marginTop: 26 }}>
            <SectionTitle title="Episodes" />
            {d.seasons.length > 1 && (
              <View style={{ marginBottom: 14 }}>
                <Chips
                  items={d.seasons.map((s) => ({ key: String(s.number), label: `Season ${s.number}` }))}
                  value={String(season)} onChange={(k) => setSeason(Number(k))}
                />
              </View>
            )}
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              {eps.length === 0 && <ActivityIndicator color={colors.text} style={{ marginTop: 16 }} />}
              {eps.map((e) => (
                <Pressable key={e.number} onPress={() => play(season, e.number)} style={({ pressed }) => [styles.ep, pressed && { opacity: 0.75 }]}>
                  <View style={styles.epThumb}>
                    {e.still && <Image source={{ uri: img(e.still, 'w300')! }} style={FILL} resizeMode="cover" />}
                    <View style={styles.epPlay}><Icon name="play" size={14} /></View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.epTitle} numberOfLines={1}>{e.number}. {e.name}</Text>
                    {!!e.runtime && <Text style={styles.epRun}>{e.runtime} min</Text>}
                    {!!e.overview && <Text style={styles.epSub} numberOfLines={2}>{e.overview}</Text>}
                  </View>
                  <Focusable onPress={() => download(season, e.number)} hitSlop={8} ring={20} style={styles.epDl}>
                    <Icon name={dlState(season, e.number)?.status === 'done' ? 'check' : 'download'} size={18} color={dlState(season, e.number)?.status === 'downloading' ? colors.accent : '#fff'} />
                  </Focusable>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {cast.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <SectionTitle title="Cast" />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={cast}
              keyExtractor={(c, i) => `${c.id}-${i}`}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              renderItem={({ item: c }) => (
                <View style={styles.castItem}>
                  {c.photo ? (
                    <Image source={{ uri: img(c.photo, 'w185')! }} style={styles.castPhoto} />
                  ) : (
                    <View style={[styles.castPhoto, styles.castNone]}><Text style={styles.castInitial}>{(c.name[0] ?? '?').toUpperCase()}</Text></View>
                  )}
                  <Text style={styles.castName} numberOfLines={2}>{c.name}</Text>
                  {!!c.character && <Text style={styles.castRole} numberOfLines={2}>{c.character}</Text>}
                </View>
              )}
            />
          </View>
        )}

        {!item && (
          <PosterRow
            title="More like this" data={more} keyOf={(t: Title) => t.type + t.id} uriOf={(t: Title) => img(t.poster)}
            labelOf={(t: Title) => t.title} ratingOf={(t: Title) => t.rating}
            onPress={(t: Title) => navigation.push('Details', { id: t.id, type: t.type })}
          />
        )}
      </ScrollView>
      {!!toast && <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  epDl: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 34, alignItems: 'center' },
  toastText: { color: '#fff', fontWeight: '700', backgroundColor: 'rgba(40,40,46,0.96)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, overflow: 'hidden' },
  errBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 14 },
  errText: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  backPlain: { width: 44, height: 44, margin: 10, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', top: 14, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  meta: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  rate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rateText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  hd: { paddingHorizontal: 6, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  hdText: { color: colors.textDim, fontSize: 10, fontWeight: '800' },
  overview: { color: colors.textDim, fontSize: 15, lineHeight: 23 },
  more: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 6 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  genre: { paddingHorizontal: 14, height: 30, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  genreText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  ep: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  epThumb: { width: 130, height: 74, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  epPlay: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  epTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  epRun: { color: colors.muted, fontSize: 12, marginTop: 2 },
  epSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  castItem: { width: 84, alignItems: 'center' },
  castPhoto: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface2 },
  castNone: { alignItems: 'center', justifyContent: 'center' },
  castInitial: { color: colors.text, fontSize: 24, fontWeight: '700' },
  castName: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  castRole: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
});
