import { logout } from '../api.js';

(function () {
  const listEl = document.getElementById('notifList');
  const emptyEl = document.getElementById('empty');
  const countLabel = document.getElementById('countLabel');
  const markAllBtn = document.getElementById('markAllBtn');

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  function messageFor(n) {
    const name = n.from_name || 'Someone';
    switch (n.type) {
      case 'friend_request': return '<strong>' + escapeHtml(name) + '</strong> sent you a friend request.';
      case 'friend_accepted': return '<strong>' + escapeHtml(name) + '</strong> accepted your friend request.';
      case 'shared_promise_pending': return '<strong>' + escapeHtml(name) + '</strong> marked a shared promise complete. Waiting for you to confirm.';
      case 'shared_promise_complete': return 'Shared promise &ldquo;' + escapeHtml(n.message || '') + '&rdquo; was completed by everyone.';
      case 'shared_promise_reneged': return '<strong>' + escapeHtml(name) + '</strong> reneged completion for shared promise &ldquo;' + escapeHtml(n.message || '') + '&rdquo;.';
      case 'system_corrupt_promise': return escapeHtml(n.message || 'A corrupted promise was removed automatically.');
      case 'reminder': return 'Reminder: &ldquo;' + escapeHtml(n.message || 'Promise') + '&rdquo; is due soon.';
      default: return n.message || 'New notification';
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function avatarHtml(n) {
    if (n.type === 'reminder') {
      return '<span class="avatar-icon-bell" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>';
    }
    if (n.from_avatar_url) return '<img src="' + escapeHtml(n.from_avatar_url) + '" alt="">';
    const name = n.from_name || 'Someone';
    const initials = name.trim().split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase() || '?';
    return '<span>' + escapeHtml(initials) + '</span>';
  }

  function linkFor(n) {
    if (n.type === 'friend_request') return '/friends';
    if (n.type === 'friend_accepted') return '/friends';
    if (n.type === 'shared_promise_pending' || n.type === 'shared_promise_complete' || n.type === 'shared_promise_reneged' || n.type === 'system_corrupt_promise') return '/dashboard';
    if (n.type === 'reminder') return '/dashboard';
    return '#';
  }

  async function load() {
    try {
      const [listRes, countRes] = await Promise.all([
        fetch('/api/notifications', { credentials: 'include' }),
        fetch('/api/notifications/unread-count', { credentials: 'include' }),
      ]);
      const listData = await listRes.json();
      const countData = await countRes.json();
      const notifications = listData.notifications || [];
      const unread = countData.count ?? 0;

      countLabel.textContent = unread === 0 ? 'All caught up' : unread + ' unread';
      markAllBtn.style.display = unread > 0 ? 'block' : 'none';

      if (notifications.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
      }
      emptyEl.style.display = 'none';
      listEl.innerHTML = notifications.map(function (n) {
        const isUnread = n.read_at == null;
        const href = linkFor(n);
        return '<div class="notif-item' + (isUnread ? ' unread' : '') + '" data-id="' + n.id + '" data-href="' + escapeHtml(href) + '">' +
          '<div class="avatar">' + avatarHtml(n) + '</div>' +
          '<div class="body">' +
          '<div class="text">' + messageFor(n) + '</div>' +
          '<div class="meta">' + formatTime(n.created_at) + '</div>' +
          (isUnread ? '<button type="button" class="mark-read" data-id="' + n.id + '">Mark as read</button>' : '') +
          '</div></div>';
      }).join('');

      listEl.querySelectorAll('.notif-item').forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (e.target.classList.contains('mark-read')) return;
          const id = el.dataset.id;
          const href = el.dataset.href;
          if (id) markOne(id);
          if (href && href !== '#') window.location.href = href;
        });
      });
      listEl.querySelectorAll('.mark-read').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.stopPropagation(); markOne(btn.dataset.id); });
      });
    } catch (_) {
      listEl.innerHTML = '';
      emptyEl.textContent = 'Could not load notifications.';
      emptyEl.style.display = 'block';
    }
  }

  async function markOne(id) {
    try {
      await fetch('/api/notifications/' + id + '/read', { method: 'PATCH', credentials: 'include' });
      load();
    } catch (_) {}
  }

  markAllBtn.addEventListener('click', async function () {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
      load();
    } catch (_) {}
  });

  load();
  document.getElementById('logoutBtn')?.addEventListener('click', async function () {
    try { await logout(); } catch (_) {}
    window.location.href = '/';
  });
})();
