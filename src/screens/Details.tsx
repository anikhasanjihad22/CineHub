import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Chips } from '../components/Chips';
import { SectionTitle } from '../components/Poster';
import { Credit } from '../components/Credit';
import { colors, radius } from '../theme';
import { Cast, Detail, details, hasKey, img, matchTitle, seasonEpisodes } from '../lib/tmdb';
import { isFavorite, toggleFavorite } from '../lib/store';
import type { CatalogItem } from '../plugins/types';

type Ep = { number: number; name: string; overview: string; still: string | null; runtime: number };

// Two ways to open this page:
//  1) { id, type }  a TMDB title. Plays with the stream plugins.
//  2) { item }      an item from a plugin or your own server. Plays its own links.
//                   Cast, genres and overview are taken from TMDB by matching the title.
export default function Details({ route, navigation }: any) {
  const item: CatalogItem | undefined = route.params.item;
  const { id, type } = route.params;
  const { width } = useWindowDimensions();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [fav, setFav] = useState(false);
  const [season, setSeason] = useState(1);
  const [eps, setEps] = useState<Ep[]>([]);

  useEffect(() => {
    if (item) {
      if (!hasKey()) return;
      matchTitle(item.title, item.type, item.year).then(setD).catch(() => {});
      return;
    }
    details(type, id).then(setD).catch((e) => setError(e?.message ?? 'Could not load.'));
    isFavorite(id, type).then(setFav).catch(() => {});
  }, [id, type, item]);

  useEffect(() => {
    if (item || type !== 'tv') return;
    setEps([]);
    seasonEpisodes(id, season).then(setEps).catch(() => setEps([]));
  }, [id, type, season, item]);

  function play(s = 0, e = 0) {
    if (item) return navigation.navigate('Player', { kind: 'catalog', item, title: item.title });
    if (!d) return;
    navigation.navigate('Player', {
      kind: 'tmdb', tmdbId: d.id, imdbId: d.imdbId, type: d.type, title: d.title, year: d.year, season: s, episode: e,
    });
  }

  if (error) return <Screen><Text style={styles.error}>{error}</Text></Screen>;
  if (!item && !d) return <Screen><ActivityIndicator color={colors.amberSolid} style={{ marginTop: 100 }} /></Screen>;

  // What the page shows: the plugin's own data first, TMDB fills the gaps.
  const title = item ? item.title : d!.title;
  const overview = item ? item.overview || d?.overview || '' : d!.overview;
  const backdrop = item
    ? item.backdrop || img(d?.backdrop, 'w780') || item.poster || img(d?.poster, 'w780')
    : img(d!.backdrop, 'w780') ?? img(d!.poster, 'w780');
  const year = item ? item.year || d?.year : d!.year;
  const rating = item ? item.rating || d?.rating : d!.rating;
  const runtime = d?.runtime || 0;
  const isTv = item ? false : d!.type === 'tv';
  const meta = [year, isTv ? `${d!.seasons.length} seasons` : runtime ? `${runtime} min` : '', rating ? `${rating} rating` : '']
    .filter(Boolean).join('   ');
  const genres = d?.genres ?? [];
  const cast: Cast[] = d?.cast ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={{ width, height: width * 0.62 }}>
          {backdrop && <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(14,11,16,1)']} style={StyleSheet.absoluteFill} />
          <Pressable onPress={() => navigation.goBack()} style={styles.back}><Icon name="back" /></Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: -30 }}>
          <Text style={styles.title}>{title}</Text>
          {!!meta && <Text style={styles.meta}>{meta}</Text>}
          {genres.length > 0 && <Text style={styles.genres}>{genres.join(', ')}</Text>}

          <View style={styles.actions}>
            {!isTv && (
              <Pressable onPress={() => play()} style={{ flex: 1 }}>
                <LinearGradient colors={colors.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.watch}>
                  <Icon name="play" size={18} color={colors.onAmber} />
                  <Text style={styles.watchText}>Watch Now</Text>
                </LinearGradient>
              </Pressable>
            )}
            {!item && d && (
              <Pressable
                onPress={async () => setFav(await toggleFavorite(d.id, d.type))}
                style={[styles.heart, isTv && { marginLeft: 'auto' }]}
              >
                <Icon name="heart" color={fav ? colors.amberSolid : colors.text} filled={fav} />
              </Pressable>
            )}
          </View>

          {!!overview && <Text style={styles.overview}>{overview}</Text>}
        </View>

        {cast.length > 0 && (
          <View style={{ marginTop: 24 }}>
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

        {isTv && d && (
          <View style={{ marginTop: 22 }}>
            <Chips
              items={d.seasons.map((s) => ({ key: String(s.number), label: `Season ${s.number}` }))}
              value={String(season)} onChange={(k) => setSeason(Number(k))}
            />
            <View style={{ paddingHorizontal: 20, marginTop: 14, gap: 10 }}>
              {eps.length === 0 && <ActivityIndicator color={colors.amberSolid} style={{ marginTop: 20 }} />}
              {eps.map((e) => (
                <Pressable key={e.number} onPress={() => play(season, e.number)} style={styles.ep}>
                  <View style={styles.epThumb}>
                    {e.still && <Image source={{ uri: img(e.still, 'w300')! }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                    <Icon name="play" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.epTitle} numberOfLines={1}>{e.number}. {e.name}</Text>
                    <Text style={styles.epSub} numberOfLines={2}>{e.overview || (e.runtime ? `${e.runtime} min` : '')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Credit />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, textAlign: 'center', marginTop: 100, padding: 30 },
  back: { position: 'absolute', top: 14, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 6 },
  genres: { color: colors.muted, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  watch: { height: 52, borderRadius: radius.pill, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  watchText: { color: colors.onAmber, fontSize: 16, fontWeight: '700' },
  heart: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  overview: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 18 },
  castItem: { width: 82, alignItems: 'center' },
  castPhoto: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.glassStrong },
  castNone: { alignItems: 'center', justifyContent: 'center' },
  castInitial: { color: colors.text, fontSize: 24, fontWeight: '700' },
  castName: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  castRole: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  ep: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: radius.md, backgroundColor: colors.glass },
  epThumb: { width: 96, height: 56, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
  epTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  epSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
