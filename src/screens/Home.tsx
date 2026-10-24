import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Icon } from '../components/Icon';
import { HeroCarousel, HeroSlide } from '../components/HeroCarousel';
import { PosterGrid, PosterRow, RowSkeleton, SectionTitle, Skeleton } from '../components/Poster';
import { Logo } from '../components/Logo';
import { colors, radius } from '../theme';
import {
  details, hasKey, img, MediaType, popular, Provider, providers, Title, topRated, trending,
} from '../lib/tmdb';
import { recentHistory } from '../lib/store';
import { openSupport } from '../lib/support';
import { getPlugins, onPluginsChanged } from '../plugins/loader';
import { catalogCategories, categoryLabel, clearCatalogCache, groupSections, loadCatalog } from '../plugins/catalog';
import type { CatalogItem } from '../plugins/types';

type HeroSrc = { t: Title } | { c: CatalogItem };
type Row =
  | { key: string; title: string; kind: 'tmdb'; items: Title[]; seeAll?: string }
  | { key: string; title: string; kind: 'catalog'; items: CatalogItem[]; seeAll?: string };

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

// Alternates movie / tv / movie / tv ... for the hero banner.
function mix<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

export default function Home({ navigation, goProfile, goSearch }: any) {
  const { session } = useAuth();
  const name = (session?.user.email ?? '').split('@')[0];

  const [tabs, setTabs] = useState<string[]>(['home', 'movies', 'tv']);
  const [cat, setCat] = useState('home');
  const [hero, setHero] = useState<HeroSrc[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [grid, setGrid] = useState<CatalogItem[]>([]);
  const [provs, setProvs] = useState<Provider[]>([]);
  const [history, setHistory] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const reqId = useRef(0);
  const catRef = useRef('home');
  catRef.current = cat;

  const load = useCallback(async (c: string, force = false) => {
    const id = ++reqId.current;
    const stale = () => id !== reqId.current;
    try {
      await getPlugins(force);
      const cats = await catalogCategories();
      if (stale()) return;
      const tabList = ['home', 'movies', 'tv', ...cats.filter((x) => x !== 'movies' && x !== 'tv')];
      setTabs(tabList);
      if (!tabList.includes(c)) { setCat('home'); return; }

      const tmdbOk = hasKey();
      const newRows: Row[] = [];
      let newHero: HeroSrc[] = [];
      let newGrid: CatalogItem[] = [];
      let newProvs: Provider[] = [];
      let newHist: Title[] = [];

      const histTitles = async (types: MediaType[]) => {
        const lists = await Promise.all(types.map((t) => safe(recentHistory(t), [] as number[]).then((ids) => ids.map((i) => ({ t, i })))));
        const flat = lists.flat();
        const got = await Promise.all(flat.map((x) => safe<Title | null>(details(x.t, x.i), null)));
        return got.filter(Boolean) as Title[];
      };

      if (c === 'home') {
        const [tm, tt] = tmdbOk
          ? await Promise.all([safe(trending('movie'), [] as Title[]), safe(trending('tv'), [] as Title[])])
          : [[] as Title[], [] as Title[]];
        newHist = tmdbOk ? await histTitles(['movie', 'tv']) : [];

        const catLists = await Promise.all(cats.map((k) => safe(loadCatalog(k, '', force), [] as CatalogItem[]).then((items) => ({ k, items }))));
        const seen = new Set<number>();
        const take = (list: Title[]) => list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));

        const heroTitles = mix(tm.slice(0, 3), tt.slice(0, 3));
        heroTitles.forEach((t) => seen.add(t.id));
        const heroCat = catLists.flatMap((x) => x.items.filter((i) => i.backdrop || i.poster).slice(0, 2)).slice(0, 4);
        newHero = [...heroTitles.map((t) => ({ t })), ...heroCat.map((cc) => ({ c: cc }))].slice(0, 9);

        newRows.push({ key: 'tm', title: 'Trending movies', kind: 'tmdb', items: take(tm) });
        newRows.push({ key: 'tt', title: 'Trending TV shows', kind: 'tmdb', items: take(tt) });
        for (const { k, items } of catLists) {
          if (items.length) newRows.push({ key: 'cat:' + k, title: categoryLabel(k), kind: 'catalog', items: items.slice(0, 20), seeAll: k });
        }
        if (!tmdbOk && !catLists.some((x) => x.items.length)) throw new Error('TMDB key is missing. Paste it in src/config.ts');
      } else if (c === 'movies' || c === 'tv') {
        if (!tmdbOk) throw new Error('TMDB key is missing. Paste it in src/config.ts');
        const type: MediaType = c === 'movies' ? 'movie' : 'tv';
        const [tr, pop, top, prov, hist, items] = await Promise.all([
          trending(type), popular(type), topRated(type), safe(providers(type), [] as Provider[]),
          histTitles([type]), safe(loadCatalog(c, '', force), [] as CatalogItem[]),
        ]);
        if (stale()) return;
        const seen = new Set<number>();
        const take = (list: Title[]) => list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
        const heroTitles = tr.slice(0, 5);
        heroTitles.forEach((t) => seen.add(t.id));
        newHero = [...heroTitles.map((t) => ({ t })), ...items.filter((i) => i.backdrop || i.poster).slice(0, 2).map((cc) => ({ c: cc }))];
        // Plugin content first, so a newly installed plugin is visible straight away.
        for (const s of groupSections(items, `More ${categoryLabel(c)}`)) {
          newRows.push({ key: 'pl:' + s.title, title: s.title, kind: 'catalog', items: s.items.slice(0, 24) });
        }
        newRows.push({ key: 'tr', title: 'Trending this week', kind: 'tmdb', items: take(tr) });
        newRows.push({ key: 'pop', title: 'Popular', kind: 'tmdb', items: take(pop) });
        newRows.push({ key: 'top', title: 'Top rated', kind: 'tmdb', items: take(top) });
        newProvs = prov;
        newHist = hist;
      } else {
        const items = await loadCatalog(c, '', force);
        newHero = items.filter((i) => i.backdrop || i.poster).slice(0, 6).map((cc) => ({ c: cc }));
        const sections = groupSections(items, categoryLabel(c));
        if (sections.length === 1) newGrid = items;
        else for (const s of sections) newRows.push({ key: 'pl:' + s.title, title: s.title, kind: 'catalog', items: s.items.slice(0, 24) });
      }

      if (stale()) return;
      setHero(newHero); setRows(newRows); setGrid(newGrid); setProvs(newProvs); setHistory(newHist);
      setError('');
    } catch (e: any) {
      if (!stale()) setError(e?.message ?? 'Could not load. Check your internet.');
    } finally {
      if (!stale()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setHero([]); setRows([]); setGrid([]);
    load(cat);
  }, [cat, load]);

  // The admin installs / edits / enables a plugin: this page reloads by itself.
  useEffect(() => onPluginsChanged(() => { clearCatalogCache(); load(catRef.current); }), [load]);

  async function onRefresh() {
    setRefreshing(true);
    clearCatalogCache();
    await load(cat, true);
    setRefreshing(false);
  }

  const openTitle = (t: Title) => navigation.navigate('Details', { id: t.id, type: t.type });
  const openItem = (c: CatalogItem) =>
    c.tmdbId
      ? navigation.navigate('Details', { id: c.tmdbId, type: c.type ?? 'movie' })
      : navigation.navigate('Details', { item: c });
  const type: MediaType = cat === 'tv' ? 'tv' : 'movie';

  const slides: HeroSlide[] = useMemo(
    () =>
      hero.map((h) =>
        'c' in h
          ? {
              key: 'c' + h.c.key, title: h.c.title,
              subtitle: [h.c.year, h.c.rating ? `${h.c.rating} rating` : '', h.c.section].filter(Boolean).join('  •  '),
              image: h.c.poster || h.c.backdrop, onPress: () => openItem(h.c),
            }
          : {
              key: 't' + h.t.type + h.t.id, title: h.t.title,
              subtitle: [h.t.type === 'tv' ? 'Series' : 'Movie', h.t.year, h.t.rating ? `${h.t.rating} rating` : ''].filter(Boolean).join('  •  '),
              image: img(h.t.poster, 'w780'), onPress: () => openTitle(h.t),
            },
      ),
    [hero],
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Logo size={24} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={goSearch} hitSlop={10} style={styles.headBtn}><Icon name="search" size={22} /></Pressable>
        <Pressable onPress={goProfile} style={styles.avatar}>
          <Text style={styles.avatarText}>{(name[0] ?? 'C').toUpperCase()}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.accent]} progressBackgroundColor={colors.surface2} />}
      >
        <View style={{ paddingBottom: 14 }}>
          <Chips items={tabs.map((c) => ({ key: c, label: categoryLabel(c) }))} value={cat} onChange={setCat} />
        </View>

        {loading && (
          <View>
            <Skeleton width="100%" height={420} radiusPx={0} />
            <RowSkeleton />
            <RowSkeleton />
          </View>
        )}

        {!!error && !loading && (
          <View style={styles.errBox}>
            <Icon name="info" size={34} color={colors.muted} />
            <Text style={styles.errTitle}>Something went wrong</Text>
            <Text style={styles.errText}>{error}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button label="Try again" small icon="refresh" onPress={() => { setLoading(true); setError(''); load(cat, true); }} />
              <Button label="Support" small variant="secondary" icon="send" onPress={openSupport} />
            </View>
          </View>
        )}

        {!loading && !error && (
          <>
            {slides.length > 0 && <HeroCarousel slides={slides} />}

            <PosterRow
              title="Continue watching" data={history} keyOf={(t) => t.type + t.id}
              uriOf={(t) => img(t.poster)} labelOf={(t) => t.title} onPress={openTitle}
            />

            {(cat === 'movies' || cat === 'tv') && provs.length > 0 && (
              <View style={{ marginTop: 26 }}>
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

            {rows.map((r) =>
              r.kind === 'tmdb' ? (
                <PosterRow
                  key={r.key} title={r.title} data={r.items} keyOf={(t: Title) => t.type + t.id}
                  uriOf={(t: Title) => img(t.poster)} labelOf={(t: Title) => t.title} ratingOf={(t: Title) => t.rating} onPress={openTitle}
                />
              ) : (
                <PosterRow
                  key={r.key} title={r.title} data={r.items} keyOf={(c: CatalogItem) => c.key}
                  uriOf={(c: CatalogItem) => c.poster || c.backdrop} labelOf={(c: CatalogItem) => c.title}
                  ratingOf={(c: CatalogItem) => c.rating} onPress={openItem}
                  onSeeAll={r.seeAll ? () => setCat(r.seeAll!) : undefined}
                />
              ),
            )}

            {grid.length > 0 && (
              <View style={{ marginTop: 26 }}>
                <SectionTitle title={categoryLabel(cat)} />
                <PosterGrid
                  data={grid} keyOf={(c) => c.key} uriOf={(c) => c.poster || c.backdrop} labelOf={(c) => c.title}
                  ratingOf={(c) => c.rating} onPress={openItem}
                />
              </View>
            )}

            {slides.length === 0 && rows.every((r) => r.items.length === 0) && grid.length === 0 && (
              <View style={styles.errBox}>
                <Icon name="plug" size={34} color={colors.muted} />
                <Text style={styles.errTitle}>Nothing here yet</Text>
                <Text style={styles.errText}>Pull down to refresh.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 14 },
  headBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onAccent, fontWeight: '800', fontSize: 16 },
  prov: { width: 64, height: 64, borderRadius: radius.md },
  errBox: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 60 },
  errTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 14 },
  errText: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
