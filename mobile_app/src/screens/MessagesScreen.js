/**
 * Conversations list: GET /api/messages/conversations. Tap opens ChatScreen with otherId.
 * Long-press to delete conversation (DELETE /api/messages/conversations/:withId).
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';

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
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await api('/api/messages/conversations');
      setConversations(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setConversations([]);
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

  const openChat = (conv) => {
    navigation.navigate('Chat', { otherId: conv.other_id, otherUsername: conv.other_username });
  };

  const deleteConversation = (item) => {
    Alert.alert(
      'Delete conversation',
      `Remove this chat with @${item.other_username}? All messages will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.other_id);
            try {
              await api(`/api/messages/conversations/${item.other_id}`, { method: 'DELETE' });
              setConversations((prev) => prev.filter((c) => c.other_id !== item.other_id));
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not delete conversation');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

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
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Chat with buyers and sellers</Text>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySub}>When you message someone or they message you, chats will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.other_id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, deletingId === item.other_id && styles.rowDeleting]}
              onPress={() => openChat(item)}
              onLongPress={() => deleteConversation(item)}
              activeOpacity={0.85}
              disabled={deletingId !== null}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.other_username || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>@{item.other_username}</Text>
                  <Text style={styles.rowTime}>{formatRelative(item.last_at)}</Text>
                </View>
                <Text style={styles.rowPreview} numberOfLines={2}>
                  {item.i_sent_last ? 'You: ' : ''}{item.last_body || 'No messages yet'}
                </Text>
                {item.unread_count > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread_count}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: colors.text2 },
  header: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.text2, marginTop: 2 },
  errorBox: { margin: 16, padding: 16, backgroundColor: colors.dangerLt, borderRadius: 10 },
  errorText: { color: colors.danger },
  retryBtn: { marginTop: 10 },
  retryText: { color: colors.accent, fontWeight: '700' },
  listContent: { paddingBottom: 24 },
  row: { flexDirection: 'row', padding: 16, backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  rowDeleting: { opacity: 0.6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowBody: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowTime: { fontSize: 12, color: colors.text3 },
  rowPreview: { fontSize: 14, color: colors.text2, marginTop: 4 },
  unreadBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 14, color: colors.text3, marginTop: 8, textAlign: 'center' },
});
