import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { colors, radius } from '../theme';
import { DlItem, formatSize, removeDownload, retryDownload, useDownloads } from '../lib/downloads';

// Everything saved on this phone. Works with no internet.
export default function Downloads({ navigation }: any) {
  const list = useDownloads();
  const total = list.filter((d) => d.status === 'done').reduce((a, d) => a + d.size, 0);

  function play(d: DlItem) {
    navigation.navigate('Player', {
      kind: 'local', localUri: d.localUri, format: d.format, title: d.title, subtitle: d.subtitle,
      tmdbId: d.tmdbId, type: d.type, season: d.season, episode: d.episode,
    });
  }

  function remove(d: DlItem) {
    const busy = d.status === 'downloading';
    Alert.alert(busy ? 'Cancel download' : 'Delete download', busy ? `Stop downloading "${d.title}"?` : `Remove "${d.title}" from this phone?`, [
      { text: 'Keep', style: 'cancel' },
      { text: busy ? 'Cancel download' : 'Delete', style: 'destructive', onPress: () => { removeDownload(d.id); } },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.heading}>Downloads</Text>
      {list.length > 0 && <Text style={styles.sub}>{list.length} {list.length === 1 ? 'title' : 'titles'} · {formatSize(total)} on this phone</Text>}
      <ScrollView contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 && (
          <View style={styles.empty}>
            <Icon name="downloads" size={42} color={colors.muted} />
            <Text style={styles.emptyTitle}>No downloads yet</Text>
            <Text style={styles.emptyText}>While watching, tap the ⋮ menu and choose Download. Your downloads show up here and play without internet.</Text>
          </View>
        )}
        {list.map((d) => {
          const done = d.status === 'done';
          const err = d.status === 'error';
          const pct = Math.round(d.progress * 100);
          return (
            <Pressable key={d.id} onPress={() => (done ? play(d) : undefined)} style={({ pressed }) => [styles.row, pressed && done && { backgroundColor: colors.surface2 }]}>
              <View style={styles.thumb}>
                {d.poster ? <Image source={{ uri: d.poster }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="play" size={22} color={colors.muted} />}
                {done && <View style={styles.thumbPlay}><Icon name="play" size={14} /></View>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{d.title}</Text>
                {!!d.subtitle && <Text style={styles.meta} numberOfLines={1}>{d.subtitle}</Text>}
                {done && <Text style={styles.meta}>{formatSize(d.size)} · Ready to watch offline</Text>}
                {d.status === 'downloading' && (
                  <>
                    <View style={styles.track}>
                      <View style={[styles.fill, d.progress < 0 ? { width: '100%', opacity: 0.45 } : { width: `${Math.max(3, pct)}%` }]} />
                    </View>
                    <Text style={styles.meta}>{d.progress < 0 ? 'Downloading' : `Downloading ${pct}%`}{d.size ? ` · ${formatSize(d.size)}` : ''}</Text>
                  </>
                )}
                {err && <Text style={[styles.meta, { color: colors.danger }]} numberOfLines={2}>{d.error || 'Download failed'}</Text>}
              </View>
              {err && (
                <Pressable onPress={() => retryDownload(d)} hitSlop={8} style={styles.act}><Icon name="refresh" size={20} /></Pressable>
              )}
              <Pressable onPress={() => remove(d)} hitSlop={8} style={styles.act}>
                <Icon name={d.status === 'downloading' ? 'close' : 'trash'} size={20} color={colors.textDim} />
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  sub: { color: colors.muted, fontSize: 13, paddingHorizontal: 20, paddingBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 80, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  thumb: { width: 76, height: 108, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  thumbPlay: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surface3, marginTop: 10, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  act: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
