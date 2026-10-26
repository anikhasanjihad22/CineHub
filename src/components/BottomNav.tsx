import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { Focusable } from './Focusable';
import { LogoMark } from './Logo';
import { colors, radius, shadow } from '../theme';
import { useDownloads } from '../lib/downloads';

export type Tab = 'home' | 'search' | 'list' | 'downloads' | 'profile';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'list', label: 'My List', icon: 'bookmark' },
  { key: 'downloads', label: 'Downloads', icon: 'downloads' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

function useActiveDownloads() {
  return useDownloads().filter((d) => d.status === 'downloading').length;
}

// Phone: a floating, rounded tab bar (iOS style). It floats above the pages, so every page keeps NAV_SPACE free at the bottom.
export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  const active = useActiveDownloads();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 4 }]}>
      <View style={styles.bar}>
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.item}>
              <View style={[styles.pill, on && styles.pillOn]}>
                <Icon name={t.icon} size={22} color={on ? colors.text : colors.muted} filled={on} />
                {t.key === 'downloads' && active > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{active}</Text></View>
                )}
              </View>
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Android TV: a slim rail on the left, moved with the remote.
export function SideNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const active = useActiveDownloads();
  return (
    <View style={styles.rail}>
      <View style={{ marginBottom: 26, alignItems: 'center' }}><LogoMark size={40} /></View>
      {TABS.map((t) => {
        const on = t.key === tab;
        return (
          <Focusable key={t.key} onPress={() => onChange(t.key)} onFocus={() => onChange(t.key)} ring={radius.md} style={[styles.railItem, on && styles.railOn]}>
            <Icon name={t.icon} size={26} color={on ? colors.text : colors.muted} filled={on} />
            <Text style={[styles.railLabel, on && { color: colors.text }]}>{t.label}</Text>
            {t.key === 'downloads' && active > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{active}</Text></View>}
          </Focusable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, alignItems: 'center' },
  bar: {
    flexDirection: 'row', width: '100%', maxWidth: 520, paddingVertical: 8, paddingHorizontal: 6, borderRadius: radius.xl,
    backgroundColor: colors.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, ...shadow,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  label: { color: colors.muted, fontSize: 10.5, fontWeight: '600' },
  labelOn: { color: colors.text },
  badge: { position: 'absolute', top: -2, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  rail: { width: 120, paddingTop: 30, paddingHorizontal: 12, backgroundColor: '#050507', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  railItem: { alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: radius.md, marginBottom: 6 },
  railOn: { backgroundColor: 'rgba(255,255,255,0.1)' },
  railLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
