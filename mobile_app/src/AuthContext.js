import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken, getAuthToken } from './api';
import { registerForPushNotificationsAsync, unregisterPushToken } from './pushNotifications';

const TOKEN_KEY = 'marketplace_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStoredToken = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        const u = await api('/api/auth/me');
        setUser({
          name: u.username,
          email: u.email,
          isAdmin: !!u.is_admin,
          client_id: u.client_id,
          client_role_id: u.client_role_id,
          client_role: u.client_role,
          location_id: u.location_id,
          location_name: u.location_name,
        });
        registerForPushNotificationsAsync().catch(() => {});
      } else {
        setUser(null);
      }
    } catch {
      setAuthToken(null);
      setUser(null);
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoredToken();
  }, [loadStoredToken]);

  const login = useCallback(async (userData, token) => {
    setAuthToken(token);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    setUser({
      name: userData.username,
      email: userData.email,
      isAdmin: !!userData.is_admin,
      client_id: userData.client_id,
      client_role_id: userData.client_role_id,
      client_role: userData.client_role,
      location_id: userData.location_id,
      location_name: userData.location_name,
    });
    registerForPushNotificationsAsync().catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    unregisterPushToken().catch(() => {});
  }, []);

  const updateUser = useCallback(async (updates) => {
    if (updates && Object.keys(updates).length === 0) {
      const u = await api('/api/auth/me');
      setUser({
        name: u.username,
        email: u.email,
        isAdmin: !!u.is_admin,
        client_id: u.client_id,
        client_role_id: u.client_role_id,
        client_role: u.client_role,
        location_id: u.location_id,
        location_name: u.location_name,
      });
    } else if (updates) {
      setUser((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, loadStoredToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
