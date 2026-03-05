/**
 * Services list: GET /api/services, pull-to-refresh, search by name/description. Tap opens ServiceDetail.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, API_BASE } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import AdvertBar from '../components/AdvertBar';

function ServiceCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)} activeOpacity={0.8}>
      {item.service_logo_path ? (
        <Image source={{ uri: `${API_BASE}${item.service_logo_path}` }} style={styles.logoImg} resizeMode="cover" />
      ) : (
        <View style={styles.logoWrap}>
          <Text style={styles.logoPlaceholder}>🏢</Text>
        </View>
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>{item.service_name}</Text>
      <Text style={styles.cardMeta} numberOfLines={2}>{item.service_description || 'Service'}</Text>
    </TouchableOpacity>
  );
}

function normalizeList(list) {
  if (Array.isArray(list)) return list;
  if (list && Array.isArray(list.rows)) return list.rows;
  if (list && Array.isArray(list.services)) return list.services;
  return [];
}

export default function ServicesScreen({ navigation }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const raw = await api('/api/services');
      setServices(normalizeList(raw));
    } catch (e) {
      setError(e.message || 'Failed to load');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = services.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (s.service_name || '').toLowerCase();
    const desc = (s.service_description || '').toLowerCase();
    return name.includes(q) || desc.includes(q);
  });

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Services</Text>
          <Text style={styles.subtitle}>Discover local services</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddService')}
          accessibilityRole="button"
          accessibilityLabel="Add service"
        >
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.search}
        placeholder="Search services…"
        placeholderTextColor={colors.text3}
        value={search}
        onChangeText={setSearch}
      />
      <AdvertBar navigation={navigation} />
      {services.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏢</Text>
          <Text style={styles.emptyTitle}>No services yet</Text>
          <Text style={styles.emptySub}>Tap ＋ to add your service</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No matching services</Text>
          <Text style={styles.emptySub}>Try a different search</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.service_id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ServiceCard item={item} onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.service_id })} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: 12, color: colors.text2 },
  errorText: { color: colors.danger },
  headerRow: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text2, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -1 },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  listContent: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, overflow: 'hidden' },
  logoWrap: { width: '100%', height: 120, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoImg: { width: '100%', height: 120, borderRadius: 8, backgroundColor: colors.surface2 },
  logoPlaceholder: { fontSize: 40 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.text2, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, color: colors.text2 },
  emptySub: { fontSize: 14, color: colors.text3, marginTop: 8 },
});
