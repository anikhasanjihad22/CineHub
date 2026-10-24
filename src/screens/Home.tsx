import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { Chips } from '../components/Chips';
import { HeroCard } from '../components/HeroCard';
import { PosterGrid, PosterRow, SectionTitle } from '../components/Poster';
import { Logo } from '../components/Logo';
import { colors, radius } from '../theme';
import {
  details, hasKey, img, MediaType, popular, Provider, providers, Title, topRated, trending,
} from '../lib/tmdb';
import { recentHistory } from '../lib/store';
import { getPlugins } from '../plugins/loader';
import { loadCatalog } from '../plugins/catalog';
import type { CatalogItem } from '../plugins/types';

const LABELS: Record<string, string> = { movies: 'Movies', tv: 'TV Shows', sports: 'Sports', news: 'News' };

export default function Home({ navigation }: any) {
  const { session } = useAuth();
  const name = (session?.user.email ?? '').split('@')[0];

  const [cats, setCats] = useState<string[]>(['movies', 'tv']);
  const [cat, setCat] = useState('movies');
  const [hero, setHero] = useState<Title | null>(null);
  const [rows, setRows] = useState<{ title: string; items: Title[] }[]>([]);
  const [provs, setProvs] = useState<Provider[]>([]);
  const [history, setHistory] = useState<Title[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sports / News chips appear only when a catalog plugin for them is installed.
  useEffect(() => {
    getPlugins().then((ps) => {
      const set = new Set<string>(['movies', 'tv']);
      ps.filter((p) => p.kind === 'catalog').forEach((p) =>
        p.categories.forEach((c) => { if (c === 'sports' || c === 'news') set.add(c); }),
      );
      setCats(['movies', 'tv', 'sports', 'news'].filter((c) => set.has(c)));
    });
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        if (cat === 'movies' || cat === 'tv') {
          if (!hasKey()) throw new Error('TMDB key is missing. Paste it in src/config.ts');
          const type: MediaType = cat === 'movies' ? 'movie' : 'tv';
          const [tr, pop, top, prov, hist] = await Promise.all([
            trending(type), popular(type), topRated(type), providers(type).catch(() => []), recentHistory(type).catch(() => []),
          ]);
          const histTitles = (await Promise.all(hist.map((id) => details(type, id).catch(() => null)))).filter(Boolean) as Title[];
          if (!alive) return;
          // Every title shows only once on the page.
          const seen = new Set<number>();
          const take = (list: Title[]) => list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
          const heroItem = tr[0] ?? null;
          if (heroItem) seen.add(heroItem.id);
          setHero(heroItem);
          setRows([
            { title: 'Trending this week', items: take(tr) },
            { title: 'Popular', items: take(pop) },
            { title: 'Top rated', items: take(top) },
          ]);
          setProvs(prov);
          setHistory(histTitles);
          setCatalog([]);
        } else {
          const items = await loadCatalog(cat);
          if (!alive) return;
          setCatalog(items);
          setHero(null); setRows([]); setProvs([]); setHistory([]);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'Could not load. Check your internet.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cat]);

  const openTitle = (t: Title) => navigation.navigate('Details', { id: t.id, type: t.type });
  const type: MediaType = cat === 'tv' ? 'tv' : 'movie';

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(name[0] ?? 'C').toUpperCase()}</Text></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.hello}>Hello, {name}</Text>
        </View>
        <Logo size={28} />
      </View>

      <Chips items={cats.map((c) => ({ key: c, label: LABELS[c] }))} value={cat} onChange={setCat} />

      {loading && <ActivityIndicator color={colors.amberSolid} style={{ marginTop: 60 }} />}
      {!!error && !loading && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && (cat === 'movies' || cat === 'tv') && (
        <>
          {hero && <View style={{ marginTop: 18 }}><HeroCard item={hero} onPress={() => openTitle(hero)} /></View>}

          <PosterRow
            title="Continue watching" data={history} keyOf={(t) => String(t.id)}
            uriOf={(t) => img(t.poster)} labelOf={(t) => t.title} onPress={openTitle}
          />

          {provs.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionTitle title="Streaming platforms" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                {provs.map((p) => (
                  <Pressable key={p.id} onPress={() => navigation.navigate('List', { title: p.name, type, providerId: p.id })}>
                    <Image source={{ uri: img(p.logo, 'w154')! }} style={styles.prov} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {rows.map((r) => (
            <PosterRow
              key={r.title} title={r.title} data={r.items} keyOf={(t) => String(t.id)}
              uriOf={(t) => img(t.poster)} labelOf={(t) => t.title} onPress={openTitle}
            />
          ))}
        </>
      )}

      {!loading && !error && (cat === 'sports' || cat === 'news') && (
        <View style={{ marginTop: 22 }}>
          <SectionTitle title={LABELS[cat]} />
          {catalog.length === 0 ? (
            <Text style={styles.empty}>Nothing here right now.</Text>
          ) : (
            <PosterGrid
              data={catalog} keyOf={(c) => c.key} uriOf={(c) => c.poster} labelOf={(c) => c.title}
              onPress={(c) => navigation.navigate('Player', { kind: 'catalog', item: c, title: c.title })}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.amberSolid, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onAmber, fontWeight: '800', fontSize: 18 },
  hello: { color: colors.text, fontSize: 17, fontWeight: '700' },
  prov: { width: 72, height: 72, borderRadius: radius.md },
  error: { color: colors.danger, textAlign: 'center', marginTop: 50, paddingHorizontal: 30, lineHeight: 20 },
  empty: { color: colors.muted, paddingHorizontal: 20 },
});
