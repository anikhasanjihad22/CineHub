import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { PosterGrid, SectionTitle } from '../components/Poster';
import { colors, radius } from '../theme';
import { hasKey, img, searchTitles, Title, trending } from '../lib/tmdb';
import { catalogCategories, loadCatalog } from '../plugins/catalog';
import type { CatalogItem } from '../plugins/types';

export default function Search({ navigation }: any) {
  const [q, setQ] = useState('');
  const [titles, setTitles] = useState<Title[]>([]);
  const [extra, setExtra] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hot, setHot] = useState<Title[]>([]);

  // Shown before you type anything.
  useEffect(() => {
    if (!hasKey()) return;
    Promise.all([trending('movie').catch(() => [] as Title[]), trending('tv').catch(() => [] as Title[])])
      .then(([a, b]) => {
        const out: Title[] = [];
        for (let i = 0; i < 9; i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
        setHot(out.slice(0, 18));
      });
  }, []);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setTitles([]); setExtra([]); setSearched(false); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        // TMDB first; every installed catalog plugin (any category) is searched too.
        const cats = await catalogCategories().catch(() => [] as string[]);
        const [r, lists] = await Promise.all([
          hasKey() ? searchTitles(s).catch(() => [] as Title[]) : Promise.resolve([] as Title[]),
          Promise.all(cats.map((c) => loadCatalog(c, s).catch(() => [] as CatalogItem[]))),
        ]);
        if (!alive) return;
        const seen = new Set<string>();
        setTitles(r);
        setExtra(lists.flat().filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true))));
        setSearched(true);
      } finally {
        if (alive) setBusy(false);
      }
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const openTitle = (t: Title) => navigation.navigate('Details', { id: t.id, type: t.type });
  const openItem = (c: CatalogItem) =>
    c.tmdbId
      ? navigation.navigate('Details', { id: c.tmdbId, type: c.type ?? 'movie' })
      : navigation.navigate('Details', { item: c });

  const typing = q.trim().length >= 2;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <Text style={styles.heading}>Search</Text>
        <View style={styles.inputWrap}>
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            style={styles.input} value={q} onChangeText={setQ} placeholder="Movies, series, shows..."
            placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search"
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={10}><Icon name="close" size={18} color={colors.muted} /></Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {busy && <ActivityIndicator color={colors.text} style={{ marginTop: 30 }} />}

        {!typing && hot.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <SectionTitle title="Trending now" />
            <PosterGrid
              data={hot} keyOf={(t) => t.type + t.id} uriOf={(t) => img(t.poster)} labelOf={(t) => t.title}
              ratingOf={(t) => t.rating} onPress={openTitle}
            />
          </View>
        )}

        {typing && titles.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <SectionTitle title="Movies and series" />
            <PosterGrid
              data={titles} keyOf={(t) => t.type + t.id} uriOf={(t) => img(t.poster)} labelOf={(t) => t.title}
              ratingOf={(t) => t.rating} onPress={openTitle}
            />
          </View>
        )}

        {typing && extra.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <SectionTitle title="More results" />
            <PosterGrid
              data={extra} keyOf={(c) => c.key} uriOf={(c) => c.poster || c.backdrop} labelOf={(c) => c.title}
              ratingOf={(c) => c.rating} onPress={openItem}
            />
          </View>
        )}

        {searched && !busy && titles.length === 0 && extra.length === 0 && (
          <View style={styles.empty}>
            <Icon name="search" size={34} color={colors.muted} />
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>Check the spelling or try another name.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  heading: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 14 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: radius.sm, paddingHorizontal: 14,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, padding: 0, height: '100%' },
  empty: { alignItems: 'center', marginTop: 70, paddingHorizontal: 30 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 14 },
  emptyText: { color: colors.muted, marginTop: 6, textAlign: 'center' },
});
