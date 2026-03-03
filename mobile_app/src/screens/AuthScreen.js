import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { api } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    whatsapp: '',
    location_id: null,
    terms: false,
    countryCode: '+267',
  });
  const [locations, setLocations] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const keyboardHeight = useKeyboardHeight();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (mode === 'login') {
      setForm((f) => ({ ...f, email: '', password: '' }));
      setErrors({});
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'signup') return;
    api('/api/misc/locations')
      .then(setLocations)
      .catch(() => setLocations([]));
  }, [mode]);

  const handleLogin = async () => {
    if (!form.email?.trim() || !form.password) {
      setErrors({ login: 'Please enter your email and password.' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      onLogin(data.user, data.access_token);
    } catch (err) {
      setErrors({ login: err.message || 'Invalid credentials' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const e = {};
    if (!form.username?.trim()) e.username = 'Username is required';
    if (!form.email?.includes('@')) e.email = 'Enter a valid email';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.password2) e.password2 = 'Passwords do not match';
    if (!form.terms) e.terms = 'You must accept the terms and conditions';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    setErrors({});
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          whatsapp: (form.whatsapp || '').replace(/\D/g, '') || undefined,
          country_code: (form.whatsapp || '').trim().length ? form.countryCode : undefined,
          location_id: form.location_id || undefined,
        }),
      });
      setErrors({});
      setMode('login');
      Alert.alert('Success', 'Account created. Please sign in.');
    } catch (err) {
      setErrors({ signup: err.message || 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = () => {
    Alert.alert('Reset link sent', 'If the email exists, a reset link was sent. Check your email.');
    setMode('login');
  };

  return (
    <Screen style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 48 + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          {/* Brand header */}
          <View style={styles.brand}>
          <Text style={styles.brandEmoji}>🛒</Text>
          <Text style={styles.brandName}>Mmaraka</Text>
          <Text style={styles.brandTagline}>
            Your local second-hand marketplace.{'\n'}Buy, sell, and discover services near you.
          </Text>
          </View>

          <View style={styles.formCard}>
          {mode === 'login' && (
            <>
              {/* <Text style={styles.title}>Welcome back</Text> */}
              <Text style={styles.subtitle}>Sign in to your Mmaraka account</Text>
              {errors.login ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errors.login}</Text>
                </View>
              ) : null}
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.text3}
                value={form.email}
                onChangeText={(v) => set('email', v)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.text3}
                value={form.password}
                onChangeText={(v) => set('password', v)}
                secureTextEntry
              />
              <TouchableOpacity onPress={() => setMode('forgot')} style={styles.forgotLink}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.btnPrimaryText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.switchLink}
                onPress={() => {
                  setErrors({});
                  setMode('signup');
                }}
              >
                <Text style={styles.switchText}>Don't have an account? </Text>
                <Text style={styles.switchLinkText}>Sign up</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'signup' && (
            <>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Join the local marketplace today</Text>
              {errors.signup ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errors.signup}</Text>
                </View>
              ) : null}
              <Text style={styles.label}>Username *</Text>
              <TextInput
                style={styles.input}
                placeholder="Choose a username"
                placeholderTextColor={colors.text3}
                value={form.username}
                onChangeText={(v) => set('username', v)}
                autoCapitalize="none"
              />
              {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : null}
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.text3}
                value={form.email}
                onChangeText={(v) => set('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.text3}
                value={form.password}
                onChangeText={(v) => set('password', v)}
                secureTextEntry
              />
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.text3}
                value={form.password2}
                onChangeText={(v) => set('password2', v)}
                secureTextEntry
              />
              {errors.password2 ? <Text style={styles.fieldError}>{errors.password2}</Text> : null}
              <Text style={styles.label}>Location</Text>
              <View style={styles.pickerRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.chip, !form.location_id && styles.chipActive]}
                    onPress={() => set('location_id', null)}
                  >
                    <Text style={[styles.chipText, !form.location_id && styles.chipTextActive]}>Any</Text>
                  </TouchableOpacity>
                  {locations.map((l) => (
                    <TouchableOpacity
                      key={l.location_id}
                      style={[styles.chip, form.location_id === l.location_id && styles.chipActive]}
                      onPress={() => set('location_id', l.location_id)}
                    >
                      <Text style={[styles.chipText, form.location_id === l.location_id && styles.chipTextActive]}>
                        {l.location_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => set('terms', !form.terms)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, form.terms && styles.checkboxChecked]}>
                  {form.terms ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.checkLabel}>
                  I agree to the{' '}
                  <Text style={styles.linkText} onPress={() => setMode('terms')}>
                    Terms & Conditions
                  </Text>
                </Text>
              </TouchableOpacity>
              {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleSignup}
                disabled={loading}
              >
                <Text style={styles.btnPrimaryText}>{loading ? 'Creating…' : 'Create Account'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.switchLink}
                onPress={() => {
                  setErrors({});
                  setMode('login');
                }}
              >
                <Text style={styles.switchText}>Already have an account? </Text>
                <Text style={styles.switchLinkText}>Sign in</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <Text style={styles.title}>Reset password</Text>
              <Text style={styles.subtitle}>We'll send a reset link to your email</Text>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.btnPrimary} onPress={handleForgot}>
                <Text style={styles.btnPrimaryText}>Send Reset Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.switchLink} onPress={() => setMode('login')}>
                <Text style={styles.switchLinkText}>← Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'terms' && (
            <>
              <Text style={[styles.title, { fontSize: 20 }]}>Terms & Conditions</Text>
              <ScrollView style={styles.termsBody} nestedScrollEnabled>
                <Text style={styles.termsP}>
                  <Text style={styles.termsBold}>1. Acceptance</Text> — By signing up you agree to these terms.
                </Text>
                <Text style={styles.termsP}>
                  <Text style={styles.termsBold}>2. Mmaraka Role</Text> — We facilitate listings only; we do not
                  process payments or guarantee transactions.
                </Text>
                <Text style={styles.termsP}>
                  <Text style={styles.termsBold}>3. Listings</Text> — Active for 3 days, reinstatable up to 2 times.
                </Text>
                <Text style={styles.termsP}>
                  <Text style={styles.termsBold}>4. Prohibited Items</Text> — No illegal, stolen, or counterfeit
                  goods.
                </Text>
                <Text style={styles.termsP}>
                  <Text style={styles.termsBold}>5. Privacy</Text> — Your data is used only to operate the platform.
                </Text>
                <Text style={styles.termsP}>
                  <Text style={styles.termsBold}>6. Liability</Text> — Mmaraka bears no liability for transactions or
                  disputes.
                </Text>
              </ScrollView>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setMode('signup')}>
                <Text style={styles.btnOutlineText}>← Back to Sign Up</Text>
              </TouchableOpacity>
            </>
          )}
          </View>
        </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.accent },
  scrollContent: { padding: 24, paddingBottom: 48 },
  brand: { alignItems: 'center', marginBottom: 32 },
  brandEmoji: { fontSize: 56, marginBottom: 12 },
  brandName: { fontSize: 32, fontWeight: '700', color: '#fff' },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  formCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 24, ...Platform.select({ android: { elevation: 2 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 } }) },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.text2, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', color: colors.text2, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, marginBottom: 16 },
  errorBox: { backgroundColor: colors.dangerLt, padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: colors.danger, fontSize: 14 },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: -8, marginBottom: 8 },
  forgotLink: { marginTop: -8, marginBottom: 16 },
  forgotText: { color: colors.accent, fontSize: 13 },
  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutline: { borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  btnOutlineText: { color: colors.text2, fontSize: 15 },
  switchLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' },
  switchText: { color: colors.text2, fontSize: 14 },
  switchLinkText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pickerRow: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface2, marginRight: 8 },
  chipActive: { backgroundColor: colors.accentLt },
  chipText: { fontSize: 14, color: colors.text2 },
  chipTextActive: { color: colors.accent, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.border, borderRadius: 4, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 13, color: colors.text2 },
  linkText: { color: colors.accent, fontWeight: '600' },
  termsBody: { maxHeight: 280, marginVertical: 12 },
  termsP: { fontSize: 13, color: colors.text2, lineHeight: 22, marginBottom: 10 },
  termsBold: { fontWeight: '600', color: colors.text },
});
