import { parseJsonSafe, requestJson } from './http/request.js';

export async function logout() {
  const { ok, data } = await requestJson('/logout', { method: 'POST', credentials: 'include' });
  if (!ok) {
    throw new Error(data.error || 'Logout failed');
  }
  return true;
}

export async function fetchUnreadNotificationsCount() {
  const { ok, data } = await requestJson('/api/notifications/unread-count', { credentials: 'include' });
  if (!ok) return 0;
  return Number(data.count || 0);
}
