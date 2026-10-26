import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';
import { openSupport } from '../lib/support';
import { colors, radius } from '../theme';

export default function Login({ route, navigation }: any) {
  const [mode, setMode] = useState<'signin' | 'signup'>(route?.params?.mode ?? 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [verify, setVerify] = useState(false); // step 2: type the code from the email
  const [code, setCode] = useState('');

  const isSignup = mode === 'signup';

  async function submit() {
    setError('');
    setInfo('');
    const e = email.trim();
    if (!e.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password needs at least 6 characters.');

    setLoading(true);
    try {
      if (isSignup) {
        const { data, error: err } = await supabase.auth.signUp({ email: e, password });
        if (err) throw err;
        // Supabase answers "success" with no identities when this email already has an account.
        if (data.user && (data.user.identities?.length ?? 1) === 0) {
          setMode('signin');
          return setError('This email is already registered. Please sign in.');
        }
        // If email confirmation is on, there is no session yet: ask for the code.
        if (!data.session) {
          setVerify(true);
          setInfo(`We sent a confirmation email to ${e}. Enter the code from it below.`);
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: e, password });
        if (err) {
          if (/not confirmed/i.test(err.message)) {
            await supabase.auth.resend({ type: 'signup', email: e }).catch(() => {});
            setVerify(true);
            setInfo(`Your email is not confirmed yet. We sent a new code to ${e}.`);
            return;
          }
          throw err;
        }
      }
      // On success the app switches to Home automatically.
    } catch (err: any) {
      setError(nice(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode() {
    setError('');
    const t = code.replace(/\s/g, '');
    if (t.length < 6) return setError('Enter the code from your email.');
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: t, type: 'signup' });
      if (err) throw err;
      if (!data.session) {
        // confirmed, but no automatic login: sign in with the password
        const r = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (r.error) throw r.error;
      }
    } catch (err: any) {
      setError(nice(err));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (err) throw err;
      setInfo('A new code was sent. Check your inbox and spam folder.');
    } catch (err: any) {
      setError(nice(err));
    } finally {
      setLoading(false);
    }
  }

  function nice(err: any): string {
    const m: string = err?.message ?? '';
    if (/rate limit|too many|seconds/i.test(m)) return 'Too many emails were requested. Please wait a few minutes and try again.';
    if (/invalid login/i.test(m)) return 'Wrong email or password.';
    if (/expired|invalid/i.test(m) && verify) return 'That code is wrong or expired. Tap "Send a new code".';
    if (/already registered/i.test(m)) return 'This email is already registered. Please sign in.';
    if (/network|fetch/i.test(m)) return 'No internet connection. Please check your network.';
    return m || 'Something went wrong. Try again.';
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}><Icon name="back" size={22} /></Pressable>
          <Logo size={22} />
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>{verify ? 'Confirm your email' : isSignup ? 'Create account' : 'Welcome back'}</Text>
          <Text style={styles.sub}>
            {verify ? 'Open the email we sent you and type the code here.' : isSignup ? 'Sign up with your email to start watching.' : 'Sign in to continue watching.'}
          </Text>

          {!verify && <Field
            label="Email" icon="mail" placeholder="you@example.com" autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" value={email} onChangeText={setEmail}
          />}
          {!verify && <Field
            label="Password" icon="lock" placeholder="At least 6 characters" secure autoCapitalize="none"
            value={password} onChangeText={setPassword} onSubmitEditing={submit}
          />}
          {verify && <Field
            label="Code" icon="check" placeholder="Code from the email" autoCapitalize="none" autoCorrect={false}
            keyboardType="number-pad" value={code} onChangeText={setCode} onSubmitEditing={confirmCode}
          />}

          {!!error && (
            <View style={[styles.banner, styles.bannerErr]}>
              <Icon name="info" size={18} color={colors.danger} />
              <Text style={[styles.bannerText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}
          {!!info && (
            <View style={[styles.banner, styles.bannerOk]}>
              <Icon name="check" size={18} color={colors.success} />
              <Text style={[styles.bannerText, { color: colors.success }]}>{info}</Text>
            </View>
          )}

          <View style={{ height: 10 }} />
          {verify ? (
            <>
              <Button label="Confirm" onPress={confirmCode} loading={loading} />
              <Pressable onPress={resend} style={{ marginTop: 18 }} hitSlop={8}>
                <Text style={styles.switch}><Text style={styles.switchStrong}>Send a new code</Text></Text>
              </Pressable>
              <Pressable onPress={() => { setVerify(false); setCode(''); setError(''); setInfo(''); }} style={{ marginTop: 14 }} hitSlop={8}>
                <Text style={styles.switch}>Use a different email</Text>
              </Pressable>
            </>
          ) : (
          <Button label={isSignup ? 'Create account' : 'Sign in'} onPress={submit} loading={loading} />
          )}

          {!verify && <Pressable onPress={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); setInfo(''); }} style={{ marginTop: 22 }}>
            <Text style={styles.switch}>
              {isSignup ? 'Already have an account? ' : 'New to CineHub? '}
              <Text style={styles.switchStrong}>{isSignup ? 'Sign in' : 'Create an account'}</Text>
            </Text>
          </Pressable>}

          <Pressable onPress={openSupport} style={styles.help} hitSlop={8}>
            <Icon name="send" size={15} color={colors.muted} />
            <Text style={styles.helpText}>Need help? Contact support</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 30, width: '100%', maxWidth: 520, alignSelf: 'center' },
  heading: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.7 },
  sub: { color: colors.muted, fontSize: 15, marginTop: 8, marginBottom: 28, lineHeight: 22 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.sm, marginTop: 2 },
  bannerErr: { backgroundColor: 'rgba(255,90,95,0.12)' },
  bannerOk: { backgroundColor: 'rgba(61,220,132,0.12)' },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19 },
  switch: { color: colors.muted, textAlign: 'center', fontSize: 14 },
  switchStrong: { color: colors.text, fontWeight: '800' },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 34 },
  helpText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
