/**
 * Send push notifications via Expo Push Service.
 * Requires EXPO_ACCESS_TOKEN in .env for production (optional for dev).
 */
const { Expo } = require('expo-server-sdk');

let expo = null;

function getExpo() {
  if (!expo) {
    const token = process.env.EXPO_ACCESS_TOKEN;
    expo = new Expo({ accessToken: token || undefined });
  }
  return expo;
}

/**
 * Send a push notification to a single Expo push token.
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken || typeof pushToken !== 'string') return false;
  const expoClient = getExpo();
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn('[push] Invalid Expo push token');
    return false;
  }
  try {
    const messages = [{ to: pushToken, title, body, data, sound: 'default' }];
    const chunks = expoClient.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expoClient.sendPushNotificationsAsync(chunk);
    }
    return true;
  } catch (e) {
    console.error('[push] Send failed:', e.message);
    return false;
  }
}

/**
 * Send push to multiple tokens (e.g. for "new listing" broadcast).
 */
async function sendPushToMany(tokens, title, body, data = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  const expoClient = getExpo();
  const valid = tokens.filter((t) => t && Expo.isExpoPushToken(t));
  if (valid.length === 0) return;
  const messages = valid.map((to) => ({ to, title, body, data, sound: 'default' }));
  const chunks = expoClient.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expoClient.sendPushNotificationsAsync(chunk);
    } catch (e) {
      console.error('[push] Batch send failed:', e.message);
    }
  }
}

module.exports = { sendPushNotification, sendPushToMany, getExpo };
