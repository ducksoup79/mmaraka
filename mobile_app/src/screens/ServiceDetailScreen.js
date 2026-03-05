/**
 * Service detail: GET /api/services/:serviceId. Message owner. Logo from API_BASE + path.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { api, API_BASE } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useAuth } from '../AuthContext';

export default function ServiceDetailScreen({ route, navigation }) {
  const { serviceId } = route?.params || {};
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!serviceId) return;
    api(`/api/services/${serviceId}`)
      .then(setItem)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [serviceId]);

  const isOwner = user?.client_id != null && item?.client_id != null && user.client_id === item.client_id;

  const del = () => {
    Alert.alert('Delete service?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/services/${serviceId}`, { method: 'DELETE' });
            navigation.goBack();
          } catch (e) {
            Alert.alert('Failed', e.message || 'Could not delete');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }
  if (error || !item) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Not found'}</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {item.service_logo_path ? (
          <Image
            source={{ uri: `${API_BASE}${item.service_logo_path}` }}
            style={styles.logo}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoEmoji}>🏢</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title}>{item.service_name}</Text>
          {item.service_description ? (
            <Text style={styles.desc}>{item.service_description}</Text>
          ) : null}

          {isOwner ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionOutline]}
                onPress={() => navigation.navigate('EditService', { serviceId: item.service_id })}
                activeOpacity={0.85}
              >
                <Text style={[styles.actionText, styles.actionOutlineText]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={del} activeOpacity={0.85}>
                <Text style={[styles.actionText, styles.actionDangerText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.danger },
  logo: { width: '100%', height: 200, backgroundColor: colors.surface2 },
  logoPlaceholder: { width: '100%', height: 200, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 64 },
  body: { padding: 16, backgroundColor: colors.surface },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  desc: { fontSize: 15, color: colors.text2, marginTop: 12, lineHeight: 22 },
  ownerActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionText: { fontWeight: '800', fontSize: 14 },
  actionOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionOutlineText: { color: colors.text2 },
  actionDanger: { backgroundColor: colors.dangerLt },
  actionDangerText: { color: colors.danger },
});
