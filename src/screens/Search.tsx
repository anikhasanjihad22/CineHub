import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PosterGrid, SectionTitle } from '../components/Poster';
import { colors, radius } from '../theme';
import { hasKey, img, searchTitles, Title } from '../lib/tmdb';
import { catalogCategories, loadCatalog } from '../plugins/catalog';
import type { CatalogItem } from '../plugins/types';

export default function Search({ navigation }: any) {
  const [q, setQ] = useState('');
  const [titles, setTitles] = useState<Title[]>([]);
  const [extra, setExtra] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

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

  const openItem = (c: CatalogItem) =>
    c.tmdbId
      ? navigation.navigate('Details', { id: c.tmdbId, type: c.type ?? 'movie' })
      : navigation.navigate('Details', { item: c });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Search</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input} value={q} onChangeText={setQ} placeholder="Movies, series, matches, news"
          placeholderTextColor={colors.muted} autoCorrect={false}
        />
      </View>

      {busy && <ActivityIndicator color={colors.amberSolid} style={{ marginTop: 30 }} />}

      {titles.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <SectionTitle title="Movies and series" />
          <PosterGrid
            data={titles} keyOf={(t) => t.type + t.id} uriOf={(t) => img(t.poster)} labelOf={(t) => t.title}
            onPress={(t) => navigation.navigate('Details', { id: t.id, type: t.type })}
          />
        </View>
      )}

      {extra.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <SectionTitle title="Live and more" />
          <PosterGrid
            data={extra} keyOf={(c) => c.key} uriOf={(c) => c.poster || c.backdrop} labelOf={(c) => c.title}
            onPress={openItem}
          />
        </View>
      )}

      {searched && !busy && titles.length === 0 && extra.length === 0 && (
        <Text style={styles.empty}>No results. Try another name.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 26, fontWeight: '800', paddingHorizontal: 20, paddingTop: 16, marginBottom: 14 },
  inputWrap: { paddingHorizontal: 20 },
  input: {
    height: 52, borderRadius: radius.pill, paddingHorizontal: 20, color: colors.text, fontSize: 16,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
  },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
});
