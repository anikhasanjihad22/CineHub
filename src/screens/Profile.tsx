import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { pickAvatar, removeAvatar, useAvatar } from '../lib/avatar';
import { Avatar } from '../components/Avatar';
import { Focusable } from '../components/Focusable';
import { isTV } from '../lib/platform';
import { openSupport } from '../lib/support';
import { Icon, IconName } from '../components/Icon';
import { Credit } from '../components/Credit';
import { refreshPlugins } from '../plugins/loader';
import { clearCatalogCache } from '../plugins/catalog';
import { APP_VERSION, colors, NAV_SPACE, radius, SUPPORT_URL } from '../theme';

export const AUTONEXT_KEY = 'cinehub:autonext';

function Row({ icon, label, sub, onPress, right, danger }: {
  icon: IconName; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean;
}) {
  return (
    <Focusable onPress={onPress} disabled={!onPress} ring={radius.md} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface3 }]}>
      <View style={styles.rowIcon}><Icon name={icon} size={20} color={danger ? colors.danger : colors.text} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {!!sub && <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null)}
    </Focusable>
  );
}

export default function Profile({ navigation, active }: any) {
  const { session, isAdmin, displayName, updateName } = useAuth();
  const email = session?.user.email ?? '';
  const [autoNext, setAutoNext] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState('');
  const uid = session?.user.id ?? '';
  const photo = useAvatar(uid);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  function openEdit() { setNameDraft(displayName); setEditing(true); }

  async function changePhoto() {
    try { await pickAvatar(uid); } catch { Alert.alert('Could not open your photos', 'Please try again.'); }
  }

  async function saveProfile() {
    if (nameDraft.trim() && nameDraft.trim() !== displayName) await updateName(nameDraft);
    setEditing(false);
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
      contentContainerStyle={{ paddingBottom: isTV ? 40 : NAV_SPACE }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshContent} tintColor={colors.text} colors={[colors.accent]} progressBackgroundColor={colors.surface2} />}
    >
      <Text style={styles.heading}>Profile</Text>

      <Focusable onPress={openEdit} ring={radius.lg + 3} style={styles.card}>
        <Avatar uid={uid} name={displayName} size={68} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
          <View style={[styles.badge, isAdmin && styles.badgeAdmin]}>
            <Text style={[styles.badgeText, isAdmin && { color: colors.onAccent }]}>{isAdmin ? 'Admin' : 'Member'}</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.muted} />
      </Focusable>

      {isAdmin && (
        <>
          <Text style={styles.group}>Admin</Text>
          <View style={styles.box}>
            <Row icon="plug" label="Manage plugins" sub="Install, test and update video providers" onPress={() => navigation.navigate('AdminPlugins')} />
            <View style={styles.sep} />
            <Row icon="download" label="Publish app update" sub="Send a new version to every phone" onPress={() => navigation.navigate('AppUpdate')} />
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

      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.mBack}>
          <Pressable style={{ flex: 1 }} onPress={() => setEditing(false)} />
          <View style={styles.sheet}>
            <View style={styles.grab} />
            <Text style={styles.sheetTitle}>Edit profile</Text>
            <Pressable onPress={changePhoto} style={{ alignSelf: 'center', marginTop: 18 }}>
              <Avatar uid={uid} name={nameDraft || displayName} size={104} />
              <View style={styles.camBadge}><Icon name="edit" size={14} color="#000" /></View>
            </Pressable>
            {!!photo && (
              <Pressable onPress={() => removeAvatar(uid)} style={{ alignSelf: 'center', paddingVertical: 10 }}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove photo</Text>
              </Pressable>
            )}
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={nameDraft} onChangeText={setNameDraft} maxLength={30} placeholder="Your name" placeholderTextColor={colors.muted}
              style={styles.field} returnKeyType="done" onSubmitEditing={saveProfile}
            />
            <Pressable onPress={saveProfile} style={styles.save}><Text style={styles.saveText}>Save</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, padding: 16,
    borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  camBadge: { position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  email: { color: colors.muted, fontSize: 13, marginTop: 2 },
  mBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surface3 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  field: { height: 52, borderRadius: radius.md, backgroundColor: colors.surface2, color: colors.text, fontSize: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },
  save: { height: 54, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  badge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, height: 22, borderRadius: 6, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  badgeAdmin: { backgroundColor: colors.accent },
  badgeText: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  group: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 24, marginTop: 24, marginBottom: 8 },
  box: { marginHorizontal: 20, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64 },
  version: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 22 },
});
