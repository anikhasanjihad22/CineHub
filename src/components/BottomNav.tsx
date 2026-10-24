import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { colors, radius } from '../theme';

export type Tab = 'home' | 'search' | 'profile';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: 12 + Math.min(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.item, active && styles.active]}>
              <Icon name={t.icon} size={20} color={active ? colors.onAmber : colors.text} />
              {active && <Text style={styles.label}>{t.label}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row', gap: 8, padding: 8, borderRadius: radius.pill,
    backgroundColor: 'rgba(40,34,42,0.95)', borderWidth: 1, borderColor: colors.border,
  },
  item: { height: 46, minWidth: 46, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.glass },
  active: { backgroundColor: '#FFFFFF' },
  label: { color: colors.onAmber, fontWeight: '700', fontSize: 14 },
});
