import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Credit } from '../components/Credit';
import { colors, radius } from '../theme';

// Placeholder poster tiles. Real TMDB posters replace these in the Home step.
const TILES: [string, string][] = [
  ['#5B2A86', '#1B1035'], ['#C0392B', '#2A0F12'], ['#1E6F5C', '#0B1F1A'],
  ['#B8860B', '#2A1F05'], ['#2C5AA0', '#0C1A33'], ['#8E3B6B', '#2A0F20'],
  ['#3D7A3D', '#0F230F'], ['#A0522D', '#2A140A'], ['#4B5FBF', '#12163A'],
];

export default function Welcome({ navigation }: any) {
  return (
    <Screen>
      <View style={styles.collage}>
        {TILES.map((t, i) => (
          <LinearGradient key={i} colors={t} style={styles.tile} />
        ))}
        <LinearGradient
          colors={['transparent', '#0E0B10']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View style={styles.logoRow}>
        <Logo size={38} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Your Entertainment{'\n'}Starts Right Here Today</Text>
        <Text style={styles.sub}>
          Discover movies, series, sports and news. Stream anytime, anywhere, effortlessly.
        </Text>
        <View style={{ height: 22 }} />
        <Button label="Get Started" onPress={() => navigation.navigate('Login', { mode: 'signup' })} />
        <View style={{ height: 12 }} />
        <Button label="Sign In" variant="glass" onPress={() => navigation.navigate('Login', { mode: 'signin' })} />
        <Credit />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  collage: {
    position: 'absolute',
    top: -30,
    left: -20,
    right: -20,
    height: '62%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }, { scale: 1.12 }],
    opacity: 0.9,
  },
  tile: {
    width: '29%',
    aspectRatio: 2 / 3,
    margin: '2%',
    borderRadius: radius.md,
  },
  logoRow: { alignItems: 'center', marginTop: 14 },
  panel: {
    marginTop: 'auto',
    margin: 16,
    padding: 22,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(30,26,32,0.88)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 33,
  },
  sub: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
});
