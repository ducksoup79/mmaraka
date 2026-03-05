/**
 * Settings: show profile summary, link to Subscription, Unsubscribe (if active PayPal sub), sign out (onLogout from AuthContext).
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';

export default function SettingsScreen({ onLogout }) {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const [mySubscription, setMySubscription] = useState(null);
  const [unsubscribeLoading, setUnsubscribeLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api('/api/payment/my-subscription')
        .then(setMySubscription)
        .catch(() => setMySubscription({ active: false }));
    }, [])
  );

  const handleUnsubscribe = () => {
    Alert.alert(
      'Unsubscribe',
      'Cancel your PayPal subscription? You will be moved to the Basic plan and will not be charged again.',
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Unsubscribe',
          style: 'destructive',
          onPress: async () => {
            setUnsubscribeLoading(true);
            try {
              await api('/api/payment/cancel-subscription', { method: 'POST' });
              setMySubscription({ active: false });
              updateUser({});
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to cancel subscription');
            } finally {
              setUnsubscribeLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Profile and preferences</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{(user?.name || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.location_name ? (
            <Text style={styles.userLocation}>{user.location_name}</Text>
          ) : null}
          <View style={styles.planChip}>
            <Text style={styles.planText}>{user?.client_role || 'Basic'} Plan</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.7}
        >
          <Text style={styles.menuRowText}>Subscription / Upgrade plan</Text>
          <Text style={styles.menuRowChevron}>›</Text>
        </TouchableOpacity>
        {mySubscription?.active && (
          <TouchableOpacity
            style={[styles.menuRow, styles.unsubscribeRow]}
            onPress={handleUnsubscribe}
            disabled={unsubscribeLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.unsubscribeRowText}>
              {unsubscribeLoading ? 'Cancelling…' : 'Unsubscribe from PayPal'}
            </Text>
            {unsubscribeLoading ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={styles.menuRowChevron}>›</Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text2, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  userName: { fontSize: 18, fontWeight: '600', color: colors.text },
  userEmail: { fontSize: 14, color: colors.text2, marginTop: 4 },
  userLocation: { fontSize: 13, color: colors.text3, marginTop: 2 },
  planChip: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.accentLt, borderRadius: 20 },
  planText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuRowText: { fontSize: 16, color: colors.text, fontWeight: '500' },
  menuRowChevron: { fontSize: 20, color: colors.text3 },
  unsubscribeRow: { borderColor: colors.dangerLt },
  unsubscribeRowText: { fontSize: 16, color: colors.danger, fontWeight: '500' },
  logoutBtn: { paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  logoutText: { color: colors.text2, fontSize: 16 },
});
