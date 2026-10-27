import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { colors, radius } from '../../theme';
import { openSupport } from '../../lib/support';
import { supabase } from '../../lib/supabase';
import { refreshPlugins } from '../../plugins/loader';
import { clearCatalogCache } from '../../plugins/catalog';
import { capabilities, getPluginError, inspectCode, testPlugin } from '../../plugins/sandbox';
import type { Plugin } from '../../plugins/types';
import { adapt, normalizeUrl } from '../../plugins/adapters';

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
  const [fetching, setFetching] = useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

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
    setAdding(false);
    setMsg('');
    afterChange();
  }

  async function fetchCode() {
    setMsg('');
    if (!url.trim()) return setMsg('Paste a plugin link, Nuvio repo, Stremio addon or M3U playlist link first.');
    setFetching(true);
    try {
      const u = rawUrl(normalizeUrl(url));
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
      // Stremio addon or M3U playlist: converted into a normal plugin, then shown for Test / Save.
      const ad = adapt(text, u);
      if (ad) {
        setEditing(null); setName(ad.name); setCode(ad.code); setCats(ad.categories);
        setCatOptions((cur) => Array.from(new Set([...cur, ...ad.categories])));
        setPriority('100'); setTimeoutSec('30');
        setMsg(ad.format === 'stremio' ? 'Stremio addon found and converted. Press Test, then Install.' : 'Playlist found and converted. Press Test, then Install.');
        setAdding(true);
        return;
      }
      setCode(text);
      setAdding(true);
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not download the code.');
    } finally {
      setFetching(false);
    }
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

  const activeCount = list.filter((p) => p.enabled).length;

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}><Icon name="back" size={22} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Plugins</Text>
          <Text style={styles.topSub}>{list.length} installed  •  {activeCount} active</Text>
        </View>
        <Pressable onPress={() => { startAdd(); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150); }} style={styles.addBtn} hitSlop={6}>
          <Icon name="plus" size={20} color="#000" />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.accent]} progressBackgroundColor={colors.surface2} />}
      >
        {/* quick import */}
        <View style={styles.importCard}>
          <Text style={styles.importTitle}>Import providers</Text>
          <Text style={styles.importSub}>Paste a link and press Fetch. Works with: Nuvio repo (all providers at once), Stremio addon (manifest.json or stremio://), M3U / IPTV playlist, or a single JavaScript plugin.</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="https://.../manifest.json" placeholderTextColor={colors.muted}
              autoCapitalize="none" autoCorrect={false} value={url} onChangeText={setUrl}
            />
            <Button label="Fetch" small onPress={fetchCode} loading={fetching} style={{ height: 50 }} />
          </View>
        </View>

        {!!msg && (
          <View style={styles.msgBox}><Icon name="info" size={18} color={colors.danger} /><Text style={styles.msgText}>{msg}</Text></View>
        )}

        {(testing || report) && (
          <View style={styles.report}>
            <View style={styles.reportHead}>
              <Text style={styles.reportTitle}>{testing ? 'Testing...' : report!.title}</Text>
              {!testing && <Pressable onPress={() => setReport(null)} hitSlop={10}><Icon name="close" size={20} /></Pressable>}
            </View>
            {report?.lines.map((l, i) => (
              <Text key={i} style={[styles.reportLine, /^FAIL|error|Code error/i.test(l) && { color: colors.danger }, /^ok\b/.test(l) && { color: colors.success }]}>{l}</Text>
            ))}
          </View>
        )}

        {list.length === 0 && !adding && (
          <View style={styles.empty}>
            <Icon name="plug" size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>No plugins yet</Text>
            <Text style={styles.emptyText}>Paste a Nuvio repo, Stremio addon, M3U playlist or plugin link above and press Fetch.</Text>
          </View>
        )}

        {list.map((p) => {
          const caps = capabilities(p);
          const err = getPluginError(p.id);
          const bad = !!(caps.error || err);
          const does = [caps.stream && 'streams', caps.catalog && 'catalog', caps.links && 'links'].filter(Boolean).join(' • ');
          return (
            <View key={p.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.dot, { backgroundColor: !p.enabled ? colors.muted : bad ? colors.danger : colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.muted}>v{p.version}  •  priority {p.priority}  •  {caps.error ? 'code error' : does || 'nothing found in code'}</Text>
                </View>
                <Switch value={p.enabled} onValueChange={(v) => setEnabled(p, v)} trackColor={{ true: colors.accent, false: colors.surface3 }} thumbColor="#fff" />
              </View>
              <View style={styles.tagRow}>
                {p.categories.map((c) => <View key={c} style={styles.tag}><Text style={styles.tagText}>{c}</Text></View>)}
              </View>
              {bad && <Text style={styles.errSmall}>{caps.error ? 'Code error: ' + caps.error : err}</Text>}
              <View style={styles.cardActions}>
                <Pressable onPress={() => runTest(p.name, { name: p.name, code: p.code, categories: p.categories, timeout_ms: p.timeout_ms })} style={styles.act}>
                  <Icon name="flask" size={16} /><Text style={styles.actText}>Test</Text>
                </Pressable>
                <Pressable onPress={() => { startEdit(p); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150); }} style={styles.act}>
                  <Icon name="edit" size={16} /><Text style={styles.actText}>Edit</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => remove(p)} style={styles.act}>
                  <Icon name="trash" size={16} color={colors.danger} /><Text style={[styles.actText, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {!adding ? (
          <View style={{ marginTop: 18 }}><Button label="Add plugin manually" icon="plus" variant="secondary" onPress={() => { startAdd(); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150); }} /></View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{editing ? `Edit ${editing.name}` : 'New plugin'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} placeholder="Plugin name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />

            <Text style={styles.label}>Categories (each one becomes a page in the app)</Text>
            <View style={styles.catRow}>
              {catOptions.map((c) => (
                <Pressable key={c} onPress={() => toggleCat(c)} style={[styles.cat, cats.includes(c) && styles.catOn]}>
                  <Text style={{ color: cats.includes(c) ? '#000' : colors.textDim, fontWeight: '700', fontSize: 13 }}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Your own category (e.g. cartoon)" placeholderTextColor={colors.muted} autoCapitalize="none" value={custom} onChangeText={setCustom} onSubmitEditing={addCustomCat} />
              <Button label="Add" small variant="secondary" onPress={addCustomCat} style={{ height: 50 }} />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Priority (lower first)</Text>
                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="100" placeholderTextColor={colors.muted} keyboardType="number-pad" value={priority} onChangeText={setPriority} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Timeout (seconds)</Text>
                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="20" placeholderTextColor={colors.muted} keyboardType="number-pad" value={timeoutSec} onChangeText={setTimeoutSec} />
              </View>
            </View>

            <Text style={styles.label}>Plugin code</Text>
            <TextInput
              style={[styles.input, { height: 220, textAlignVertical: 'top', paddingTop: 14, fontSize: 12 }]}
              placeholder="Paste the plugin code here" placeholderTextColor={colors.muted} multiline autoCapitalize="none" autoCorrect={false}
              value={code} onChangeText={setCode}
            />

            <Button label="Test before installing" icon="flask" variant="secondary" onPress={() => runTest(name || 'New plugin', { name, code, categories: cats, timeout_ms: timeoutMs })} />
            <View style={{ height: 10 }} />
            <Button label={editing ? 'Save changes' : 'Install plugin'} onPress={save} loading={saving} />
            <Pressable onPress={() => { setAdding(false); setEditing(null); }} style={{ paddingVertical: 14 }}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </View>
        )}

        <Pressable onPress={openSupport} style={styles.support}>
          <Icon name="send" size={16} color={colors.muted} />
          <Text style={styles.supportText}>Need help? Contact support</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  topSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  importCard: { padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  importTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  importSub: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 12 },
  msgBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.sm, backgroundColor: 'rgba(255,90,95,0.12)', marginBottom: 14 },
  msgText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  report: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  reportHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  reportTitle: { flex: 1, color: colors.text, fontWeight: '800', fontSize: 15 },
  reportLine: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  card: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 10, height: 24, borderRadius: 6, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  tagText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  errSmall: { color: colors.danger, fontSize: 12, marginTop: 10, lineHeight: 17 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 36 },
  actText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  form: { marginTop: 18, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  formTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 14 },
  input: { height: 50, borderRadius: radius.sm, paddingHorizontal: 14, marginBottom: 14, color: colors.text, fontSize: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  cat: { paddingHorizontal: 14, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface3 },
  catOn: { backgroundColor: '#fff' },
  cancel: { color: colors.muted, textAlign: 'center', fontWeight: '600' },
  support: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28 },
  supportText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
