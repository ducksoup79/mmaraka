import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../AuthContext';
import { api, API_BASE } from '../api';
import { colors } from '../theme';
import Screen from '../components/Screen';

export default function SubscriptionScreen() {
  const { user, updateUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingPlanId, setPayingPlanId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [rolesRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/api/misc/roles`).then((r) => r.json()),
        fetch(`${API_BASE}/api/payment/config`).then((r) => r.json()),
      ]);
      const roles = Array.isArray(rolesRes) ? rolesRes : rolesRes.error ? [] : [];
      const upgradeable = roles.filter(
        (r) =>
          r.client_role !== 'Admin' &&
          r.client_role !== 'Basic' &&
          parseFloat(r.sub_price) > 0
      );
      setPlans(upgradeable);
      setPaymentConfig(configRes.error ? null : configRes);
    } catch (e) {
      setPlans([]);
      setPaymentConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Refresh user when returning from browser (e.g. after PayPal)
      updateUser({});
    }, [load, updateUser])
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSubscribe = async (plan) => {
    if (!paymentConfig?.paypal_client_id) {
      Alert.alert(
        'Payment not available',
        'PayPal is not configured. Please try again later or contact support.'
      );
      return;
    }
    setPayingPlanId(plan.client_role_id);
    try {
      const data = await api('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({ client_role_id: plan.client_role_id }),
      });
      const approvalUrl = data.approvalUrl || data.approval_url;
      if (approvalUrl) {
        const canOpen = await Linking.canOpenURL(approvalUrl);
        if (canOpen) {
          await Linking.openURL(approvalUrl);
          updateUser({});
        } else {
          Alert.alert('Error', 'Could not open payment page.');
        }
      } else {
        Alert.alert(
          'Error',
          'Server did not return a payment link. You can try again or pay from the website.'
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to start payment.');
    } finally {
      setPayingPlanId(null);
    }
  };

  const currentRoleId = user?.client_role_id;
  const currentRole = user?.client_role || 'Basic';

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.subtitle}>
            Your plan: <Text style={styles.currentPlan}>{currentRole}</Text>
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={styles.spinner} />
        ) : !paymentConfig?.paypal_client_id ? (
          <View style={styles.card}>
            <Text style={styles.noPayment}>
              Payment is not set up yet. Check back later or contact support to upgrade.
            </Text>
          </View>
        ) : plans.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.noPlans}>No upgrade plans available at the moment.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Upgrade plans</Text>
            {plans.map((plan) => {
              const price = parseFloat(plan.sub_price);
              const isCurrent = plan.client_role_id === currentRoleId;
              const isPaying = payingPlanId === plan.client_role_id;
              return (
                <View key={plan.client_role_id} style={styles.planRow}>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{plan.client_role}</Text>
                    <Text style={styles.planPrice}>
                      {paymentConfig?.currency_code || 'BWP'} {price.toFixed(2)}
                    </Text>
                    {plan.plan_description ? (
                      <Text style={styles.planDesc} numberOfLines={2}>
                        {plan.plan_description}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.subscribeBtn,
                      isCurrent && styles.subscribeBtnCurrent,
                      isPaying && styles.subscribeBtnDisabled,
                    ]}
                    onPress={() => handleSubscribe(plan)}
                    disabled={isCurrent || isPaying}
                  >
                    <Text
                      style={[
                        styles.subscribeBtnText,
                        isCurrent && styles.subscribeBtnTextCurrent,
                      ]}
                    >
                      {isCurrent ? 'Current plan' : isPaying ? 'Opening…' : 'Subscribe'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <Text style={styles.hint}>
              You will complete payment in your browser. After paying, return to the app and your plan will update.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.text2, marginTop: 4 },
  currentPlan: { fontWeight: '600', color: colors.accent },
  spinner: { marginTop: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 16 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: '600', color: colors.text },
  planPrice: { fontSize: 14, color: colors.text2, marginTop: 2 },
  planDesc: { fontSize: 12, color: colors.text3, marginTop: 4 },
  subscribeBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  subscribeBtnCurrent: { backgroundColor: colors.border },
  subscribeBtnDisabled: { opacity: 0.7 },
  subscribeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  subscribeBtnTextCurrent: { color: colors.text2 },
  noPayment: { color: colors.text2, textAlign: 'center', paddingVertical: 12 },
  noPlans: { color: colors.text2, textAlign: 'center', paddingVertical: 12 },
  hint: {
    fontSize: 12,
    color: colors.text3,
    marginTop: 16,
    fontStyle: 'italic',
  },
});
