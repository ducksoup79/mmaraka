import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import Screen from '../components/Screen';

function StatusPill({ status }) {
  const s = String(status || '').toLowerCase();
  const style =
    s === 'sold' ? { bg: colors.dangerLt, fg: colors.danger, label: 'Sold' } :
    s === 'dormant' ? { bg: colors.surface2, fg: colors.text2, label: 'Dormant' } :
    { bg: colors.accentLt, fg: colors.accent, label: 'Available' };
  return (
    <View style={[styles.pill, { backgroundColor: style.bg }]}>
      <Text style={[styles.pillText, { color: style.fg }]}>{style.label}</Text>
    </View>
  );
}

function ListingRow({ item, onPress, onEdit, onDelete }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress?.(item)} activeOpacity={0.85}>
      <View style={styles.thumbWrap}>
        {item.product_image_path ? (
          <Image source={{ uri: `${API_BASE}${item.product_image_path}` }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbEmoji}>📦</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.product_name}</Text>
          <StatusPill status={item.status} />
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.category_name} · P{Number(item.product_price).toLocaleString()}
        </Text>
        {item.status === 'sold' && item.buyer_username ? (
          <Text style={styles.rowMeta} numberOfLines={1}>Buyer: @{item.buyer_username}</Text>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={() => onEdit?.(item)} activeOpacity={0.85}>
            <Text style={[styles.actionText, styles.actionOutlineText]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={() => onDelete?.(item)} activeOpacity={0.85}>
            <Text style={[styles.actionText, styles.actionDangerText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ServiceListingRow({ item, onPress, onEdit, onDelete }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress?.(item)} activeOpacity={0.85}>
      <View style={styles.thumbWrap}>
        {item.service_logo_path ? (
          <Image source={{ uri: `${API_BASE}${item.service_logo_path}` }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbEmoji}>🏢</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.service_name}</Text>
          <View style={[styles.pill, { backgroundColor: colors.accentLt }]}>
            <Text style={[styles.pillText, { color: colors.accent }]}>Service</Text>
          </View>
        </View>
        <Text style={styles.rowMeta} numberOfLines={2}>{item.service_description || 'No description'}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={() => onEdit?.(item)} activeOpacity={0.85}>
            <Text style={[styles.actionText, styles.actionOutlineText]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={() => onDelete?.(item)} activeOpacity={0.85}>
            <Text style={[styles.actionText, styles.actionDangerText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MyListingsScreen({ navigation }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [myService, setMyService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [productsRes, serviceRes] = await Promise.all([
        api('/api/products/mine').then((r) => (Array.isArray(r) ? r : [])),
        api('/api/services/mine').then((s) => (s && typeof s === 'object' && s.service_id ? s : null)).catch(() => null),
      ]);
      const myId = user?.client_id;
      const myProducts = myId != null
        ? productsRes.filter((p) => p.client_id === myId)
        : [];
      const myServiceOnly = serviceRes && myId != null && serviceRes.client_id === myId ? serviceRes : null;
      setRows(myProducts);
      setMyService(myServiceOnly);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setRows([]);
      setMyService(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.client_id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.client_id != null) load();
      else {
        setLoading(false);
        setRows([]);
        setMyService(null);
      }
    }, [load, user?.client_id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onDelete = (item) => {
    Alert.alert(
      'Delete listing?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/products/${item.listing_id}`, { method: 'DELETE' });
              setRows((prev) => prev.filter((r) => r.listing_id !== item.listing_id));
            } catch (e) {
              Alert.alert('Failed', e.message || 'Could not delete');
            }
          },
        },
      ]
    );
  };

  const onDeleteService = (item) => {
    Alert.alert(
      'Delete service?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/services/${item.service_id}`, { method: 'DELETE' });
              setMyService(null);
            } catch (e) {
              Alert.alert('Failed', e.message || 'Could not delete');
            }
          },
        },
      ]
    );
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Listings</Text>
          <Text style={styles.subtitle}>Your service and product listings</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddProduct')}
          accessibilityRole="button"
          accessibilityLabel="Add listing"
        >
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.listing_id)}
          ListHeaderComponent={
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My service</Text>
              </View>
              {myService ? (
                <ServiceListingRow
                  item={myService}
                  onPress={(x) => navigation.navigate('ServiceDetail', { serviceId: x.service_id })}
                  onEdit={(x) => navigation.navigate('EditService', { serviceId: x.service_id })}
                  onDelete={onDeleteService}
                />
              ) : (
                <View style={styles.emptyService}>
                  <Text style={styles.emptyServiceText}>You haven't added a service</Text>
                  <TouchableOpacity
                    style={styles.addServiceBtn}
                    onPress={() => navigation.navigate('AddService')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addServiceBtnText}>Add service</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>Product listings</Text>
              </View>
            </>
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ListingRow
              item={item}
              onPress={(x) => navigation.navigate('ProductDetail', { listingId: x.listing_id })}
              onEdit={(x) => navigation.navigate('EditProduct', { listingId: x.listing_id })}
              onDelete={onDelete}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
          ListEmptyComponent={rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No product listings yet</Text>
              <Text style={styles.emptySub}>Tap ＋ to add your first listing.</Text>
            </View>
          ) : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerRow: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text2, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: colors.text2 },
  errorBox: { margin: 16, padding: 16, backgroundColor: colors.dangerLt, borderRadius: 10 },
  errorText: { color: colors.danger },
  retryBtn: { marginTop: 10 },
  retryText: { color: colors.accent, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 14, color: colors.text3, marginTop: 8, textAlign: 'center' },
  listContent: { padding: 16, paddingTop: 6, paddingBottom: 24 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text2 },
  emptyService: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' },
  emptyServiceText: { fontSize: 14, color: colors.text3 },
  addServiceBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.accent, borderRadius: 10 },
  addServiceBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12 },
  thumbWrap: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface2 },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 26 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.text3, marginTop: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  actionText: { fontWeight: '800', fontSize: 13 },
  actionOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionOutlineText: { color: colors.text2 },
  actionDanger: { backgroundColor: colors.dangerLt },
  actionDangerText: { color: colors.danger },
});
