import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import Screen from '../components/Screen';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ route, navigation }) {
  const { otherId, otherUsername } = route?.params || {};
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const load = useCallback(async () => {
    if (!otherId || otherId === user?.client_id) return;
    try {
      const list = await api(`/api/messages?with=${otherId}`);
      setMessages(Array.isArray(list) ? list : []);
    } catch (e) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [otherId, user?.client_id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  useEffect(() => {
    navigation.setOptions({ title: otherUsername ? `@${otherUsername}` : 'Chat' });
  }, [otherUsername, navigation]);

  const send = async () => {
    const text = (body || '').trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const created = await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: otherId, body: text }),
      });
      setMessages((prev) => [...prev, { ...created, sender_username: user?.username }]);
      setBody('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      // could show error toast
    } finally {
      setSending(false);
    }
  };

  const isMe = (msg) => msg.sender_id === user?.client_id;

  if (!otherId) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.errorText}>Invalid chat</Text>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.message_id)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 100 + insets.bottom },
          keyboardHeight > 0 && { paddingBottom: 120 + keyboardHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[styles.bubbleWrap, isMe(item) ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
            <View style={[styles.bubble, isMe(item) ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, isMe(item) ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                {item.body}
              </Text>
              <Text style={[styles.bubbleMeta, isMe(item) ? styles.bubbleMetaMe : styles.bubbleMetaThem]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
          </View>
        }
      />
      <View style={[styles.inputRowWrap, { bottom: keyboardHeight + insets.bottom }]}>
        <View style={styles.inputRow}>
        <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={colors.text3}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={10000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!body.trim() || sending}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.danger },
  listContent: { padding: 12, paddingBottom: 100 },
  bubbleWrap: { marginBottom: 8 },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubbleWrapThem: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: 15 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: colors.text },
  bubbleMeta: { fontSize: 11, marginTop: 4 },
  bubbleMetaMe: { color: 'rgba(255,255,255,0.8)' },
  bubbleMetaThem: { color: colors.text3 },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: colors.text3, fontSize: 14 },
  inputRowWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 0, gap: 10 },
  input: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text },
  sendBtn: { backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
