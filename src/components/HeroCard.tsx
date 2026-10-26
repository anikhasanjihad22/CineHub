import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { Focusable } from './Focusable';
import { colors, FILL, radius } from '../theme';
import { isTV } from '../lib/platform';

export type HeroSlide = {
  key: string;
  title: string;
  subtitle?: string;
  image: string | null;
  onPress: () => void;
};

// One big banner: poster, title, small info line, Play and More info buttons.
export function HeroCard({ slide, width, height }: { slide: HeroSlide; width: number; height: number }) {
  return (
    <Pressable onPress={slide.onPress} focusable={false} style={{ width, height }}>
      {slide.image ? (
        <Image source={{ uri: slide.image }} style={FILL} resizeMode="cover" />
      ) : (
        <View style={[FILL, { backgroundColor: colors.surface2 }]} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={styles.top} />
      <LinearGradient colors={colors.scrim} locations={[0, 0.55, 1]} style={styles.bottom} />
      <View style={[styles.info, isTV && { left: 60, right: '40%', bottom: 50 }]}>
        <Text style={[styles.title, isTV && { fontSize: 44 }]} numberOfLines={2}>{slide.title}</Text>
        {!!slide.subtitle && <Text style={styles.sub} numberOfLines={1}>{slide.subtitle}</Text>}
        <View style={styles.btns}>
          <Focusable onPress={slide.onPress} ring={radius.md + 3} style={styles.play}>
            <Icon name="play" size={20} color="#000" />
            <Text style={styles.playText}>Play</Text>
          </Focusable>
          <Focusable onPress={slide.onPress} ring={radius.md + 3} style={styles.more}>
            <Icon name="info" size={20} color="#fff" />
            <Text style={styles.moreText}>More info</Text>
          </Focusable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '68%' },
  info: { position: 'absolute', left: 20, right: 20, bottom: 40 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 6, fontWeight: '500' },
  btns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  play: { height: 46, paddingHorizontal: 24, borderRadius: radius.md, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8 },
  playText: { color: '#000', fontSize: 16, fontWeight: '800' },
  more: { height: 46, paddingHorizontal: 20, borderRadius: radius.md, backgroundColor: 'rgba(120,120,128,0.55)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  moreText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
