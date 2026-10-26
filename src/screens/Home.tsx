import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { Button } from '../components/Button';
import { Chips } from '../components/Chips';
import { Icon } from '../components/Icon';
import { HeroCarousel, HeroSlide } from '../components/HeroCarousel';
import { PosterGrid, PosterRow, RowSkeleton, SectionTitle, Skeleton, Top10Row } from '../components/Poster';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { Focusable } from '../components/Focusable';
import { isTV } from '../lib/platform';
import { colors, NAV_SPACE, radius } from '../theme';
import {
  DiscoverParams, details, discoverBy, hasKey, img, MediaType, popular, Title, topRated, trending,
} from '../lib/tmdb';
import { recentProgress } from '../lib/store';
import { openSupport } from '../lib/support';
import { getPlugins, onPluginsChanged } from '../plugins/loader';
import { catalogCategories, categoryLabel, clearCatalogCache, groupSections, loadCatalog } from '../plugins/catalog';
import type { CatalogItem } from '../plugins/types';

type HeroSrc = { t: Title } | { c: CatalogItem };
type See = { type: MediaType; params: DiscoverParams };
type TmdbRow = { key: string; title: string; kind: 'tmdb'; items: Title[]; see?: See; seeTab?: string; top10?: boolean };
type Row = TmdbRow | { key: string; title: string; kind: 'catalog'; items: CatalogItem[]; seeAll?: string };

// The tabs on top of Home.
const MAIN_TABS = ['home', 'trending', 'hollywood', 'bollywood', 'tv', 'anime'];
const TAB_LABEL: Record<string, string> = {
  home: 'Home', trending: 'Top Trending', hollywood: 'Hollywood', bollywood: 'Bollywood', tv: 'TV Series', anime: 'Anime',
};
const tabLabel = (c: string) => TAB_LABEL[c] ?? categoryLabel(c);

const EN = { with_original_language: 'en' };
const HI = { with_original_language: 'hi' };
const JA_ANIME = { with_original_language: 'ja', with_genres: 16 };
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

