import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { colors, radius } from '../theme';

export type HeroSlide = {
  key: string;
  title: string;
  subtitle?: string;
  image: string | null;
  onPress: () => void;
};

// One big banner: poster, title, small info line and a Watch button.
export function HeroCard({ slide, width, height }: { slide: HeroSlide; width: number; height: number }) {
  return (
    <Pressable onPress={slide.onPress} style={{ width, height }}>
      {slide.image ? (
        <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface2 }]} />
      )}
      <LinearGradient colors={['rgba(10,10,12,0.35)', 'rgba(10,10,12,0)']} style={styles.top} />
      <LinearGradient colors={colors.scrim} locations={[0, 0.55, 1]} style={styles.bottom} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{slide.title}</Text>
        {!!slide.subtitle && <Text style={styles.sub} numberOfLines={1}>{slide.subtitle}</Text>}
        <View style={styles.btn}>
          <Icon name="play" size={18} color="#000" />
          <Text style={styles.btnText}>Watch now</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  info: { position: 'absolute', left: 20, right: 20, bottom: 34 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 6 },
  btn: {
    marginTop: 16, alignSelf: 'flex-start', height: 44, paddingHorizontal: 22, borderRadius: radius.sm,
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  btnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
