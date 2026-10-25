import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getAvatar, pickAvatar, removeAvatar } from '../lib/avatar';
import { openSupport } from '../lib/support';
import { Icon, IconName } from '../components/Icon';
import { Credit } from '../components/Credit';
import { refreshPlugins } from '../plugins/loader';
import { clearCatalogCache } from '../plugins/catalog';
import { APP_VERSION, colors, radius, SUPPORT_URL } from '../theme';

export const AUTONEXT_KEY = 'cinehub:autonext';

function Row({ icon, label, sub, onPress, right, danger }: {
  icon: IconName; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface3 }]}>
      <View style={styles.rowIcon}><Icon name={icon} size={20} color={danger ? colors.danger : colors.text} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {!!sub && <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export default function Profile({ navigation, active }: any) {
  const { session, isAdmin } = useAuth();
  const email = session?.user.email ?? '';
  const [autoNext, setAutoNext] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState('');
  const uid = session?.user.id ?? '';
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => { if (uid) getAvatar(uid).then(setPhoto); }, [uid]);

  async function changePhoto() {
    try {
      const uri = await pickAvatar(uid);
      if (uri) setPhoto(uri);
    } catch { Alert.alert('Could not open your photos', 'Please try again.'); }
  }

  function photoMenu() {
    const buttons: any[] = [{ text: 'Choose from gallery', onPress: changePhoto }];
    if (photo) buttons.push({ text: 'Remove photo', style: 'destructive', onPress: () => { removeAvatar(uid); setPhoto(null); } });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', undefined, buttons);
  }

  useEffect(() => {
    AsyncStorage.getItem(AUTONEXT_KEY).then((v) => { if (v === '0') setAutoNext(false); }).catch(() => {});
  }, [active]);

  function toggleAuto(v: boolean) {
    setAutoNext(v);
    AsyncStorage.setItem(AUTONEXT_KEY, v ? '1' : '0').catch(() => {});
  }

  async function refreshContent() {
    setRefreshing(true);
    clearCatalogCache();
    await refreshPlugins().catch(() => {});
    setRefreshing(false);
    setNote('Content refreshed.');
    setTimeout(() => setNote(''), 2500);
  }

  function logout() {
    Alert.alert('Log out', 'Do you want to log out of CineHub?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { supabase.auth.signOut(); } },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshContent} tintColor={colors.text} colors={[colors.accent]} progressBackgroundColor={colors.surface2} />}
    >
      <Text style={styles.heading}>Profile</Text>

      <View style={styles.card}>
        <Pressable onPress={photoMenu} style={styles.avatar}>
          {photo
            ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <Text style={styles.avatarText}>{(email[0] ?? 'C').toUpperCase()}</Text>}
          <View style={styles.camBadge}><Icon name="edit" size={11} color="#000" /></View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
          <View style={[styles.badge, isAdmin && styles.badgeAdmin]}>
            <Text style={[styles.badgeText, isAdmin && { color: colors.onAccent }]}>{isAdmin ? 'Admin' : 'Member'}</Text>
          </View>
        </View>
      </View>

      {isAdmin && (
        <>
          <Text style={styles.group}>Admin</Text>
          <View style={styles.box}>
            <Row icon="plug" label="Manage plugins" sub="Install, test and update video providers" onPress={() => navigation.navigate('AdminPlugins')} />
          </View>
        </>
      )}

      <Text style={styles.group}>Playback</Text>
      <View style={styles.box}>
        <Row
          icon="next" label="Play next episode automatically" sub="Continues a series without asking"
          right={<Switch value={autoNext} onValueChange={toggleAuto} trackColor={{ true: colors.accent, false: colors.surface3 }} thumbColor="#fff" />}
        />
      </View>

      <Text style={styles.group}>App</Text>
      <View style={styles.box}>
        <Row icon="refresh" label="Refresh content" sub={note || 'Reload lists and servers'} onPress={refreshContent} />
        <View style={styles.sep} />
        <Row icon="send" label="Contact support" sub={SUPPORT_URL.replace('https://', '')} onPress={openSupport} />
      </View>

      <View style={[styles.box, { marginTop: 22 }]}>
        <Row icon="logout" label="Log out" onPress={logout} danger />
      </View>

      <Text style={styles.version}>CineHub v{APP_VERSION}</Text>
      <Credit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, padding: 16,
    borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  camBadge: { position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, borderTopLeftRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onAccent, fontSize: 24, fontWeight: '900' },
  email: { color: colors.text, fontSize: 16, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, height: 22, borderRadius: 6, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  badgeAdmin: { backgroundColor: colors.accent },
  badgeText: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  group: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 24, marginTop: 24, marginBottom: 8 },
  box: { marginHorizontal: 20, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64 },
  version: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 22 },
});
