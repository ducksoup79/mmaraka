/**
 * Register this device for push notifications and send the Expo push token to the backend.
 * Call after login when the user is authenticated.
 * Skipped in Expo Go (push requires a development build from SDK 53+).
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;
  // Push is not supported in Expo Go (SDK 53+); use a development build to test push
  if (Constants.appOwnership === 'expo') return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      if (finalStatus !== 'granted') return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: projectId && projectId !== '00000000-0000-0000-0000-000000000000' ? projectId : undefined,
    });
    const token = tokenResult?.data;
    if (!token) return null;

    await api('/api/push-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return token;
  } catch (e) {
    console.warn('[push] Registration skipped or failed:', e?.message);
    return null;
  }
}

export async function unregisterPushToken() {
  try {
    await api('/api/push-token', { method: 'DELETE' });
  } catch (e) {
    const msg = e?.message || '';
    // In Expo Go we never register a token, so DELETE may return "Missing or invalid token" — skip warning
    if (!msg.toLowerCase().includes('missing') && !msg.toLowerCase().includes('invalid token')) {
      console.warn('[push] Failed to remove token:', msg);
    }
  }
}
