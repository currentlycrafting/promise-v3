import { escapeHtml } from '../utils.js';
import { avatarHtml } from '../ui/avatar.js';
import { loadCurrentUser, loadNavNotifBadge, bindLogoutButton, renderSidebarUser } from '../auth-ui.js';

  window.addEventListener('scroll', () => {
    document.getElementById('nav').classList.toggle('scrolled', scrollY > 10);
  }, { passive: true });

  const esc = escapeHtml;

  async function loadUser() {
    try {
      const u = await loadCurrentUser();
      window.currentUser = u;
      renderSidebarUser(u, { nameId: 'sidebarName', bioId: 'sidebarBio', avatarId: 'sidebarAvatar' });
    } catch (_) {}
  }

  async function loadFriends() {
    const listEl = document.getElementById('friendsList');
    const statFriends = document.getElementById('statFriends');
    const statPending = document.getElementById('statPending');
    try {
      const [friendsRes, incRes, outRes] = await Promise.all([
        fetch('/api/friends', { credentials: 'include' }),
        fetch('/api/friends/requests/incoming', { credentials: 'include' }),
        fetch('/api/friends/requests/outgoing', { credentials: 'include' }),
      ]);
      const friendsData = await friendsRes.json();
      const incData = await incRes.json();
      const outData = await outRes.json();
      const friends = friendsData.friends || [];
      const incoming = incData.requests || [];
      const outgoing = outData.requests || [];

      if (statFriends) statFriends.textContent = friends.length;
      if (statPending) statPending.textContent = incoming.length + outgoing.length;

      listEl.innerHTML = friends.length === 0
        ? '<p class="empty-hint">No friends yet. Search above to add friends.</p>'
        : friends.map(f => {
            const name = f.display_name || f.name || f.email || 'Friend';
            const mutual = f.mutual_count != null && f.mutual_count > 0 ? f.mutual_count + ' mutual friend' + (f.mutual_count !== 1 ? 's' : '') : '';
            return '<div class="friend-item" data-id="' + f.id + '">' +
              '<div class="avatar-wrap">' + avatarHtml(f) + '</div>' +
              '<div class="meta"><div class="name">' + esc(name) + '</div>' +
              (mutual ? '<div class="mutual">' + esc(mutual) + '</div>' : '') + '</div>' +
              '<div class="actions"><button type="button" class="btn btn-ghost btn-small" data-remove="' + f.id + '">Remove</button></div></div>';
          }).join('');

      document.getElementById('incomingList').innerHTML = incoming.length === 0
        ? '<p class="empty-hint">No pending requests.</p>'
        : incoming.map(r => {
            const u = r.user || {};
            const name = u.display_name || u.name || u.email || 'Someone';
            return '<div class="request-item" data-request-id="' + r.id + '">' +
              '<div class="avatar-wrap">' + avatarHtml(u) + '</div>' +
              '<div class="meta"><div class="name">' + esc(name) + '</div><div class="hint">Wants to be friends</div></div>' +
              '<div class="actions">' +
              '<button type="button" class="btn btn-small" data-accept="' + r.id + '">Accept</button>' +
              '<button type="button" class="btn btn-ghost btn-small" data-decline="' + r.id + '">Decline</button></div></div>';
          }).join('');

      document.getElementById('outgoingList').innerHTML = outgoing.length === 0
        ? '<p class="empty-hint">No sent requests.</p>'
        : outgoing.map(r => {
            const u = r.user || {};
            const name = u.display_name || u.name || u.email || 'User';
            return '<div class="request-item" data-request-id="' + r.id + '">' +
              '<div class="avatar-wrap">' + avatarHtml(u) + '</div>' +
              '<div class="meta"><div class="name">' + esc(name) + '</div><div class="hint">Request sent</div></div>' +
              '<div class="actions"><button type="button" class="btn btn-ghost btn-small" data-cancel="' + r.id + '">Cancel</button></div></div>';
          }).join('');

      bindFriendsEvents();
    } catch (_) {
      listEl.innerHTML = '<p class="empty-hint">Could not load friends.</p>';
    }
  }

  function bindFriendsEvents() {
    document.querySelectorAll('[data-accept]').forEach(btn => {
      btn.onclick = () => acceptRequest(parseInt(btn.dataset.accept, 10));
    });
    document.querySelectorAll('[data-decline]').forEach(btn => {
      btn.onclick = () => declineRequest(parseInt(btn.dataset.decline, 10));
    });
    document.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.onclick = () => cancelRequest(parseInt(btn.dataset.cancel, 10));
    });
    document.querySelectorAll('[data-remove]').forEach(btn => {
      btn.onclick = () => removeFriend(parseInt(btn.dataset.remove, 10));
    });
  }

  async function acceptRequest(id) {
    try {
      const res = await fetch('/api/friends/requests/' + id + '/accept', { method: 'POST', credentials: 'include' });
      if (res.ok) loadFriends();
    } catch (_) {}
  }
  async function declineRequest(id) {
    try {
      const res = await fetch('/api/friends/requests/' + id + '/decline', { method: 'POST', credentials: 'include' });
      if (res.ok) loadFriends();
    } catch (_) {}
  }
  async function cancelRequest(id) {
    try {
      const res = await fetch('/api/friends/requests/' + id, { method: 'DELETE', credentials: 'include' });
      if (res.ok) loadFriends();
    } catch (_) {}
  }
  async function removeFriend(friendId) {
    if (!confirm('Remove this friend?')) return;
    try {
      const res = await fetch('/api/friends/' + friendId, { method: 'DELETE', credentials: 'include' });
      if (res.ok) loadFriends();
    } catch (_) {}
  }

  let searchDebounce;
  document.getElementById('searchInput').addEventListener('input', function () {
    const q = this.value.trim();
    clearTimeout(searchDebounce);
    const resultsEl = document.getElementById('searchResults');
    if (q.length < 2) {
      resultsEl.innerHTML = q.length === 1 ? '<p class="search-hint">Type at least 2 characters to search.</p>' : '';
      return;
    }
    resultsEl.innerHTML = '<p class="search-hint">Searching...</p>';
    searchDebounce = setTimeout(async () => {
      try {
        const res = await fetch('/api/users/search?q=' + encodeURIComponent(q), { credentials: 'include' });
        const data = await res.json();
        const users = data.users || [];
        if (users.length === 0) {
          resultsEl.innerHTML = '<p class="search-hint search-empty">No one found for &ldquo;' + esc(q) + '&rdquo;. Try a different name or email.</p>';
          return;
        }
        resultsEl.innerHTML = users.map(u => {
          const name = u.display_name || u.name || u.email || 'User';
          let action = '';
          if (u.is_friend) action = '<span class="hint">Friends</span>';
          else if (u.pending_request_sent) action = '<span class="hint">Request sent</span>';
          else if (u.pending_request_received) action = '<a href="#" class="btn btn-small" data-accept-incoming="' + u.id + '">Accept</a>';
          else action = '<button type="button" class="btn btn-small" data-send-request="' + u.id + '">Add friend</button>';
          return '<div class="search-result-item" data-user-id="' + u.id + '">' +
            '<div class="avatar-wrap">' + avatarHtml(u) + '</div>' +
            '<div class="meta"><div class="name">' + esc(name) + '</div><div class="email">' + esc(u.email || '') + '</div></div>' +
            '<div class="actions">' + action + '</div></div>';
        }).join('');
        resultsEl.querySelectorAll('[data-send-request]').forEach(btn => {
          btn.onclick = (e) => { e.preventDefault(); sendRequest(parseInt(btn.dataset.sendRequest, 10)); };
        });
      } catch (_) {
        resultsEl.innerHTML = '';
      }
    }, 250);
  });

  document.getElementById('searchResults').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accept-incoming]');
    if (btn) { e.preventDefault(); acceptIncoming(parseInt(btn.dataset.acceptIncoming, 10)); }
  });

  async function sendRequest(toUserId) {
    try {
      const res = await fetch('/api/friends/requests', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: toUserId }),
      });
      const data = await res.json();
      if (res.ok) { loadFriends(); document.getElementById('searchInput').dispatchEvent(new Event('input')); }
      else if (data.detail) alert(data.detail);
    } catch (_) {}
  }

  async function acceptIncoming(userId) {
    const incRes = await fetch('/api/friends/requests/incoming', { credentials: 'include' });
    const incData = await incRes.json();
    const req = (incData.requests || []).find(r => (r.user && r.user.id === userId) || r.from_user_id === userId);
    if (req) acceptRequest(req.id);
  }

  loadUser().then(() => {
    loadFriends();
    loadNavNotifBadge();
  });

  bindLogoutButton();
