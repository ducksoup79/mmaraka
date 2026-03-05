/**
 * API client and upload for the mobile app. API_BASE from EXPO_PUBLIC_API_URL (.env or EAS build).
 * Token stored in memory (setAuthToken/getAuthToken) and used in Authorization header.
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

/** JSON API request; adds Bearer token when set. Throws on non-OK response. */
export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

/** Upload image: accepts { uri, type, name } or similar; POST to /api/uploads/image; returns path. */
export async function uploadImage(input) {
  const uri = typeof input === 'string' ? input : input?.uri;
  if (!uri) throw new Error('Image uri required');
  const mimeType =
    (typeof input === 'object' && input?.mimeType) ||
    (typeof input === 'object' && input?.type) ||
    'image/jpeg';
  const fileName =
    (typeof input === 'object' && (input?.fileName || input?.name)) ||
    `image.${String(mimeType).includes('png') ? 'png' : 'jpg'}`;

  const formData = new FormData();
  formData.append('file', {
    uri,
    type: mimeType,
    name: fileName,
  });
  const res = await fetch(`${API_BASE}/api/uploads/image`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed');
  return data.path;
}
