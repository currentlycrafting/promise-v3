import { loadCurrentUser, loadNavNotifBadge, bindLogoutButton } from '../auth-ui.js';
import { setStatusMessage } from '../ui/status.js';
(function () {
  const avatarPreview = document.getElementById('avatarPreview');
  const avatarInput = document.getElementById('avatarInput');
  const form = document.getElementById('profileForm');
  const formMsg = document.getElementById('formMsg');

  function setPreview(imgUrl, initials) {
    avatarPreview.innerHTML = '';
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = 'Profile';
      avatarPreview.appendChild(img);
    } else {
      avatarPreview.textContent = initials || '?';
    }
  }

  const showMsg = (text, isError) => setStatusMessage(formMsg, text, Boolean(isError));

  async function loadProfile() {
    try {
      const u = await loadCurrentUser();
      document.getElementById('display_name').value = u.display_name || u.name || '';
      document.getElementById('bio').value = u.bio || '';
      const vis = u.profile_visibility || 'public';
      document.getElementById('profile_visibility').value = vis;
      document.querySelectorAll('.vis-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === vis);
      });
      const name = u.display_name || u.name || '';
      const initials = name ? name.trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() : '?';
      setPreview(u.avatar_url || u.picture_url || null, initials);
    } catch {
      window.location.href = '/login';
    }
  }

  avatarInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      showMsg('Please choose a JPEG, PNG, GIF or WebP image.', true);
      return;
    }
    const fd = new FormData();
    fd.append('avatar', file);
    showMsg('Uploading…');
    fetch('/api/profile/avatar', { method: 'POST', credentials: 'include', body: fd })
      .then(r => r.json())
      .then(data => {
        if (data.detail) { showMsg(data.detail, true); return; }
        const u = data.user;
        setPreview(u.avatar_url || u.picture_url || null, (u.display_name || u.name || '').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?');
        showMsg('Photo updated.');
        setTimeout(() => showMsg(''), 3000);
      })
      .catch(() => showMsg('Upload failed.', true));
    this.value = '';
  });

  document.querySelectorAll('.vis-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.vis-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('profile_visibility').value = this.dataset.value;
    });
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const payload = {
      display_name: document.getElementById('display_name').value.trim() || null,
      bio: document.getElementById('bio').value.trim() || null,
      profile_visibility: document.getElementById('profile_visibility').value,
    };
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.detail || data.error || 'Save failed', true); return; }
      showMsg('Profile saved.');
      setTimeout(() => showMsg(''), 3000);
    } catch {
      showMsg('Request failed.', true);
    }
  });

  loadProfile();
  loadNavNotifBadge();
  bindLogoutButton();
})();
