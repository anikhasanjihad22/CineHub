import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark } from '../components/Logo';
import { Focusable } from '../components/Focusable';
import { AppConfig, ApkProgress, apkPath, downloadApk, installApk } from '../lib/update';
import { formatSize } from '../lib/downloads';
import { openSupport } from '../lib/support';
import { APP_VERSION, colors, radius } from '../theme';

// Full-screen update page.
//   required: nothing else in the app can be used until the new version is installed.
//   optional: same page, but with a "Later" button.
export function UpdateGate({ cfg, required, onLater }: { cfg: AppConfig; required: boolean; onLater: () => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<ApkProgress | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const pct = prog && prog.total > 0 ? Math.min(100, Math.round((prog.done / prog.total) * 100)) : 0;

  async function start() {
    setErr('');
    try {
      if (file) { await installApk(file); return; }
      setBusy(true);
      const path = await downloadApk(cfg, setProg);
      setFile(path);
      setBusy(false);
      await installApk(path);
    } catch (e: any) {
      setBusy(false);
      if (e?.message === 'opened-in-browser') return;
      setErr(e?.message ?? 'Could not download the update. Check your internet and try again.');
    }
  }

  const label = file ? 'Install update' : busy ? `Downloading ${pct}%` : 'Update now';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#2A0408', '#000000']} style={StyleSheet.absoluteFill} />
      <View style={[styles.body, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        <View style={styles.logoWrap}><LogoMark size={64} /></View>
        <Text style={styles.title}>{required ? 'Update required' : 'Update available'}</Text>
        <Text style={styles.sub}>
          {required
            ? 'A new version of CineHub is ready. Please update to keep watching.'
            : 'A new version of CineHub is ready with the latest improvements.'}
        </Text>

        <View style={styles.ver}>
          <Text style={styles.verOld}>v{APP_VERSION}</Text>
          <Text style={styles.arrow}>→</Text>
          <Text style={styles.verNew}>v{cfg.latest_version}</Text>
        </View>

        {!!cfg.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesHead}>What's new</Text>
            <Text style={styles.notesText}>{cfg.notes}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {busy && (
          <View style={{ marginBottom: 16 }}>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(3, pct)}%` }]} /></View>
            <Text style={styles.stat}>
              {formatSize(prog?.done ?? 0)}{prog && prog.total > 0 ? ` of ${formatSize(prog.total)}` : ''}
              {prog && prog.speed > 0 ? `  ·  ${formatSize(prog.speed)}/s` : ''}
            </Text>
          </View>
        )}
        {!!err && <Text style={styles.err}>{err}</Text>}

        <Focusable onPress={start} disabled={busy} style={[styles.btn, busy && { opacity: 0.7 }]} ring={radius.md}>
          <Text style={styles.btnText}>{label}</Text>
        </Focusable>

        {!required && (
          <Pressable onPress={onLater} style={styles.later}><Text style={styles.laterText}>Later</Text></Pressable>
        )}
        {required && (
          <Pressable onPress={openSupport} style={styles.later}><Text style={styles.laterText}>Need help? Contact support</Text></Pressable>
        )}
        {file && <Text style={styles.hint}>If Android asks, allow CineHub to install apps, then tap Install update again.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 999, elevation: 999 },
  body: { flex: 1, paddingHorizontal: 28, alignItems: 'center', width: '100%', maxWidth: 560, alignSelf: 'center' },
  logoWrap: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 28 },
  sub: { color: colors.textDim, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  ver: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, paddingHorizontal: 18, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  verOld: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  arrow: { color: colors.muted, fontSize: 15 },
  verNew: { color: '#fff', fontSize: 15, fontWeight: '800' },
  notes: { alignSelf: 'stretch', marginTop: 24, padding: 16, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)' },
  notesHead: { color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 6 },
  notesText: { color: colors.textDim, fontSize: 14, lineHeight: 21 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  stat: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  err: { color: colors.danger, textAlign: 'center', marginBottom: 12, lineHeight: 19 },
  btn: { alignSelf: 'stretch', height: 56, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  later: { alignItems: 'center', paddingVertical: 16 },
  laterText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
