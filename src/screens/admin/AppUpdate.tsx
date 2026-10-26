import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { supabase } from '../../lib/supabase';
import { compareVersions, fetchConfig } from '../../lib/update';
import { APP_VERSION, colors, radius } from '../../theme';

// Admin page: publish a new version. Every phone sees it on next open (or within 5 minutes).
export default function AppUpdate({ navigation }: any) {
  const [latest, setLatest] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [force, setForce] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchConfig().then((c) => {
      if (!c) return;
      setLatest(c.latest_version); setUrl(c.apk_url ?? ''); setNotes(c.notes ?? '');
      setForce(compareVersions(c.min_version, c.latest_version) >= 0);
    });
  }, []);

  async function publish() {
    const v = latest.trim();
    if (!/^\d+(\.\d+){1,3}$/.test(v)) return Alert.alert('Version', 'Write the version like 3.1.0');
    if (!/^https?:\/\//i.test(url.trim())) return Alert.alert('APK link', 'Paste the direct link of the APK (starts with https://).');
    setBusy(true);
    const row = { id: 1, latest_version: v, min_version: force ? v : '1.0.0', apk_url: url.trim(), notes: notes.trim() || null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('app_config').upsert(row, { onConflict: 'id' });
    setBusy(false);
    if (error) return Alert.alert('Could not save', error.message);
    Alert.alert('Published', force ? 'Everyone must update to this version before they can use the app.' : 'Everyone will see an "Update available" card.');
  }

  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}><Icon name="back" size={22} /></Pressable>
        <Text style={styles.heading}>App update</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.info}>This phone runs v{APP_VERSION}. After you build a new APK, publish it here.</Text>

        <Text style={styles.label}>New version</Text>
        <TextInput value={latest} onChangeText={setLatest} placeholder="3.1.0" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />

        <Text style={styles.label}>APK download link</Text>
        <TextInput
          value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} style={styles.input}
          placeholder="https://github.com/YOU/REPO/releases/latest/download/CineHub.apk" placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>What's new</Text>
        <TextInput value={notes} onChangeText={setNotes} multiline style={[styles.input, { height: 110, paddingTop: 14, textAlignVertical: 'top' }]} placeholder="Faster downloads, new player..." placeholderTextColor={colors.muted} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Force update</Text>
            <Text style={styles.switchSub}>Older versions are blocked until they update.</Text>
          </View>
          <Switch value={force} onValueChange={setForce} trackColor={{ true: colors.accent, false: colors.surface3 }} thumbColor="#fff" />
        </View>

        <View style={{ height: 22 }} />
        <Button label="Publish update" loading={busy} onPress={publish} />
        <Text style={styles.tip}>
          Tip: the GitHub build uploads CineHub.apk to Releases. The link
          https://github.com/YOU/REPO/releases/latest/download/CineHub.apk always points to the newest build.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { color: colors.text, fontSize: 20, fontWeight: '800' },
  info: { color: colors.textDim, lineHeight: 21, marginBottom: 8 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 14, height: 52, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  switchTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  switchSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  tip: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
});
