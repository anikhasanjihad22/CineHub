import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { PosterGrid } from '../components/Poster';
import { Button } from '../components/Button';
import { colors } from '../theme';
import { discover, discoverBy, img, Title } from '../lib/tmdb';

// Titles of one streaming platform (opened from the platform logo row).
export default function ListScreen({ route, navigation }: any) {
  const { title, type, providerId, params } = route.params;
  const [items, setItems] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(p: number, reset = false) {
    setLoading(true);
    try {
      const more = params ? await discoverBy(type, params, p) : await discover(type, providerId, p);
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
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}><Icon name="back" size={22} /></Pressable>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.accent]} progressBackgroundColor={colors.surface2} />}
      >
        <PosterGrid
          data={items} keyOf={(t) => String(t.id)} uriOf={(t) => img(t.poster)} labelOf={(t) => t.title}
          ratingOf={(t) => t.rating} onPress={(t) => navigation.navigate('Details', { id: t.id, type: t.type })}
        />
        {loading && <ActivityIndicator color={colors.text} style={{ margin: 24 }} />}
        {!loading && !done && (
          <View style={{ paddingHorizontal: 20 }}>
            <Button label="Load more" variant="secondary" onPress={() => { const n = page + 1; setPage(n); load(n); }} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
});