// What each tab shows. Every line is one row: a title, movie or tv, and a TMDB discover filter.
type Spec = { key: string; title: string; type: MediaType; params: DiscoverParams };
const SPECS: Record<string, Spec[]> = {
  hollywood: [
    { key: 'h-pop', title: 'Popular Hollywood', type: 'movie', params: EN },
    { key: 'h-new', title: 'New releases', type: 'movie', params: { ...EN, 'primary_release_date.gte': daysAgo(150), 'primary_release_date.lte': today() } },
    { key: 'h-top', title: 'Top rated', type: 'movie', params: { ...EN, sort_by: 'vote_average.desc', 'vote_count.gte': 3000 } },
    { key: 'h-act', title: 'Action', type: 'movie', params: { ...EN, with_genres: 28 } },
    { key: 'h-com', title: 'Comedy', type: 'movie', params: { ...EN, with_genres: 35 } },
    { key: 'h-sci', title: 'Sci-Fi', type: 'movie', params: { ...EN, with_genres: 878 } },
    { key: 'h-hor', title: 'Horror', type: 'movie', params: { ...EN, with_genres: 27 } },
  ],
  bollywood: [
    { key: 'b-pop', title: 'Popular Bollywood', type: 'movie', params: HI },
    { key: 'b-new', title: 'New releases', type: 'movie', params: { ...HI, 'primary_release_date.gte': daysAgo(200), 'primary_release_date.lte': today() } },
    { key: 'b-top', title: 'Top rated', type: 'movie', params: { ...HI, sort_by: 'vote_average.desc', 'vote_count.gte': 300 } },
    { key: 'b-act', title: 'Action', type: 'movie', params: { ...HI, with_genres: 28 } },
    { key: 'b-rom', title: 'Romance', type: 'movie', params: { ...HI, with_genres: 10749 } },
    { key: 'b-com', title: 'Comedy', type: 'movie', params: { ...HI, with_genres: 35 } },
    { key: 'b-tv', title: 'Hindi series', type: 'tv', params: HI },
  ],
  tv: [
    { key: 't-pop', title: 'Popular series', type: 'tv', params: {} },
    { key: 't-top', title: 'Top rated', type: 'tv', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 } },
    { key: 't-cri', title: 'Crime', type: 'tv', params: { with_genres: 80 } },
    { key: 't-dra', title: 'Drama', type: 'tv', params: { with_genres: 18 } },
    { key: 't-sci', title: 'Sci-Fi and Fantasy', type: 'tv', params: { with_genres: 10765 } },
    { key: 't-com', title: 'Comedy', type: 'tv', params: { with_genres: 35 } },
    { key: 't-hi', title: 'Hindi series', type: 'tv', params: HI },
  ],
  anime: [
    { key: 'a-pop', title: 'Popular anime', type: 'tv', params: JA_ANIME },
    { key: 'a-new', title: 'New episodes', type: 'tv', params: { ...JA_ANIME, 'first_air_date.gte': daysAgo(240) } },
    { key: 'a-top', title: 'Top rated anime', type: 'tv', params: { ...JA_ANIME, sort_by: 'vote_average.desc', 'vote_count.gte': 300 } },
    { key: 'a-mov', title: 'Anime movies', type: 'movie', params: JA_ANIME },
    { key: 'a-act', title: 'Action and adventure', type: 'tv', params: { with_original_language: 'ja', with_genres: '16,10759' } },
  ],
};

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
  const { session, displayName } = useAuth();

  const [tabs, setTabs] = useState<string[]>(MAIN_TABS);
  const [cat, setCat] = useState('home');
  const [hero, setHero] = useState<HeroSrc[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [grid, setGrid] = useState<CatalogItem[]>([]);
  const [history, setHistory] = useState<(Title & { ratio: number })[]>([]);
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
      const extra = cats.filter((x) => !['movies', 'tv', 'anime', ...MAIN_TABS].includes(x));
      const tabList = [...MAIN_TABS, ...extra];
      setTabs(tabList);
      if (!tabList.includes(c)) { setCat('home'); return; }

      const tmdbOk = hasKey();
      const newRows: Row[] = [];
      let newHero: HeroSrc[] = [];
      let newGrid: CatalogItem[] = [];
      let newHist: (Title & { ratio: number })[] = [];

      const histTitles = async (types: MediaType[]) => {
        const lists = await Promise.all(types.map((t) => safe(recentProgress(t), [] as { id: number; ratio: number }[]).then((ids) => ids.map((i) => ({ t, i: i.id, ratio: i.ratio })))));
        const flat = lists.flat();
        const got = await Promise.all(flat.map((x) => safe<Title | null>(details(x.t, x.i), null).then((d) => (d ? { ...d, ratio: x.ratio } : null))));
        return got.filter(Boolean) as (Title & { ratio: number })[];
      };
      const tmdbRow = async (sp: Spec): Promise<TmdbRow> => ({
        key: sp.key, title: sp.title, kind: 'tmdb', items: await safe(discoverBy(sp.type, sp.params), [] as Title[]),
        see: { type: sp.type, params: sp.params },
      });
      const catRows = (items: CatalogItem[], fallback: string): Row[] =>
        groupSections(items, fallback).map((s2) => ({ key: 'pl:' + s2.title, title: s2.title, kind: 'catalog' as const, items: s2.items.slice(0, 24) }));
      const heroOf = (titles: Title[], catItems: CatalogItem[] = []): HeroSrc[] =>
        [...titles.slice(0, 6).map((t) => ({ t })), ...catItems.filter((i) => i.backdrop || i.poster).slice(0, 2).map((cc) => ({ c: cc }))];

      if (!tmdbOk && ['home', 'trending', 'hollywood', 'bollywood', 'tv', 'anime'].includes(c)) {
        const any = (await Promise.all(cats.map((k) => safe(loadCatalog(k, '', force), [] as CatalogItem[])))).flat();
        if (!any.length) throw new Error('TMDB key is missing. Paste it in src/config.ts');
      }

      if (c === 'home') {
        const [tm, tt] = tmdbOk
          ? await Promise.all([safe(trending('movie'), [] as Title[]), safe(trending('tv'), [] as Title[])])
          : [[] as Title[], [] as Title[]];
        newHist = tmdbOk ? await histTitles(['movie', 'tv']) : [];
        const picks = tmdbOk
          ? await Promise.all(['hollywood', 'bollywood', 'tv', 'anime'].map((k) => tmdbRow(SPECS[k][0])))
          : [];
        const catLists = await Promise.all(extra.map((k) => safe(loadCatalog(k, '', force), [] as CatalogItem[]).then((items) => ({ k, items }))));

        const trendMix = mix(tm, tt);
        newHero = [...mix(tm.slice(0, 3), tt.slice(0, 3)).map((t) => ({ t })), ...catLists.flatMap((x) => x.items.filter((i) => i.backdrop || i.poster).slice(0, 2)).slice(0, 3).map((cc) => ({ c: cc }))].slice(0, 9);
        newRows.push({ key: 'top10', title: 'Top 10 today', kind: 'tmdb', items: trendMix.slice(0, 10), top10: true });
        newRows.push({ key: 'trend', title: 'Trending now', kind: 'tmdb', items: trendMix.slice(10, 30), seeTab: 'trending' });
        const names: Record<string, string> = { hollywood: 'Hollywood', bollywood: 'Bollywood', tv: 'TV series', anime: 'Anime' };
        ['hollywood', 'bollywood', 'tv', 'anime'].forEach((k, i) => {
          if (picks[i]) newRows.push({ ...picks[i], title: names[k], key: 'home-' + k, see: undefined, seeTab: k });
        });
        for (const { k, items } of catLists) {
          if (items.length) newRows.push({ key: 'cat:' + k, title: categoryLabel(k), kind: 'catalog', items: items.slice(0, 20), seeAll: k });
        }
      } else if (c === 'trending') {
        const [tm, tt, tr, trTv, hist] = await Promise.all([
          safe(trending('movie'), [] as Title[]), safe(trending('tv'), [] as Title[]),
          safe(topRated('movie'), [] as Title[]), safe(topRated('tv'), [] as Title[]), histTitles(['movie', 'tv']),
        ]);
        newHero = heroOf(mix(tm.slice(0, 3), tt.slice(0, 3)));
        newRows.push({ key: 'tr-mix', title: 'Trending this week', kind: 'tmdb', items: mix(tm, tt).slice(0, 24) });
        newRows.push({ key: 'tr-m', title: 'Trending movies', kind: 'tmdb', items: tm });
        newRows.push({ key: 'tr-t', title: 'Trending series', kind: 'tmdb', items: tt });
        newRows.push({ key: 'tr-pm', title: 'Popular movies', kind: 'tmdb', items: await safe(popular('movie'), [] as Title[]) });
        newRows.push({ key: 'tr-rm', title: 'Top rated movies', kind: 'tmdb', items: tr });
        newRows.push({ key: 'tr-rt', title: 'Top rated series', kind: 'tmdb', items: trTv });
        newHist = hist;
      } else if (c === 'hollywood' || c === 'bollywood' || c === 'tv' || c === 'anime') {
        const plugin = await safe(loadCatalog(c === 'hollywood' ? 'movies' : c, '', force), [] as CatalogItem[]);
        const [hist, ...rows] = await Promise.all([
          histTitles(c === 'tv' ? ['tv'] : c === 'anime' ? ['tv', 'movie'] : ['movie']),
          ...SPECS[c].map((sp) => tmdbRow(sp)),
        ]) as [(Title & { ratio: number })[], ...Row[]];
        if (stale()) return;
        const filled = rows.filter((r) => r.items.length > 0);
        const first = filled[0];
        newHero = heroOf(first && first.kind === 'tmdb' ? first.items : [], plugin);
        // Plugin content first, so a newly installed plugin is visible straight away.
        newRows.push(...catRows(plugin, `More ${tabLabel(c)}`), ...filled);
        newHist = hist;
      } else {
        const items = await loadCatalog(c, '', force);
        newHero = items.filter((i) => i.backdrop || i.poster).slice(0, 6).map((cc) => ({ c: cc }));
        const sections = groupSections(items, categoryLabel(c));
        if (sections.length === 1) newGrid = items;
        else newRows.push(...catRows(items, categoryLabel(c)));
      }

      if (stale()) return;
      setHero(newHero); setRows(newRows); setGrid(newGrid); setHistory(newHist);
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
      <View style={[styles.header, isTV && { paddingHorizontal: 40 }]}>
        <Logo size={24} />
        <View style={{ flex: 1 }} />
        <Focusable onPress={goSearch} hitSlop={10} style={styles.headBtn} ring={20}><Icon name="search" size={24} /></Focusable>
        <Focusable onPress={goProfile} hitSlop={6} ring={20}>
          <Avatar uid={session?.user.id} name={displayName} size={36} ring />
        </Focusable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: isTV ? 40 : NAV_SPACE }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.accent]} progressBackgroundColor={colors.surface2} />}
      >
        <View style={{ paddingBottom: 14 }}>
          <Chips items={tabs.map((c) => ({ key: c, label: tabLabel(c) }))} value={cat} onChange={setCat} />
        </View>

        {loading && (
          <View>
            <Skeleton width="100%" height={isTV ? 360 : 420} radiusPx={0} />
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
              uriOf={(t) => img(t.poster)} labelOf={(t) => t.title} progressOf={(t) => t.ratio} onPress={openTitle}
            />

            {rows.map((r) =>
              r.kind === 'tmdb' && r.top10 ? (
                <Top10Row
                  key={r.key} title={r.title} data={r.items} keyOf={(t: Title) => t.type + t.id}
                  uriOf={(t: Title) => img(t.poster)} onPress={openTitle}
                />
              ) : r.kind === 'tmdb' ? (
                <PosterRow
                  key={r.key} title={r.title} data={r.items} keyOf={(t: Title) => t.type + t.id}
                  uriOf={(t: Title) => img(t.poster)} labelOf={(t: Title) => t.title} ratingOf={(t: Title) => t.rating} onPress={openTitle}
                  onSeeAll={
                    r.seeTab ? () => setCat(r.seeTab!)
                    : r.see ? () => navigation.navigate('List', { title: r.title, type: r.see!.type, params: r.see!.params })
                    : undefined
                  }
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
                <SectionTitle title={tabLabel(cat)} />
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
  headBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  prov: { width: 64, height: 64, borderRadius: radius.md },
  errBox: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 60 },
  errTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 14 },
  errText: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
