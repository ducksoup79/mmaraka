/**
 * Rotating banner of adverts: GET /api/misc/adverts. Tap opens ServiceDetail. Used on Products tab.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from '../api';
import { colors } from '../theme';

const ADVERT_CARD_WIDTH = 140;
const ADVERT_CARD_HEIGHT = 100;

export default function AdvertBar({ navigation }) {
  const [adverts, setAdverts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/misc/adverts`);
      const data = await res.json().catch(() => []);
      setAdverts(Array.isArray(data) ? data : []);
    } catch {
      setAdverts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (adverts.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Featured services</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {adverts.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => navigation?.navigate('ServiceDetail', { serviceId: item.service_id })}
            activeOpacity={0.8}
          >
            {item.logo ? (
              <Image
                source={{ uri: `${API_BASE}${item.logo}` }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.cardPlaceholder}>
                <Text style={styles.cardEmoji}>🏢</Text>
              </View>
            )}
            <Text style={styles.cardName} numberOfLines={2}>
              {item.name || 'Service'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  scroll: { marginHorizontal: -4 },
  scrollContent: {
    paddingHorizontal: 12,
    paddingRight: 16,
  },
  loadingWrap: {
    height: ADVERT_CARD_HEIGHT + 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: ADVERT_CARD_WIDTH,
    marginRight: 10,
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImage: {
    width: '100%',
    height: 72,
    backgroundColor: colors.surface2,
  },
  cardPlaceholder: {
    width: '100%',
    height: 72,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 28 },
  cardName: {
    padding: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
});
