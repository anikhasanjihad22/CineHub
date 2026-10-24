import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, radius } from '../theme';

export function PosterCard({ uri, label, width = 118, onPress }: {
  uri: string | null; label?: string; width?: number; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ width }}>
      <View style={[styles.box, { width, height: width * 1.5 }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.fill} resizeMode="cover" />
        ) : (
          <View style={[styles.fill, styles.noImg]}>
            <Text style={styles.noImgText} numberOfLines={4}>{label}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

export function PosterRow({ title, data, uriOf, labelOf, keyOf, onPress, onSeeAll }: {
  title: string; data: any[]; uriOf: (x: any) => string | null; labelOf?: (x: any) => string;
  keyOf: (x: any) => string; onPress: (x: any) => void; onSeeAll?: () => void;
}) {
  if (!data.length) return null;
  return (
    <View style={{ marginTop: 22 }}>
      {onSeeAll ? (
        <View style={styles.head}>
          <Text style={[styles.section, { flex: 1, paddingHorizontal: 0, marginBottom: 0 }]}>{title}</Text>
          <Pressable onPress={onSeeAll} hitSlop={10}><Text style={styles.seeAll}>See all</Text></Pressable>
        </View>
      ) : (
        <SectionTitle title={title} />
      )}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={keyOf}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => (
          <PosterCard uri={uriOf(item)} label={labelOf?.(item)} onPress={() => onPress(item)} />
        )}
      />
    </View>
  );
}

// Three posters per row, wraps down the page.
export function PosterGrid({ data, uriOf, labelOf, keyOf, onPress }: {
  data: any[]; uriOf: (x: any) => string | null; labelOf?: (x: any) => string;
  keyOf: (x: any) => string; onPress: (x: any) => void;
}) {
  const { width } = useWindowDimensions();
  const w = Math.floor((width - 40 - 24) / 3);
  return (
    <View style={styles.grid}>
      {data.map((x) => (
        <View key={keyOf(x)} style={{ marginBottom: 14 }}>
          <PosterCard uri={uriOf(x)} label={labelOf?.(x)} width={w} onPress={() => onPress(x)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.glass },
  fill: { width: '100%', height: '100%' },
  noImg: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  noImgText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  seeAll: { color: colors.amberSolid, fontSize: 13, fontWeight: '700' },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20 },
});
