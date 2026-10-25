import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { colors } from '../theme';

export type Tab = 'home' | 'search' | 'list' | 'downloads' | 'profile';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'list', label: 'My List', icon: 'bookmark' },
  { key: 'downloads', label: 'Downloads', icon: 'downloads' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.item}>
            <Icon name={t.icon} size={23} color={on ? colors.text : colors.muted} filled={on} />
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', paddingTop: 8, backgroundColor: 'rgba(14,14,17,0.98)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  labelOn: { color: colors.text },
});
