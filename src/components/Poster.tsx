import React, { useEffect, useRef } from 'react';
import { Animated, FlatList, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { Icon } from './Icon';
import { Focusable } from './Focusable';
import { isTV } from '../lib/platform';
import { colors, radius } from '../theme';

export const CARD_W = isTV ? 170 : 124;

export function PosterCard({ uri, label, width = CARD_W, onPress, rating, progress }: {
  uri: string | null; label?: string; width?: number; onPress?: () => void; rating?: number; progress?: number;
}) {
  return (
    <Focusable onPress={onPress} ring={radius.sm + 3} style={({ pressed }) => ({ width, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={[styles.box, { width, height: Math.round(width * 1.5) }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.fill} resizeMode="cover" />
        ) : (
          <View style={[styles.fill, styles.noImg]}>
            <Text style={styles.noImgText} numberOfLines={4}>{label}</Text>
          </View>
        )}
        {!!rating && rating > 0 && (
          <View style={styles.rating}>
            <Icon name="star" size={10} color={colors.gold} />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        )}
        {progress !== undefined && (
          <View style={styles.pTrack}><View style={[styles.pFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
        )}
      </View>
    </Focusable>
  );
}

// "Top 10" row: a big outlined number sits beside each poster, like on Netflix.
export function Top10Row({ title, data, uriOf, keyOf, onPress }: {
  title: string; data: any[]; uriOf: (x: any) => string | null; keyOf: (x: any) => string; onPress: (x: any) => void;
}) {
  if (!data.length) return null;
  const w = isTV ? 150 : 112;
  const h = Math.round(w * 1.5);
  const nw = isTV ? 120 : 90;
  return (
    <View style={{ marginTop: 26 }}>
      <SectionTitle title={title} />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data.slice(0, 10)}
        keyExtractor={keyOf}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ItemSeparatorComponent={() => <View style={{ width: 4 }} />}
        renderItem={({ item, index }) => (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Svg width={nw} height={h} style={{ marginRight: -nw * 0.18 }}>
              <SvgText
                x={nw * 0.5} y={h * 0.9} fontSize={h * 0.78} fontWeight="900" textAnchor="middle"
                fill="#000" stroke="rgba(255,255,255,0.55)" strokeWidth={3}
              >
                {String(index + 1)}
              </SvgText>
            </Svg>
            <PosterCard uri={uriOf(item)} width={w} onPress={() => onPress(item)} />
          </View>
        )}
      />
    </View>
  );
}

export function SectionTitle({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.head}>
      <Text style={styles.section}>{title}</Text>
      {!!onSeeAll && (
        <Focusable onPress={onSeeAll} hitSlop={10} style={styles.seeAllWrap}>
          <Text style={styles.seeAll}>See all</Text>
          <Icon name="chevron-right" size={14} color={colors.muted} />
        </Focusable>
      )}
    </View>
  );
}

export function PosterRow({ title, data, uriOf, labelOf, keyOf, ratingOf, progressOf, onPress, onSeeAll }: {
  title: string; data: any[]; uriOf: (x: any) => string | null; labelOf?: (x: any) => string;
  keyOf: (x: any) => string; ratingOf?: (x: any) => number | undefined; progressOf?: (x: any) => number | undefined;
  onPress: (x: any) => void; onSeeAll?: () => void;
}) {
  if (!data.length) return null;
  return (
    <View style={{ marginTop: 28 }}>
      <SectionTitle title={title} onSeeAll={onSeeAll} />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={keyOf}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
        renderItem={({ item }) => (
          <PosterCard uri={uriOf(item)} label={labelOf?.(item)} rating={ratingOf?.(item)} progress={progressOf?.(item)} onPress={() => onPress(item)} />
        )}
      />
    </View>
  );
}

// Three posters per row, wraps down the page.
export function PosterGrid({ data, uriOf, labelOf, keyOf, ratingOf, onPress }: {
  data: any[]; uriOf: (x: any) => string | null; labelOf?: (x: any) => string;
  keyOf: (x: any) => string; ratingOf?: (x: any) => number | undefined; onPress: (x: any) => void;
}) {
  const { width } = useWindowDimensions();
  const gap = 10;
  const cols = isTV ? Math.max(5, Math.floor((width - 200) / 190)) : 3;
  const w = Math.floor((width - (isTV ? 200 : 40) - gap * (cols - 1)) / cols);
  return (
    <View style={styles.grid}>
      {data.map((x) => (
        <View key={keyOf(x)} style={{ marginBottom: 14, marginRight: isTV ? gap : 0 }}>
          <PosterCard uri={uriOf(x)} label={labelOf?.(x)} rating={ratingOf?.(x)} width={w} onPress={() => onPress(x)} />
        </View>
      ))}
    </View>
  );
}

// Grey pulsing block shown while content loads.
export function Skeleton({ width, height, radiusPx = radius.sm, style }: {
  width: number | string; height: number; radiusPx?: number; style?: any;
}) {
  const v = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={[{ width: width as any, height, borderRadius: radiusPx, backgroundColor: colors.surface3, opacity: v }, style]} />;
}

export function RowSkeleton() {
  return (
    <View style={{ marginTop: 26 }}>
      <Skeleton width={150} height={18} style={{ marginLeft: 20, marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={120} height={180} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2 },
  fill: { width: '100%', height: '100%' },
  noImg: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  noImgText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  pTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  pFill: { height: 4, backgroundColor: colors.accent },
  rating: {
    position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, height: 20, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.7)',
  },
  ratingText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  section: { flex: 1, color: colors.text, fontSize: isTV ? 24 : 20, fontWeight: '800', letterSpacing: -0.3 },
  seeAllWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: isTV ? 'flex-start' : 'space-between', paddingHorizontal: 20 },
});
