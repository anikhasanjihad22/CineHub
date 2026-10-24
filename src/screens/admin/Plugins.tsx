import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { colors, radius } from '../../theme';
import { supabase } from '../../lib/supabase';
import { refreshPlugins } from '../../plugins/loader';
import { clearCatalogCache } from '../../plugins/catalog';
import { capabilities, getPluginError, inspectCode, testPlugin } from '../../plugins/sandbox';
import type { Plugin } from '../../plugins/types';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PRESET_CATS = ['movies', 'tv', 'sports', 'news', 'anime', 'live'];

// github.com/user/repo/blob/main/file.js  ->  raw.githubusercontent.com/user/repo/main/file.js
function rawUrl(u: string) {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i.exec(u.trim());
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : u.trim();
}

function bump(v: string) {
  const parts = (v || '1.0.0').split('.').map((x) => parseInt(x, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

export default function AdminPlugins({ navigation }: any) {
  const [list, setList] = useState<Plugin[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Plugin | null>(null);
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState<{ title: string; lines: string[] } | null>(null);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // form
  const [name, setName] = useState('');
  const [cats, setCats] = useState<string[]>(['movies', 'tv']);
  const [catOptions, setCatOptions] = useState<string[]>(PRESET_CATS);
  const [custom, setCustom] = useState('');
  const [priority, setPriority] = useState('100');
  const [timeoutSec, setTimeoutSec] = useState('20');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('plugins').select('*').order('priority', { ascending: true });
    if (error) setMsg(error.message);
    else setList((data ?? []) as Plugin[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  // After any change: every screen in this app reloads, other phones pick it up within about a minute.
  async function afterChange() {
    clearCatalogCache();
    await refreshPlugins().catch(() => {});
    await load();
  }

  async function onRefresh() {
    setRefreshing(true);
    await afterChange();
    setRefreshing(false);
  }

  async function setEnabled(p: Plugin, v: boolean) {
    await supabase.from('plugins').update({ enabled: v, updated_at: new Date().toISOString() }).eq('id', p.id);
    afterChange();
  }

  function remove(p: Plugin) {
    Alert.alert('Delete plugin', `Delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('plugins').delete().eq('id', p.id); afterChange(); } },
    ]);
  }

  async function runTest(title: string, input: { name: string; code: string; categories: string[]; timeout_ms: number }) {
    setReport(null);
    setTesting(true);
    const lines = await testPlugin(input).catch((e) => ['Test failed: ' + (e?.message ?? e)]);
    setTesting(false);
    setReport({ title, lines });
  }

  function startAdd() {
    setEditing(null); setName(''); setCode(''); setUrl(''); setCats(['movies', 'tv']); setPriority('100'); setTimeoutSec('20');
    setAdding(true);
  }

  function startEdit(p: Plugin) {
    setEditing(p); setName(p.name); setCode(p.code); setUrl('');
    setCats(p.categories); setCatOptions((cur) => Array.from(new Set([...cur, ...p.categories])));
    setPriority(String(p.priority)); setTimeoutSec(String(Math.round((p.timeout_ms || 20000) / 1000)));
    setAdding(true);
  }

  // Nuvio repo link (manifest.json): downloads every provider in it and installs each one as a plugin.
  async function importManifest(manifest: any, manifestUrl: string) {
    const base = manifestUrl.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    const scrapers: any[] = (manifest.scrapers as any[]).filter((s) => s && s.filename && s.enabled !== false);
    const have = new Set(list.map((p) => p.name.toLowerCase()));
    const lines: string[] = [];
    let ok = 0;
    for (const sc of scrapers) {
      const nm = String(sc.name || sc.id || sc.filename);
      try {
        if (have.has(nm.toLowerCase())) { lines.push(`skip  ${nm} (already installed)`); continue; }
        const r = await fetch(base + String(sc.filename).replace(/^\//, ''));
        if (!r.ok) throw new Error(`download ${r.status}`);
        const src = await r.text();
        const caps = inspectCode(src);
        if (caps.error) throw new Error(caps.error.slice(0, 80));
        if (!caps.stream && !caps.catalog) throw new Error('no getStreams');
        const types: string[] = Array.isArray(sc.supportedTypes) ? sc.supportedTypes : ['movie', 'tv'];
        const categories = [types.includes('movie') && 'movies', types.includes('tv') && 'tv'].filter(Boolean) as string[];
        const { error } = await supabase.from('plugins').insert({
          name: nm, slug: slugify(nm) + '-' + Math.random().toString(36).slice(2, 6),
          kind: caps.catalog && !caps.stream ? 'catalog' : 'stream',
          categories: categories.length ? categories : ['movies', 'tv'],
          priority: 100, timeout_ms: 30000, code: src, version: String(sc.version || '1.0.0'),
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
        ok++; lines.push(`ok    ${nm}`);
      } catch (e: any) {
        lines.push(`FAIL  ${nm}: ${e?.message ?? e}`);
      }
    }
    setReport({ title: `Repo import: ${ok}/${scrapers.length} installed`, lines });
    setUrl('');
    afterChange();
  }

  async function fetchCode() {
    setMsg('');
    try {
      const u = rawUrl(url);
      const r = await fetch(u);
      if (!r.ok) throw new Error(`Could not download (${r.status})`);
      const text = await r.text();
      let j: any = null;
      try { j = JSON.parse(text); } catch {}
      if (j && Array.isArray(j.scrapers)) {
        setMsg('Repo link found. Installing all providers, please wait...');
        await importManifest(j, u);
        setMsg('');
        return;
      }
      setCode(text);
    } catch (e: any) { setMsg(e?.message ?? 'Could not download the code.'); }
  }

  function addCustomCat() {
    const c = slugify(custom);
    setCustom('');
    if (!c) return;
    setCatOptions((cur) => (cur.includes(c) ? cur : [...cur, c]));
    setCats((cur) => (cur.includes(c) ? cur : [...cur, c]));
  }

  const toggleCat = (c: string) => setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const timeoutMs = Math.min(Math.max((parseInt(timeoutSec, 10) || 20) * 1000, 15000), 60000);

  async function save() {
    setMsg('');
    if (!name.trim() || !code.trim() || cats.length === 0) return setMsg('Name, category and code are required.');
    const caps = inspectCode(code);
    if (caps.error) return setMsg('Code error: ' + caps.error + '\nPress Test for details.');
    if (!caps.stream && !caps.catalog) return setMsg('No getStreams or getCatalog function found in this code.');
    const kind = caps.catalog && !caps.stream ? 'catalog' : 'stream';

    setSaving(true);
    const row = { name: name.trim(), kind, categories: cats, priority: parseInt(priority, 10) || 100, timeout_ms: timeoutMs, code, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await supabase.from('plugins').update({ ...row, version: bump(editing.version) }).eq('id', editing.id)
      : await supabase.from('plugins').insert({ ...row, slug: slugify(name) + '-' + Math.random().toString(36).slice(2, 6) });
    setSaving(false);
    if (error) return setMsg(error.message);
    setAdding(false); setEditing(null); setName(''); setCode(''); setUrl('');
    afterChange();
  }

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}><Icon name="back" /></Pressable>
        <Text style={styles.title}>Plugins</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amberSolid} colors={[colors.amberSolid]} progressBackgroundColor="#1A1216" />}
      >
        {!!msg && <Text style={styles.error}>{msg}</Text>}

        {(testing || report) && (
          <View style={styles.report}>
            <Text style={styles.reportTitle}>{testing ? 'Testing...' : `Test: ${report!.title}`}</Text>
            {report?.lines.map((l, i) => <Text key={i} style={styles.reportLine}>{l}</Text>)}
            {!testing && <Pressable onPress={() => setReport(null)}><Text style={styles.cancel}>Close</Text></Pressable>}
          </View>
        )}

        {list.length === 0 && !adding && <Text style={styles.muted}>No plugins yet. Tap Add plugin, paste a Nuvio repo manifest.json link and press Fetch.</Text>}

        {list.map((p) => {
          const caps = capabilities(p);
          const err = getPluginError(p.id);
          const does = [caps.stream && 'streams', caps.catalog && 'catalog', caps.links && 'links'].filter(Boolean).join(', ');
          return (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.muted}>{p.categories.join(', ')}  |  priority {p.priority}  |  v{p.version}</Text>
                  <Text style={styles.muted}>{caps.error ? 'code error' : does || 'nothing found in code'}</Text>
                </View>
                <Switch value={p.enabled} onValueChange={(v) => setEnabled(p, v)} trackColor={{ true: colors.amberSolid }} />
              </View>
              {!!(caps.error || err) && <Text style={styles.errSmall}>{caps.error ? 'Code error: ' + caps.error : err}</Text>}
              <View style={styles.cardActions}>
                <Pressable onPress={() => runTest(p.name, { name: p.name, code: p.code, categories: p.categories, timeout_ms: p.timeout_ms })} style={styles.sample}><Text style={styles.sampleText}>Test</Text></Pressable>
                <Pressable onPress={() => startEdit(p)} style={styles.sample}><Text style={styles.sampleText}>Edit</Text></Pressable>
                <Pressable onPress={() => remove(p)} style={styles.del}><Text style={styles.delText}>Delete</Text></Pressable>
              </View>
            </View>
          );
        })}

        {!adding ? (
          <View style={{ marginTop: 20 }}><Button label="Add plugin" onPress={startAdd} /></View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{editing ? `Edit ${editing.name}` : 'New plugin'}</Text>

            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />

            <Text style={styles.muted}>Categories. Each one becomes a page in the app (tap to select)</Text>
            <View style={styles.catRow}>
              {catOptions.map((c) => (
                <Pressable key={c} onPress={() => toggleCat(c)} style={[styles.cat, cats.includes(c) && styles.catOn]}>
                  <Text style={{ color: cats.includes(c) ? colors.onAmber : colors.text, fontWeight: '600' }}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Your own category (e.g. cartoon)" placeholderTextColor={colors.muted} autoCapitalize="none" value={custom} onChangeText={setCustom} onSubmitEditing={addCustomCat} />
              <Pressable onPress={addCustomCat} style={styles.sample}><Text style={styles.sampleText}>Add</Text></Pressable>
            </View>

            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Priority (lower first)" placeholderTextColor={colors.muted} keyboardType="number-pad" value={priority} onChangeText={setPriority} />
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Timeout seconds" placeholderTextColor={colors.muted} keyboardType="number-pad" value={timeoutSec} onChangeText={setTimeoutSec} />
            </View>

            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Code link or Nuvio repo manifest.json link" placeholderTextColor={colors.muted} autoCapitalize="none" value={url} onChangeText={setUrl} />
              <Pressable onPress={fetchCode} style={styles.sample}><Text style={styles.sampleText}>Fetch</Text></Pressable>
            </View>

            <TextInput
              style={[styles.input, { height: 200, textAlignVertical: 'top', paddingTop: 14 }]}
              placeholder="Plugin code" placeholderTextColor={colors.muted} multiline autoCapitalize="none" autoCorrect={false}
              value={code} onChangeText={setCode}
            />

            <Pressable onPress={() => runTest(name || 'New plugin', { name, code, categories: cats, timeout_ms: timeoutMs })} style={[styles.sample, { alignSelf: 'flex-start', marginBottom: 14 }]}>
              <Text style={styles.sampleText}>Test before installing</Text>
            </Pressable>

            <Button label={editing ? 'Save changes' : 'Install plugin'} onPress={save} loading={saving} />
            <Pressable onPress={() => { setAdding(false); setEditing(null); }}><Text style={styles.cancel}>Cancel</Text></Pressable>
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
  errSmall: { color: colors.danger, fontSize: 12, marginTop: 8, lineHeight: 17 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  report: { padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  reportTitle: { color: colors.text, fontWeight: '700', marginBottom: 8 },
  reportLine: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { padding: 14, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  del: { paddingHorizontal: 8, paddingVertical: 6, marginLeft: 'auto' },
  delText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  form: { marginTop: 22, padding: 16, borderRadius: radius.lg, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  formTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  sample: { paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
  sampleText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: { height: 52, borderRadius: radius.md, paddingHorizontal: 16, marginBottom: 12, color: colors.text, fontSize: 15, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: colors.border },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  cat: { paddingHorizontal: 14, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong },
  catOn: { backgroundColor: colors.amberSolid },
  cancel: { color: colors.muted, textAlign: 'center', marginTop: 16 },
});
