import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { PosterGrid, SectionTitle } from '../components/Poster';
import { colors } from '../theme';
import { details, hasKey, img, Title } from '../lib/tmdb';
import { getFavorites } from '../lib/store';

export default function Profile({ navigation, active }: any) {
  const { session, isAdmin } = useAuth();
  const [favs, setFavs] = useState<Title[]>([]);

  const load = useCallback(async () => {
    if (!hasKey()) return;
    const rows = await getFavorites().catch(() => []);
    const list = await Promise.all(rows.slice(0, 30).map((r) => details(r.media_type, r.tmdb_id).catch(() => null)));
    setFavs(list.filter(Boolean) as Title[]);
  }, []);

  // Reload the list each time the tab is opened.
  useEffect(() => { if (active) load(); }, [active, load]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
      <Text style={styles.heading}>Profile</Text>
      <Text style={styles.email}>{session?.user.email}</Text>

      <View style={styles.actions}>
        {isAdmin && (
          <>
            <Button label="Manage plugins" onPress={() => navigation.navigate('AdminPlugins')} />
            <View style={{ height: 12 }} />
          </>
        )}
        <Button label="Log out" variant="glass" onPress={() => supabase.auth.signOut()} />
      </View>

      <View style={{ marginTop: 28 }}>
        <SectionTitle title="My list" />
        {favs.length === 0 ? (
          <Text style={styles.empty}>Tap the heart on a title to save it here.</Text>
        ) : (
          <PosterGrid
            data={favs} keyOf={(t) => t.type + t.id} uriOf={(t) => img(t.poster)} labelOf={(t) => t.title}
            onPress={(t) => navigation.navigate('Details', { id: t.id, type: t.type })}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 26, fontWeight: '800', paddingHorizontal: 20, paddingTop: 16 },
  email: { color: colors.muted, fontSize: 14, paddingHorizontal: 20, marginTop: 4 },
  actions: { paddingHorizontal: 20, marginTop: 22 },
  empty: { color: colors.muted, paddingHorizontal: 20 },
});
