import React, { useEffect, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View, useWindowDimensions } from 'react-native';
import { HeroCard, HeroSlide } from './HeroCard';
import { colors } from '../theme';

export type { HeroSlide } from './HeroCard';

// Swipeable banner with dots. Moves to the next slide by itself every 6 seconds.
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { width } = useWindowDimensions();
  const height = Math.min(Math.round(width * 1.2), 520);
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList<HeroSlide>>(null);
  const idx = useRef(0);
  const touching = useRef(false);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => {
      if (touching.current) return;
      const next = (idx.current + 1) % slides.length;
      idx.current = next;
      setIndex(next);
      ref.current?.scrollToOffset({ offset: next * width, animated: true });
    }, 6000);
    return () => clearInterval(t);
  }, [slides.length, width]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    idx.current = i;
    setIndex(i);
  };

  return (
    <View>
      <FlatList
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={slides}
        keyExtractor={(s) => s.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollBeginDrag={() => { touching.current = true; }}
        onMomentumScrollEnd={onEnd}
        renderItem={({ item }) => <HeroCard slide={item} width={width} height={height} />}
      />
      {slides.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {slides.map((s, i) => <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { width: 18, backgroundColor: colors.text },
});
