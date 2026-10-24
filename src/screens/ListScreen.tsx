import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { PosterGrid } from '../components/Poster';
import { colors } from '../theme';
import { discover, img, Title } from '../lib/tmdb';

// Titles of one streaming platform (opened from the platform logo row).
export default function ListScreen({ route, navigation }: any) {
  const { title, type, providerId } = route.params;
  const [items, setItems] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  async function load(p: number, reset = false) {
    setLoading(true);
    try {
      const more = await discover(type, providerId, p);
      setItems((cur) => {
        const base = reset ? [] : cur;
        const seen = new Set(base.map((x) => x.id));
        return [...base, ...more.filter((x) => !seen.has(x.id))];
      });
      if (more.length === 0) setDone(true);
    } catch { setDone(true); }
    setLoading(false);
  }

  useEffect(() => { load(1); }, []);

  async function onRefresh() {
    setRefreshing(true);
    setPage(1); setDone(false);
    await load(1, true);
    setRefreshing(false);
  }

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}><Icon name="back" /></Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amberSolid} colors={[colors.amberSolid]} progressBackgroundColor="#1A1216" />}
      >
        <PosterGrid
          data={items} keyOf={(t) => String(t.id)} uriOf={(t) => img(t.poster)} labelOf={(t) => t.title}
          onPress={(t) => navigation.navigate('Details', { id: t.id, type: t.type })}
        />
        {loading && <ActivityIndicator color={colors.amberSolid} style={{ margin: 20 }} />}
        {!loading && !done && (
          <Pressable onPress={() => { const n = page + 1; setPage(n); load(n); }} style={{ alignSelf: 'center', padding: 14 }}>
            <Text style={{ color: colors.amberSolid, fontWeight: '700' }}>Load more</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
});
