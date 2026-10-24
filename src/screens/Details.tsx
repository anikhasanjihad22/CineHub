import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Chips } from '../components/Chips';
import { colors, radius } from '../theme';
import { Detail, details, img, seasonEpisodes } from '../lib/tmdb';
import { isFavorite, toggleFavorite } from '../lib/store';

type Ep = { number: number; name: string; overview: string; still: string | null; runtime: number };

export default function Details({ route, navigation }: any) {
  const { id, type } = route.params;
  const { width } = useWindowDimensions();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [fav, setFav] = useState(false);
  const [season, setSeason] = useState(1);
  const [eps, setEps] = useState<Ep[]>([]);

  useEffect(() => {
    details(type, id).then(setD).catch((e) => setError(e?.message ?? 'Could not load.'));
    isFavorite(id, type).then(setFav).catch(() => {});
  }, [id, type]);

  useEffect(() => {
    if (type !== 'tv') return;
    setEps([]);
    seasonEpisodes(id, season).then(setEps).catch(() => setEps([]));
  }, [id, type, season]);

  function play(s = 0, e = 0) {
    if (!d) return;
    navigation.navigate('Player', {
      kind: 'tmdb', tmdbId: d.id, imdbId: d.imdbId, type: d.type, title: d.title, year: d.year, season: s, episode: e,
    });
  }

  if (error) return <Screen><Text style={styles.error}>{error}</Text></Screen>;
  if (!d) return <Screen><ActivityIndicator color={colors.amberSolid} style={{ marginTop: 100 }} /></Screen>;

  const backdrop = img(d.backdrop, 'w780') ?? img(d.poster, 'w780');
  const meta = [d.year, d.type === 'tv' ? `${d.seasons.length} seasons` : d.runtime ? `${d.runtime} min` : '', d.rating ? `${d.rating} rating` : '']
    .filter(Boolean).join('   ');

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ width, height: width * 0.62 }}>
          {backdrop && <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(14,11,16,1)']} style={StyleSheet.absoluteFill} />
          <Pressable onPress={() => navigation.goBack()} style={styles.back}><Icon name="back" /></Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: -30 }}>
          <Text style={styles.title}>{d.title}</Text>
          <Text style={styles.meta}>{meta}</Text>
          {d.genres.length > 0 && <Text style={styles.genres}>{d.genres.join(', ')}</Text>}

          <View style={styles.actions}>
            {d.type === 'movie' && (
              <Pressable onPress={() => play()} style={{ flex: 1 }}>
                <LinearGradient colors={colors.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.watch}>
                  <Icon name="play" size={18} color={colors.onAmber} />
                  <Text style={styles.watchText}>Watch Now</Text>
                </LinearGradient>
              </Pressable>
            )}
            <Pressable
              onPress={async () => setFav(await toggleFavorite(d.id, d.type))}
              style={[styles.heart, d.type === 'tv' && { marginLeft: 'auto' }]}
            >
              <Icon name="heart" color={fav ? colors.amberSolid : colors.text} filled={fav} />
            </Pressable>
          </View>

          <Text style={styles.overview}>{d.overview}</Text>
        </View>

        {d.type === 'tv' && (
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
  ep: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: radius.md, backgroundColor: colors.glass },
  epThumb: { width: 96, height: 56, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
  epTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  epSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
