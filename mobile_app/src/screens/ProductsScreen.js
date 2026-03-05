/**
 * Products list: GET /api/products, pull-to-refresh, search + category filter. Tap opens ProductDetail.
 * Uses API_BASE for product images. AdvertBar at top.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, API_BASE } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import AdvertBar from '../components/AdvertBar';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

function formatRelative(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function ProductCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)} activeOpacity={0.8}>
      <View style={styles.cardImageWrap}>
        {item.product_image_path ? (
          <Image
            source={{ uri: `${API_BASE}${item.product_image_path}` }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardEmoji}>📦</Text>
          </View>
        )}
        <View style={styles.cardPriceTag}>
          <Text style={styles.cardPrice}>P{Number(item.product_price).toLocaleString()}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.product_name}</Text>
      <Text style={styles.cardMeta}>{item.category_name} · {formatRelative(item.listing_date)}</Text>
      {item.seller_username ? (
        <Text style={styles.cardSeller} numberOfLines={1}>by @{item.seller_username}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const keyboardHeight = useKeyboardHeight();

  const load = useCallback(async () => {
    try {
      setError(null);
      const [rows, catRows] = await Promise.all([
        api('/api/products'),
        api('/api/misc/categories').catch(() => []),
      ]);
      setProducts(Array.isArray(rows) ? rows : []);
      setCategories(Array.isArray(catRows) ? catRows : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
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

  const filtered = products.filter(
    (p) =>
      (categoryId == null || p.category_id === categoryId) &&
      (!search.trim() || (p.product_name || '').toLowerCase().includes(search.toLowerCase()))
  );

  const categoryLabel = categoryId == null
    ? 'All categories'
    : (categories.find((c) => c.category_id === categoryId)?.category_name || 'All categories');

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mmaraka</Text>
          <Text style={styles.subtitle}>Browse second-hand items near you</Text>
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
      <TextInput
        style={styles.search}
        placeholder="Search listings…"
        placeholderTextColor={colors.text3}
        value={search}
        onChangeText={setSearch}
      />
      <TouchableOpacity
        style={styles.categoryRow}
        onPress={() => setCategoryModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.categoryLabel}>Category</Text>
        <Text style={styles.categoryValue}>{categoryLabel}</Text>
        <Text style={styles.categoryChevron}>▼</Text>
      </TouchableOpacity>
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by category</Text>
            <TouchableOpacity
              style={[styles.modalOption, categoryId === null && styles.modalOptionActive]}
              onPress={() => { setCategoryId(null); setCategoryModalVisible(false); }}
            >
              <Text style={styles.modalOptionText}>All categories</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.category_id}
                style={[styles.modalOption, categoryId === c.category_id && styles.modalOptionActive]}
                onPress={() => { setCategoryId(c.category_id); setCategoryModalVisible(false); }}
              >
                <Text style={styles.modalOptionText}>{c.category_name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setCategoryModalVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <AdvertBar navigation={navigation} />
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No listings found</Text>
          <Text style={styles.emptySub}>Try a different category or search</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.listing_id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContent, keyboardHeight > 0 && { paddingBottom: 24 + keyboardHeight }]}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ProductCard
              item={item}
              onPress={(p) => navigation.navigate('ProductDetail', { listingId: p.listing_id })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: 12, color: colors.text2 },
  headerRow: { padding: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text2, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: -1 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryLabel: { fontSize: 13, color: colors.text2, marginRight: 8 },
  categoryValue: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  categoryChevron: { fontSize: 10, color: colors.text3 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  modalOption: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  modalOptionActive: { backgroundColor: colors.accentLt },
  modalOptionText: { fontSize: 15, color: colors.text },
  modalCancel: { marginTop: 12, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  modalCancelText: { fontSize: 15, color: colors.text2, fontWeight: '500' },
  listContent: { padding: 8, paddingBottom: 24 },
  row: { paddingHorizontal: 8, marginBottom: 12, gap: 12 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden', maxWidth: '48%' },
  cardImageWrap: { aspectRatio: 1, backgroundColor: colors.surface2 },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 40 },
  cardPriceTag: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardPrice: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cardTitle: { padding: 10, fontSize: 14, fontWeight: '600', color: colors.text },
  cardMeta: { paddingHorizontal: 10, fontSize: 12, color: colors.text3 },
  cardSeller: { paddingHorizontal: 10, paddingBottom: 10, fontSize: 11, color: colors.text2 },
  errorBox: { margin: 16, padding: 16, backgroundColor: colors.dangerLt, borderRadius: 8 },
  errorText: { color: colors.danger },
  retryBtn: { marginTop: 8 },
  retryText: { color: colors.accent, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 14, color: colors.text3, marginTop: 4 },
});
