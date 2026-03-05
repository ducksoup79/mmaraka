/**
 * Product detail: GET /api/products/:listingId. Buy (PATCH buy) or Message seller. Image from API_BASE + path.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { api, API_BASE } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useAuth } from '../AuthContext';

export default function ProductDetailScreen({ route, navigation }) {
  const { listingId } = route?.params || {};
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!listingId) return;
    api(`/api/products/${listingId}`)
      .then(setItem)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [listingId]);

  const isOwner = user?.client_id != null && item?.client_id != null && user.client_id === item.client_id;

  const buy = async () => {
    Alert.alert('Buy item', 'Buy this item? It will be marked as sold.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Buy',
        style: 'default',
        onPress: async () => {
          try {
            await api(`/api/products/${listingId}/buy`, { method: 'PATCH' });
            const sellerId = item.client_id;
            const sellerUsername = item.seller_username || 'Seller';
            Alert.alert('Success', 'Marked as sold. Opening chat with the seller.');
            navigation.navigate('Chat', { otherId: sellerId, otherUsername: sellerUsername });
          } catch (e) {
            Alert.alert('Failed', e.message || 'Could not buy item');
          }
        },
      },
    ]);
  };

  const del = async () => {
    Alert.alert('Delete listing?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/products/${listingId}`, { method: 'DELETE' });
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
        {item.product_image_path ? (
          <Image
            source={{ uri: `${API_BASE}${item.product_image_path}` }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderEmoji}>📦</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.price}>P{Number(item.product_price).toLocaleString()}</Text>
          <Text style={styles.title}>{item.product_name}</Text>
          <Text style={styles.meta}>{item.category_name} · {String(item.status || 'avail').toUpperCase()}</Text>
          {item.product_description ? (
            <Text style={styles.desc}>{item.product_description}</Text>
          ) : null}

          {!isOwner && item.status === 'avail' ? (
            <>
              <TouchableOpacity style={styles.buyBtn} onPress={buy} activeOpacity={0.85}>
                <Text style={styles.buyBtnText}>Buy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageBtn}
                onPress={() => navigation.navigate('Chat', { otherId: item.client_id, otherUsername: item.seller_username || 'Seller' })}
                activeOpacity={0.85}
              >
                <Text style={styles.messageBtnText}>Message seller</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {!isOwner && item.status === 'sold' ? (
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => navigation.navigate('Chat', { otherId: item.client_id, otherUsername: item.seller_username || 'Seller' })}
              activeOpacity={0.85}
            >
              <Text style={styles.messageBtnText}>Message seller</Text>
            </TouchableOpacity>
          ) : null}

          {isOwner && item.status === 'sold' && item.buyer_id ? (
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() => navigation.navigate('Chat', { otherId: item.buyer_id, otherUsername: item.buyer_username || 'Buyer' })}
              activeOpacity={0.85}
            >
              <Text style={styles.messageBtnText}>Message buyer</Text>
            </TouchableOpacity>
          ) : null}

          {isOwner ? (
            <View style={styles.ownerActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionOutline]}
                onPress={() => navigation.navigate('EditProduct', { listingId })}
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
  image: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface2 },
  imagePlaceholder: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji: { fontSize: 80 },
  body: { padding: 16, backgroundColor: colors.surface },
  price: { fontSize: 24, fontWeight: '700', color: colors.accent },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 8 },
  meta: { fontSize: 14, color: colors.text3, marginTop: 4 },
  desc: { fontSize: 15, color: colors.text2, marginTop: 16, lineHeight: 22 },
  buyBtn: { marginTop: 18, backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  messageBtn: { marginTop: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  messageBtnText: { color: colors.text2, fontSize: 16, fontWeight: '700' },
  ownerActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionText: { fontWeight: '800', fontSize: 14 },
  actionOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionOutlineText: { color: colors.text2 },
  actionDanger: { backgroundColor: colors.dangerLt },
  actionDangerText: { color: colors.danger },
});
