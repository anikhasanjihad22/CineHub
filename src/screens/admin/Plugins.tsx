import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { Chips } from '../../components/Chips';
import { colors, radius } from '../../theme';
import { supabase } from '../../lib/supabase';
import { clearPluginCache } from '../../plugins/loader';
import type { Plugin } from '../../plugins/types';
import { SAMPLE_CATALOG_PLUGIN, SAMPLE_STREAM_PLUGIN } from '../../plugins/samples';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ALL_CATS = ['movies', 'tv', 'sports', 'news'];

export default function AdminPlugins({ navigation }: any) {
  const [list, setList] = useState<Plugin[]>([]);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');

  // form
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'stream' | 'catalog'>('stream');
  const [cats, setCats] = useState<string[]>(['movies', 'tv']);
  const [priority, setPriority] = useState('100');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('plugins').select('*').order('priority', { ascending: true });
    if (error) setMsg(error.message);
    else setList((data ?? []) as Plugin[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setEnabled(p: Plugin, v: boolean) {
    await supabase.from('plugins').update({ enabled: v, updated_at: new Date().toISOString() }).eq('id', p.id);
    clearPluginCache();
    load();
  }

  function remove(p: Plugin) {
    Alert.alert('Delete plugin', `Delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await supabase.from('plugins').delete().eq('id', p.id); clearPluginCache(); load(); },
      },
    ]);
  }

  async function fetchCode() {
    setMsg('');
    try {
      const r = await fetch(url.trim());
      if (!r.ok) throw new Error(`Could not download (${r.status})`);
      setCode(await r.text());
    } catch (e: any) { setMsg(e?.message ?? 'Could not download the code.'); }
  }

  function useSample(k: 'stream' | 'catalog') {
    setKind(k);
    if (k === 'stream') { setName('Test stream'); setCats(['movies', 'tv']); setCode(SAMPLE_STREAM_PLUGIN); }
    else { setName('Test catalog'); setCats(['sports', 'news']); setCode(SAMPLE_CATALOG_PLUGIN); }
  }

  async function save() {
    setMsg('');
    if (!name.trim() || !code.trim() || cats.length === 0) return setMsg('Name, category and code are required.');
    setSaving(true);
    const { error } = await supabase.from('plugins').insert({
      name: name.trim(), slug: slugify(name) + '-' + Math.random().toString(36).slice(2, 6),
      kind, categories: cats, priority: parseInt(priority, 10) || 100, code,
    });
    setSaving(false);
    if (error) return setMsg(error.message);
    clearPluginCache();
    setAdding(false); setName(''); setCode(''); setUrl('');
    load();
  }

  const toggleCat = (c: string) => setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}><Icon name="back" /></Pressable>
        <Text style={styles.title}>Plugins</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {!!msg && <Text style={styles.error}>{msg}</Text>}

        {list.length === 0 && !adding && <Text style={styles.muted}>No plugins yet. Add one below.</Text>}

        {list.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.muted}>
                {p.kind}  |  {p.categories.join(', ')}  |  priority {p.priority}
              </Text>
            </View>
            <Switch value={p.enabled} onValueChange={(v) => setEnabled(p, v)} trackColor={{ true: colors.amberSolid }} />
            <Pressable onPress={() => remove(p)} style={styles.del}><Text style={styles.delText}>Delete</Text></Pressable>
          </View>
        ))}

        {!adding ? (
          <View style={{ marginTop: 20 }}><Button label="Add plugin" onPress={() => setAdding(true)} /></View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New plugin</Text>

            <View style={styles.row}>
              <Pressable onPress={() => useSample('stream')} style={styles.sample}><Text style={styles.sampleText}>Test stream sample</Text></Pressable>
              <Pressable onPress={() => useSample('catalog')} style={styles.sample}><Text style={styles.sampleText}>Test catalog sample</Text></Pressable>
            </View>

            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />

            <Chips padded={false} items={[{ key: 'stream', label: 'Stream links' }, { key: 'catalog', label: 'Catalog' }]} value={kind} onChange={(k) => setKind(k as any)} />
            <View style={{ height: 12 }} />
            <Text style={styles.muted}>Categories (tap to select)</Text>
            <View style={styles.catRow}>
              {ALL_CATS.map((c) => (
                <Pressable key={c} onPress={() => toggleCat(c)} style={[styles.cat, cats.includes(c) && styles.catOn]}>
                  <Text style={{ color: cats.includes(c) ? colors.onAmber : colors.text, fontWeight: '600' }}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="Priority (lower runs first)" placeholderTextColor={colors.muted} keyboardType="number-pad" value={priority} onChangeText={setPriority} />

            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Code link (optional)" placeholderTextColor={colors.muted} autoCapitalize="none" value={url} onChangeText={setUrl} />
              <Pressable onPress={fetchCode} style={styles.sample}><Text style={styles.sampleText}>Fetch</Text></Pressable>
            </View>

            <TextInput
              style={[styles.input, { height: 180, textAlignVertical: 'top', paddingTop: 14, marginTop: 12 }]}
              placeholder="Plugin code" placeholderTextColor={colors.muted} multiline autoCapitalize="none" autoCorrect={false}
              value={code} onChangeText={setCode}
            />

            <Button label="Install plugin" onPress={save} loading={saving} />
            <Pressable onPress={() => setAdding(false)}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  error: { color: colors.danger, marginBottom: 12, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  del: { paddingHorizontal: 8, paddingVertical: 6 },
  delText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  form: { marginTop: 22, padding: 16, borderRadius: radius.lg, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  formTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  sample: { paddingHorizontal: 14, height: 44, borderRadius: radius.pill, backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
  sampleText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: { height: 52, borderRadius: radius.md, paddingHorizontal: 16, marginBottom: 12, color: colors.text, fontSize: 15, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: colors.border },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  cat: { paddingHorizontal: 14, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong },
  catOn: { backgroundColor: colors.amberSolid },
  cancel: { color: colors.muted, textAlign: 'center', marginTop: 16 },
});
