import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Focusable } from './Focusable';
import { colors, radius } from '../theme';

// Horizontal filter pills (Home categories, seasons).
export function Chips({ items, value, onChange, padded = true }: {
  items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; padded?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: padded ? 20 : 0, gap: 8 }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Focusable key={it.key} onPress={() => onChange(it.key)} ring={20} style={[styles.chip, active && styles.active]}>
            <Text style={[styles.text, active && styles.activeText]}>{it.label}</Text>
          </Focusable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
  },
  active: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  text: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  activeText: { color: '#000000', fontWeight: '700' },
});
