import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

export default function Login({ route, navigation }: any) {
  const [mode, setMode] = useState<'signin' | 'signup'>(route?.params?.mode ?? 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

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
        // If email confirmation is on, there is no session yet.
        if (!data.session) setInfo('Account created. Check your email to confirm, then sign in.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: e, password });
        if (err) throw err;
      }
      // On success the app switches to Home automatically.
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.center}>
          <Logo size={46} />
          <Text style={styles.heading}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.sub}>
            {isSignup ? 'Sign up with your email. It is free.' : 'Sign in to keep watching.'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!info && <Text style={styles.info}>{info}</Text>}

          <View style={{ height: 8 }} />
          <Button label={isSignup ? 'Create account' : 'Sign in'} onPress={submit} loading={loading} />

          <Pressable onPress={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); setInfo(''); }}>
            <Text style={styles.switch}>
              {isSignup ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { padding: 18 },
  backText: { color: colors.muted, fontSize: 15 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 60 },
  heading: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 28 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 22 },
  input: {
    height: 54,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    marginBottom: 12,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 2 },
  info: { color: colors.amberSolid, fontSize: 13, marginTop: 2 },
  switch: { color: colors.muted, textAlign: 'center', marginTop: 18, fontSize: 14 },
});
