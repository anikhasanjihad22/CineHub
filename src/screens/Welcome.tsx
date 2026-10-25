import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { colors, FILL, radius } from '../theme';
import { hasKey, img, trending } from '../lib/tmdb';
import { openSupport } from '../lib/support';

export default function Welcome({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [posters, setPosters] = useState<string[]>([]);

  // A wall of trending posters behind the buttons. If TMDB is not reachable the screen is simply plain.
  useEffect(() => {
    if (!hasKey()) return;
    Promise.all([trending('movie'), trending('tv')])
      .then(([a, b]) => {
        const all = [...a, ...b].map((t) => img(t.poster, 'w342')).filter(Boolean) as string[];
        setPosters(all.slice(0, 12));
      })
      .catch(() => {});
  }, []);

  const gap = 10;
  const colW = Math.floor((width - gap * 4) / 3);
  const colH = Math.round(colW * 1.5);
  const cols = [0, 1, 2].map((c) => posters.filter((_, i) => i % 3 === c));

  return (
    <Screen edges={[]}>
      <View style={[FILL, { overflow: 'hidden' }]}>
        <View style={{ flexDirection: 'row', gap, paddingHorizontal: gap, marginTop: -colH * 0.25 }}>
          {cols.map((list, c) => (
            <View key={c} style={{ gap, marginTop: c === 1 ? colH * 0.45 : 0 }}>
              {list.map((u, i) => (
                <Image key={i} source={{ uri: u }} style={{ width: colW, height: colH, borderRadius: radius.sm }} />
              ))}
            </View>
          ))}
        </View>
        <LinearGradient
          colors={['rgba(10,10,12,0.55)', 'rgba(10,10,12,0.78)', colors.bg]}
          locations={[0, 0.45, 0.78]}
          style={FILL}
        />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 14 }]}><Logo size={28} /></View>

      <View style={{ flex: 1 }} />

      <View style={[styles.bottom, { minHeight: height * 0.36, paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <Text style={styles.title}>Unlimited movies,{'\n'}series and more.</Text>
        <Text style={styles.sub}>Watch anywhere. Pick up right where you stopped.</Text>

        <View style={{ height: 22 }} />
        <Button label="Get started" onPress={() => navigation.navigate('Login', { mode: 'signup' })} />
        <View style={{ height: 12 }} />
        <Button label="Sign in" variant="secondary" onPress={() => navigation.navigate('Login', { mode: 'signin' })} />

        <Pressable onPress={openSupport} style={styles.help} hitSlop={8}>
          <Icon name="send" size={15} color={colors.muted} />
          <Text style={styles.helpText}>Need help? Contact support</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 22, paddingTop: 14 },
  bottom: { paddingHorizontal: 22, paddingBottom: 16, justifyContent: 'flex-end' },
  title: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.8, lineHeight: 40 },
  sub: { color: colors.textDim, fontSize: 15, marginTop: 10, lineHeight: 22 },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  helpText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
