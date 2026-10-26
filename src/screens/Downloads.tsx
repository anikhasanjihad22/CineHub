import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { Focusable } from '../components/Focusable';
import { colors, NAV_SPACE, radius } from '../theme';
import { isTV } from '../lib/platform';
import {
  DlItem, formatEta, formatSize, formatSpeed, freeSpace, pauseDownload, removeDownload, resumeDownload, retryDownload, useDownloads,
} from '../lib/downloads';

// Everything saved for offline watching, with live progress for the ones still downloading.
export default function Downloads({ navigation }: any) {
  const list = useDownloads();
  const [free, setFree] = useState(0);
  useEffect(() => { freeSpace().then(setFree); }, [list.length, list.filter((d) => d.status === 'done').length]);

  const active = list.filter((d) => d.status !== 'done');
  const ready = list.filter((d) => d.status === 'done');
  const used = list.reduce((a, d) => a + (d.size || 0), 0);
  const speedNow = active.filter((d) => d.status === 'downloading').reduce((a, d) => a + (d.speed || 0), 0);
  const usedPct = free > 0 ? Math.min(1, used / (used + free)) : 0;

  function play(d: DlItem) {
    navigation.navigate('Player', {
      kind: 'local', localUri: d.localUri, format: d.format, title: d.title, subtitle: d.subtitle,
      tmdbId: d.tmdbId, type: d.type, season: d.season, episode: d.episode,
    });
  }

  function remove(d: DlItem) {
    const busy = d.status !== 'done';
    Alert.alert(busy ? 'Cancel download' : 'Delete download', busy ? `Stop and remove "${d.title}"?` : `Remove "${d.title}" from your downloads?`, [
      { text: 'Keep', style: 'cancel' },
      { text: busy ? 'Cancel download' : 'Delete', style: 'destructive', onPress: () => { removeDownload(d.id); } },
    ]);
  }

  function renderCard(d: DlItem) {
    const done = d.status === 'done';
    const going = d.status === 'downloading';
    const err = d.status === 'error';
    const pct = d.progress < 0 ? 0 : Math.round(d.progress * 100);
    const total = done ? d.size : d.total;
    const left = going && d.speed > 0 && total > d.size ? (total - d.size) / d.speed : 0;
    const canPause = going && d.format === 'hls';

    return (
      <Focusable key={d.id} onPress={() => (done ? play(d) : undefined)} ring={radius.md + 3} style={styles.card}>
        <View style={styles.thumb}>
          {d.poster ? <Image source={{ uri: d.poster }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="play" size={22} color={colors.muted} />}
          {done && <View style={styles.thumbPlay}><Icon name="play" size={16} /></View>}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{d.title}</Text>
          {!!d.subtitle && <Text style={styles.meta} numberOfLines={1}>{d.subtitle}</Text>}

          {done && (
            <View style={styles.readyRow}>
              <Icon name="check" size={14} color={colors.success} />
              <Text style={[styles.meta, { marginTop: 0, color: colors.success }]}>{formatSize(d.size)} · Ready offline</Text>
            </View>
          )}

          {!done && !err && (
            <View style={{ marginTop: 10 }}>
              <View style={styles.track}>
                {d.progress < 0
                  ? <View style={[styles.fill, { width: '100%', opacity: 0.4 }]} />
                  : <LinearGradient colors={['#FF4B55', '#E50914']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${Math.max(3, pct)}%` }]} />}
              </View>
              <View style={styles.statRow}>
                <Text style={styles.stat}>
                  {formatSize(d.size)}{total > 0 ? ` of ${d.format === 'hls' && d.status === 'downloading' ? '~' : ''}${formatSize(total)}` : ''}
                </Text>
                <Text style={[styles.stat, { color: colors.text, fontWeight: '800' }]}>{d.progress < 0 ? '' : `${pct}%`}</Text>
              </View>
              <Text style={styles.stat}>
                {going ? [formatSpeed(d.speed), formatEta(left)].filter(Boolean).join('  ·  ') || 'Starting...' : d.error || 'Paused'}
              </Text>
            </View>
          )}

          {err && <Text style={[styles.meta, { color: colors.danger }]} numberOfLines={2}>{d.error || 'Download failed'}</Text>}
        </View>

        {!done && (
          <View style={styles.actions}>
            {canPause && <Focusable onPress={() => pauseDownload(d.id)} hitSlop={6} ring={20} style={styles.act}><Icon name="pause" size={18} /></Focusable>}
            {d.status === 'paused' && <Focusable onPress={() => resumeDownload(d)} hitSlop={6} ring={20} style={[styles.act, { backgroundColor: colors.accent }]}><Icon name="play" size={16} /></Focusable>}
            {err && <Focusable onPress={() => retryDownload(d)} hitSlop={6} ring={20} style={styles.act}><Icon name="refresh" size={18} /></Focusable>}
            <Focusable onPress={() => remove(d)} hitSlop={6} ring={20} style={styles.act}><Icon name="close" size={18} color={colors.textDim} /></Focusable>
          </View>
        )}
        {done && (
          <Focusable onPress={() => remove(d)} hitSlop={6} ring={20} style={styles.act}><Icon name="trash" size={18} color={colors.textDim} /></Focusable>
        )}
      </Focusable>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.heading}>Downloads</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: isTV ? 40 : NAV_SPACE, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {list.length > 0 && (
          <View style={styles.summary}>
            <View style={styles.sumTop}>
              <Text style={styles.sumBig}>{formatSize(used)}</Text>
              <Text style={styles.sumSmall}>
                {list.length} {list.length === 1 ? 'title' : 'titles'}{free > 0 ? `  ·  ${formatSize(free)} free` : ''}
              </Text>
            </View>
            <View style={styles.sumTrack}><View style={[styles.sumFill, { width: `${Math.max(2, usedPct * 100)}%` }]} /></View>
            {speedNow > 0 && <Text style={styles.sumSpeed}>Downloading at {formatSpeed(speedNow)}</Text>}
          </View>
        )}

        {list.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Icon name="downloads" size={34} color={colors.muted} /></View>
            <Text style={styles.emptyTitle}>No downloads yet</Text>
            <Text style={styles.emptyText}>Tap Download on any movie or episode. It shows up here and plays without internet.</Text>
          </View>
        )}

        {active.length > 0 && <Text style={styles.group}>Downloading</Text>}
        {active.map(renderCard)}

        {ready.length > 0 && <Text style={styles.group}>Ready to watch</Text>}
        {ready.map(renderCard)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  summary: { marginHorizontal: 20, marginBottom: 6, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sumTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sumBig: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  sumSmall: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  sumTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, marginTop: 12, overflow: 'hidden' },
  sumFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  sumSpeed: { color: colors.textDim, fontSize: 12, marginTop: 10, fontWeight: '600' },
  group: { color: colors.muted, fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginHorizontal: 24, marginTop: 22, marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingTop: 70, gap: 8 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 10 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 21 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 70, height: 100, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  thumbPlay: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12.5, marginTop: 4 },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  stat: { color: colors.muted, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  actions: { gap: 8 },
  act: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
});
