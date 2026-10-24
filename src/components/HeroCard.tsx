import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';
import { img, Title } from '../lib/tmdb';

export function HeroCard({ item, onPress }: { item: Title; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const w = width - 40;
  const uri = img(item.poster, 'w780');
  return (
    <Pressable onPress={onPress} style={[styles.card, { width: w, height: w * 1.2 }]}>
      {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
      <LinearGradient colors={['transparent', 'rgba(14,11,16,0.95)']} style={styles.shade} />
      <View style={styles.bottom}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.meta}>{[item.year, item.rating ? `${item.rating} rating` : ''].filter(Boolean).join('   ')}</Text>
        <LinearGradient colors={colors.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
          <Text style={styles.btnText}>Watch Now</Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.glass },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  bottom: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 14 },
  btn: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.onAmber, fontSize: 16, fontWeight: '700' },
});
