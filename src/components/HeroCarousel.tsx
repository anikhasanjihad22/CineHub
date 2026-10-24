import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

export type HeroSlide = { key: string; title: string; subtitle?: string; image: string | null; onPress: () => void };

// Hero banner that changes by itself every few seconds: the picture fades in and slowly zooms,
// the text slides up. Swipe left / right to change by hand. Tap to open.
export function HeroCarousel({ slides, interval = 5500 }: { slides: HeroSlide[]; interval?: number }) {
  const { width } = useWindowDimensions();
  const w = width - 40;
  const h = Math.round(w * 1.15);
  const count = slides.length;

  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const idx = useRef(0);
  const timer = useRef<any>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const text = useRef(new Animated.Value(1)).current;
  const zoom = useRef(new Animated.Value(0)).current;

  function show(n: number) {
    if (count < 1) return;
    const next = ((n % count) + count) % count;
    setPrev(idx.current === next ? null : idx.current);
    idx.current = next;
    setI(next);
    fade.setValue(0); text.setValue(0); zoom.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 650, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1, duration: interval + 1500, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  }

  function restart() {
    clearInterval(timer.current);
    if (count > 1) timer.current = setInterval(() => show(idx.current + 1), interval);
  }

  const act = useRef({ next: () => {}, back: () => {} });
  act.current = { next: () => { show(idx.current + 1); restart(); }, back: () => { show(idx.current - 1); restart(); } };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -40) act.current.next();
        else if (g.dx > 40) act.current.back();
      },
    }),
  ).current;

  // Starts again whenever the list of slides changes (new plugin content, refresh).
  const first = slides[0]?.key ?? '';
  useEffect(() => {
    idx.current = 0;
    setPrev(null);
    show(0);
    restart();
    return () => clearInterval(timer.current);
  }, [count, first]);

  if (count === 0) return null;
  const cur = slides[Math.min(i, count - 1)];
  const old = prev != null ? slides[prev] : null;
  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rise = text.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <View style={[styles.card, { width: w, height: h }]} {...pan.panHandlers}>
      {old?.image ? <Animated.Image source={{ uri: old.image }} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.12 }] }]} resizeMode="cover" /> : null}
      {cur.image ? (
        <Animated.Image source={{ uri: cur.image }} style={[StyleSheet.absoluteFill, { opacity: fade, transform: [{ scale }] }]} resizeMode="cover" />
      ) : null}
      <LinearGradient colors={['transparent', 'rgba(14,11,16,0.96)']} style={styles.shade} pointerEvents="none" />

      <Pressable style={StyleSheet.absoluteFill} onPress={cur.onPress}>
        <Animated.View style={[styles.bottom, { opacity: text, transform: [{ translateY: rise }] }]}>
          <Text style={styles.title} numberOfLines={2}>{cur.title}</Text>
          {!!cur.subtitle && <Text style={styles.meta} numberOfLines={1}>{cur.subtitle}</Text>}
          <LinearGradient colors={colors.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
            <Text style={styles.btnText}>Watch Now</Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>

      {count > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {slides.map((s, k) => (
            <View key={s.key} style={[styles.dot, k === i && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.glass },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  bottom: { position: 'absolute', left: 18, right: 18, bottom: 34 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 14 },
  btn: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { color: colors.onAmber, fontSize: 16, fontWeight: '700' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { width: 20, backgroundColor: colors.amberSolid },
});
