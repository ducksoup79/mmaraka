import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import AddProductScreen from './src/screens/AddProductScreen';
import EditProductScreen from './src/screens/EditProductScreen';
import ServicesScreen from './src/screens/ServicesScreen';
import AddServiceScreen from './src/screens/AddServiceScreen';
import EditServiceScreen from './src/screens/EditServiceScreen';
import ServiceDetailScreen from './src/screens/ServiceDetailScreen';
import MyListingsScreen from './src/screens/MyListingsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabIcon = (icon) => ({ focused }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{icon}</Text>
);

function MainTabs() {
  const { logout } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen name="ProductsTab" options={{ title: 'Mmaraka', tabBarIcon: tabIcon('🛍️') }} component={ProductsScreen} />
      <Tab.Screen name="ServicesTab" options={{ title: 'Services', tabBarIcon: tabIcon('🏢') }} component={ServicesScreen} />
      <Tab.Screen name="MyListingsTab" options={{ title: 'My Listings', tabBarIcon: tabIcon('📋') }} component={MyListingsScreen} />
      <Tab.Screen name="MessagesTab" options={{ title: 'Messages', tabBarIcon: tabIcon('💬') }} component={MessagesScreen} />
      <Tab.Screen name="SettingsTab" options={{ title: 'Settings', tabBarIcon: tabIcon('⚙️') }}>
        {() => <SettingsScreen onLogout={logout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AppContent() {
  const { user, loading, login } = useAuth();
  const navigationRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content?.data || {};
      if (data.type === 'message' && data.sender_id) {
        navigationRef.current?.navigate('Chat', {
          otherId: data.sender_id,
          otherUsername: data.sender_username || 'User',
        });
      } else if (data.type === 'product' && data.listing_id) {
        navigationRef.current?.navigate('ProductDetail', { listingId: data.listing_id });
      }
    });
    return () => sub.remove();
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onLogin={(userData, token) => {
          login(userData, token);
        }}
      />
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Item' }} />
        <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ title: 'Add Listing' }} />
        <Stack.Screen name="EditProduct" component={EditProductScreen} options={{ title: 'Edit Listing' }} />
        <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} options={{ title: 'Service' }} />
        <Stack.Screen name="AddService" component={AddServiceScreen} options={{ title: 'Add Service' }} />
        <Stack.Screen name="EditService" component={EditServiceScreen} options={{ title: 'Edit Service' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: 12, color: colors.text2 },
});
