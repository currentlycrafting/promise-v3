import { logout as apiLogout, fetchUnreadNotificationsCount } from './api.js';
import { escapeHtml, initials } from './utils.js';

export async function loadCurrentUser() {
  const res = await fetch('/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = '/login';
    return null;
  }
  const data = await res.json();
  return data.user || data;
}

export async function loadNavNotifBadge(targetId = 'navNotifBadge') {
  const el = document.getElementById(targetId);
  if (!el) return;
  try {
    const count = await fetchUnreadNotificationsCount();
    el.textContent = count > 99 ? '99+' : String(count);
    el.style.display = count > 0 ? 'flex' : 'none';
  } catch (_) {
    el.style.display = 'none';
  }
}

export function renderSidebarUser(user, { nameId, bioId, avatarId }) {
  if (!user) return;
  const name = user.display_name || user.name || '—';
  const nameEl = document.getElementById(nameId);
  const bioEl = document.getElementById(bioId);
  const avatarEl = document.getElementById(avatarId);
  if (nameEl) nameEl.textContent = name;
  if (bioEl) {
    const bio = user.bio || '';
    bioEl.textContent = bio;
    bioEl.style.display = bio ? '' : 'none';
  }
  if (avatarEl) {
    const imgUrl = user.avatar_url || user.picture_url || null;
    avatarEl.innerHTML = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="">`
      : `<span class="avatar-initials">${escapeHtml(initials(name))}</span>`;
  }
}

export function bindLogoutButton(buttonId = 'logoutBtn') {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await apiLogout();
    } catch (_) {}
    window.location.href = '/';
  });
}
