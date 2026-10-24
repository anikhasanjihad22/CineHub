import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

export function Chips({ items, value, onChange, padded = true }: {
  items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; padded?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: padded ? 20 : 0, gap: 10 }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)}>
            {active ? (
              <LinearGradient colors={colors.amber} style={styles.chip}>
                <Text style={[styles.text, { color: colors.onAmber, fontWeight: '700' }]}>{it.label}</Text>
              </LinearGradient>
            ) : (
              <Pressable style={[styles.chip, styles.idle]} pointerEvents="none">
                <Text style={styles.text}>{it.label}</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { height: 40, paddingHorizontal: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  idle: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  text: { color: colors.text, fontSize: 14 },
});
