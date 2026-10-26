import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { PosterGrid } from '../components/Poster';
import { colors, NAV_SPACE } from '../theme';
import { details, hasKey, img, Title } from '../lib/tmdb';
import { getFavorites } from '../lib/store';

// Titles saved with the heart button.
export default function MyList({ navigation, active }: any) {
  const [favs, setFavs] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!hasKey()) { setLoading(false); return; }
    const rows = await getFavorites().catch(() => []);
    const list = await Promise.all(rows.slice(0, 40).map((r) => details(r.media_type, r.tmdb_id).catch(() => null)));
    setFavs(list.filter(Boolean) as Title[]);
    setLoading(false);
  }, []);

  // Reload each time the tab is opened.
  useEffect(() => { if (active) load(); }, [active, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.heading}>My List</Text>
      <ScrollView
        contentContainerStyle={{ paddingBottom: NAV_SPACE, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.accent]} progressBackgroundColor={colors.surface2} />}
      >
        {loading && <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />}
        {!loading && favs.length === 0 && (
          <View style={styles.empty}>
            <Icon name="bookmark" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>Your list is empty</Text>
            <Text style={styles.emptyText}>Tap "My List" on any movie or series to save it here.</Text>
          </View>
        )}
        {favs.length > 0 && (
          <PosterGrid
            data={favs} keyOf={(t) => t.type + t.id} uriOf={(t) => img(t.poster)} labelOf={(t) => t.title}
            ratingOf={(t) => t.rating} onPress={(t) => navigation.navigate('Details', { id: t.id, type: t.type })}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  empty: { alignItems: 'center', marginTop: 90, paddingHorizontal: 34 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptyText: { color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
