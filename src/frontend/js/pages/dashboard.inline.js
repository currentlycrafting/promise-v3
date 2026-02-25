  window.addEventListener('scroll', () => {
    document.getElementById('nav').classList.toggle('scrolled', scrollY > 10);
  }, { passive: true });

  const listEl = document.getElementById('list');
  let activePromises = [];
  let missedPromise = null;
  let keptCount = parseInt(localStorage.getItem('promise_kept_count') || '0');
  let accountabilityScore = null;

  // ── SVG Icons ──
  const ICONS = {
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    bigCheck: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
    mic: '<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  };
  const CAT_ICONS = { self: ICONS.person, others: ICONS.people, world: ICONS.globe };

  function fmtTime(seconds) {
    if (seconds <= 0) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d) parts.push(d + 'd');
    if (h) parts.push(h + 'h');
    if (m || !parts.length) parts.push(m + 'm');
    return parts.join(' ');
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function getTier(secondsLeft) {
    if (secondsLeft <= 0) return 'missed';
    if (secondsLeft <= 3 * 86400) return 'urgent';
    if (secondsLeft <= 14 * 86400) return 'active';
    return 'on-track';
  }

  function tierState(tier) {
    const map = {
      urgent:   { icon: ICONS.flame, label: 'Needs attention soon', cls: 'state-urgent' },
      active:   { icon: ICONS.clock, label: 'On schedule',          cls: 'state-active' },
      'on-track': { icon: ICONS.check, label: 'Plenty of time',     cls: 'state-on-track' },
      missed:   { icon: ICONS.reset, label: 'Needs a reset',        cls: 'state-missed' },
    };
    return map[tier] || map.active;
  }

  function updateStats() {
    const total = activePromises.length + (missedPromise ? 1 : 0);
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statKept').textContent = keptCount;
    document.getElementById('statActive').textContent = activePromises.length;
    document.getElementById('statSub').textContent = keptCount > 0 ? "You're building momentum" : '';
    const scoreRow = document.getElementById('statScoreRow');
    const scoreEl = document.getElementById('statScore');
    if (accountabilityScore != null && scoreRow && scoreEl) {
      scoreRow.style.display = '';
      scoreEl.textContent = accountabilityScore + '%';
    }
  }

  function initials(name) {
    if (!name || !String(name).trim()) return '?';
    return String(name).trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  }

  async function loadUser() {
    try {
      const res = await fetch('/me', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const u = data.user || data;
      const name = u.display_name || u.name || '—';
      const nameEl = document.getElementById('sidebarName');
      const bioEl = document.getElementById('sidebarBio');
      const avatarEl = document.getElementById('sidebarAvatar');
      if (nameEl) nameEl.textContent = name;
      if (bioEl) {
        bioEl.textContent = u.bio || '';
        bioEl.style.display = u.bio ? '' : 'none';
      }
      const imgUrl = u.avatar_url || u.picture_url || null;
      avatarEl.innerHTML = imgUrl
        ? '<img src="' + esc(imgUrl) + '" alt="">'
        : '<span class="avatar-initials">' + esc(initials(name)) + '</span>';
    } catch (_) {}
  }

  async function loadNotifBadge() {
    const el = document.getElementById('navNotifBadge');
    if (!el) return;
    try {
      const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
      const data = await res.json();
      const n = data.count || 0;
      el.textContent = n > 99 ? '99+' : n;
      el.style.display = n > 0 ? 'flex' : 'none';
    } catch (_) { el.style.display = 'none'; }
  }

  async function load() {
    await loadUser();
    loadNotifBadge();
    try {
      const res = await fetch('/api/promises', { credentials: 'include' });
      const data = await res.json();
      activePromises = data.promises || [];
      missedPromise = data.missed || null;
      accountabilityScore = data.accountability_score ?? null;
      if (activePromises[0]?.category) updateCategoryFavicon(activePromises[0].category);
      updateStats();
      render();
      loadActivityFeed();
      loadReminderToast();
    } catch {
      listEl.innerHTML = '<p style="color:var(--muted);text-align:center;padding:48px 0">Could not load promises. Is the backend running?</p>';
    }
  }

  async function loadReminderToast() {
    const toast = document.getElementById('reminderToast');
    const msg = document.getElementById('reminderToastMsg');
    if (!toast || !msg) return;
    try {
      const res = await fetch('/api/notifications?limit=20', { credentials: 'include' });
      const data = await res.json();
      const reminders = (data.notifications || []).filter(n => n.type === 'reminder' && n.read_at == null);
      if (reminders.length === 0) { toast.style.display = 'none'; return; }
      const first = reminders[0];
      msg.textContent = first.message ? 'Reminder: ' + first.message : 'You have a reminder';
      toast.style.display = 'flex';
    } catch (_) { toast.style.display = 'none'; }
  }
  document.getElementById('reminderToastDismiss')?.addEventListener('click', function () {
    document.getElementById('reminderToast').style.display = 'none';
  });

  function render() {
    const now = Math.floor(Date.now() / 1000);

    // Nothing at all
    if (!activePromises.length && !missedPromise) {
      listEl.innerHTML = renderEmpty();
      return;
    }

    // Sort by deadline ascending (soonest first)
    const sorted = [...activePromises].sort((a, b) => a.deadline_at - b.deadline_at);

    // Bucket into tiers
    const urgent = [], active = [], onTrack = [];
    sorted.forEach(p => {
      const left = Math.max(p.deadline_at - now, 0);
      const tier = getTier(left);
      if (tier === 'urgent') urgent.push(p);
      else if (tier === 'active') active.push(p);
      else onTrack.push(p);
    });

    let html = '';

    // Missed
    if (missedPromise) {
      html += renderTierLabel('Needs a reset');
      html += renderMissedCard(missedPromise);
    }

    // Urgent
    if (urgent.length) {
      html += renderTierLabel('Needs attention');
      urgent.forEach(p => { html += renderCard(p, now, 'urgent'); });
    }

    // Active
    if (active.length) {
      html += renderTierLabel('On schedule');
      active.forEach(p => { html += renderCard(p, now, 'active'); });
    }

    // On-track
    if (onTrack.length) {
      html += renderTierLabel('Plenty of time');
      const visible = onTrack.slice(0, 3);
      const hidden = onTrack.slice(3);
      visible.forEach(p => { html += renderCard(p, now, 'on-track'); });
      if (hidden.length) {
        html += `<div class="expander" id="otExpander"><button onclick="expandOnTrack()">Show ${hidden.length} more</button></div>`;
        html += '<div class="on-track-hidden" id="otHidden">';
        hidden.forEach(p => { html += renderCard(p, now, 'on-track'); });
        html += '</div>';
      }
    }

    listEl.innerHTML = html;
  }

  function renderTierLabel(text) {
    return `<div class="tier-label">${text}</div>`;
  }

  async function loadActivityFeed() {
    const el = document.getElementById('activityFeed');
    if (!el) return;
    try {
      const res = await fetch('/api/activity?limit=10', { credentials: 'include' });
      const data = await res.json();
      const activities = data.activities || [];
      if (activities.length === 0) {
        el.innerHTML = '<p class="activity-empty">No recent activity yet.</p>';
        return;
      }
      el.innerHTML = activities.slice(0, 10).map(a => {
        const date = a.at ? new Date(a.at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const text = a.type === 'completed' ? 'Completed &ldquo;' + esc(a.promise_name) + '&rdquo;' : 'Created &ldquo;' + esc(a.promise_name) + '&rdquo;';
        return '<div class="activity-item"><span class="activity-type">' + (a.type === 'completed' ? '&#10003;' : '+') + '</span><span class="activity-text">' + text + '</span><span class="activity-date">' + esc(date) + '</span></div>';
      }).join('');
    } catch (_) {
      el.innerHTML = '<p class="activity-empty">Could not load activity.</p>';
    }
  }

  function renderParticipantList(p) {
    if (!p.shared || !p.participant_list || !p.participant_list.length) return '';
    const parts = p.participant_list.map(pl => {
      const name = pl.display_name || pl.name || '?';
      const done = pl.completed_at != null;
      const avatar = pl.avatar_url
        ? `<img src="${esc(pl.avatar_url)}" alt="">`
        : '<span>' + esc((name || '').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?') + '</span>';
      return `<span class="participant-chip ${done ? 'done' : ''}" title="${esc(name)}">${done ? '&#10003; ' : ''}<span class="p-avatar">${avatar}</span>${esc(name)}</span>`;
    });
    const pending = p.participant_list.filter(pl => pl.completed_at == null);
    const waiting = pending.length > 0 ? `<p class="waiting-msg">Waiting for ${pending.map(pl => esc(pl.display_name || pl.name || '?')).join(', ')} to complete</p>` : '';
    return `<div class="shared-participants"><div class="participant-chips">${parts.join('')}</div>${waiting}</div>`;
  }

  function renderCard(p, now, tier) {
    const left = Math.max(p.deadline_at - now, 0);
    const st = tierState(tier);
    const catIcon = CAT_ICONS[p.promise_type] || CAT_ICONS.self;
    const participantBlock = renderParticipantList(p);
    const myId = window.currentUser && window.currentUser.id;
    const iCompleted = p.shared && p.participant_list && p.participant_list.some(pl => pl.user_id === myId && pl.completed_at != null);
    const completeBtn = iCompleted
      ? `<button class="btn-sm btn-outline" onclick="undoComplete(${p.id})">Undo</button>`
      : `<button class="btn-sm btn-complete" onclick="completePromise(${p.id}, this)">Complete</button>`;
    const dueDate = p.deadline_at ? new Date(p.deadline_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const categoryBadge = p.category ? '<span class="card-category">' + esc(p.category) + '</span>' : '';
    const curVal = p.current_value || 0;
    const progressPct = p.target_value && p.target_value > 0 ? Math.min(100, (curVal / p.target_value) * 100) : 0;
    const progressText = p.target_value && p.target_value > 0 ? (curVal + ' / ' + p.target_value) : String(curVal);
    const progressBar = '<div class="card-progress" data-progress-id="' + p.id + '" data-current="' + curVal + '" data-target="' + (p.target_value != null ? p.target_value : '') + '"><div class="progress-bar"><div class="progress-fill" style="width:' + progressPct + '%"></div></div><div class="progress-row-ui"><span class="progress-text">' + progressText + '</span><button type="button" class="btn-plus" onclick="incrementProgress(' + p.id + ', this)" title="Add progress">+</button></div></div>';
    const streakBadge = (p.streak_count > 0 && p.recurrence) ? '<span class="card-streak">' + p.streak_count + ' ' + (p.recurrence === 'daily' ? 'days' : p.recurrence === 'weekly' ? 'weeks' : 'months') + ' streak</span>' : '';
    const commentCount = (p.comment_count || 0);
    const commentsLine = '<div class="card-comments"><span class="comments-count">' + commentCount + ' comment' + (commentCount !== 1 ? 's' : '') + '</span> <button type="button" class="btn-link" onclick="showComments(' + p.id + ')">Comment</button></div>';
    return `
      <div class="card tier-${tier}" data-id="${p.id}" data-shared="${p.shared ? '1' : '0'}">
        <div class="state-indicator ${st.cls}">${st.icon} <span>${st.label}</span></div>
        <div class="card-top">
          <div>
            ${categoryBadge}
            <h3>${esc(p.name)}</h3>
            <p class="card-content">${esc(p.content)}</p>
            <div class="card-meta">
              <span class="cat-icon" title="Promise to ${p.promise_type}">${catIcon}</span>
              <span class="countdown" data-deadline="${p.deadline_at}">${fmtTime(left)}</span>
              ${dueDate ? '<span class="due-date">Due ' + esc(dueDate) + '</span>' : ''}
            </div>
            ${progressBar}
            ${streakBadge}
            ${commentsLine}
            ${tier === 'urgent' ? '<p class="encouragement">Almost there \u2014 this one needs your focus soon.</p>' : ''}
          </div>
          <div class="card-action" style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            ${completeBtn}
            <button type="button" class="btn-sm btn-edit" data-edit-id="${p.id}">Edit</button>
            <button class="btn-sm btn-forfeit" onclick="forfeitPromise(${p.id}, this)">Forfeit</button>
          </div>
        </div>
        ${participantBlock}
      </div>`;
  }

  function renderMissedCard(p) {
    const st = tierState('missed');
    const catIcon = CAT_ICONS[p.promise_type] || CAT_ICONS.self;
    return `
      <div class="card tier-missed" data-id="${p.id}">
        <div class="state-indicator ${st.cls}">${st.icon} <span>${st.label}</span></div>
        <div class="card-top">
          <div>
            <h3>${esc(p.name)}</h3>
            <p class="card-content">${esc(p.content)}</p>
            <div class="card-meta">
              <span class="cat-icon" title="Promise to ${p.promise_type}">${catIcon}</span>
            </div>
            <p class="missed-msg">Life happens. Let's reshape this into something achievable.</p>
          </div>
          <a href="/reframe?id=${p.id}" class="btn-sm btn-reframe card-action">Reframe</a>
        </div>
      </div>`;
  }

  function renderEmpty() {
    return `
      <div class="empty-state">
        ${ICONS.mic}
        <h3>Your promises start here</h3>
        <p>Making a promise to yourself is an act of self-respect.<br>What's one thing you want to commit to today?</p>
        <a href="/promise" class="btn" style="font-size:14px;padding:12px 28px;border-radius:8px;display:inline-block">Make Your First Promise</a>
        <div class="examples">
          <div class="examples-label">Not sure where to start? Try:</div>
          <div class="example-item">"I'll read for 20 minutes every night"</div>
          <div class="example-item">"I'll call my parents once a week"</div>
          <div class="example-item">"I'll drink 8 glasses of water daily"</div>
        </div>
      </div>`;
  }

  // ── Live countdown ──
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    document.querySelectorAll('.countdown').forEach(el => {
      const dl = parseInt(el.dataset.deadline);
      const left = Math.max(dl - now, 0);
      el.textContent = fmtTime(left);
    });
  }, 1000);

  function runConfetti() {
    const colors = ['#f4845f', '#7fb069', '#5c7cfa', '#f59e0b', '#ec4899'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999;overflow:hidden;';
    document.body.appendChild(container);
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.cssText = 'position:absolute;width:10px;height:10px;background:' + colors[Math.floor(Math.random() * colors.length)] + ';left:' + Math.random() * 100 + 'vw;top:-20px;animation:confetti-fall 2.5s ease-out forwards;animation-delay:' + (Math.random() * 0.5) + 's;opacity:0.9;transform:rotate(' + (Math.random() * 360) + 'deg);';
      container.appendChild(p);
    }
    const style = document.createElement('style');
    style.textContent = '@keyframes confetti-fall { to { top: 100vh; transform: rotate(720deg); opacity: 0; } }';
    document.head.appendChild(style);
    setTimeout(() => { container.remove(); style.remove(); }, 3000);
  }

  // ── Complete promise with confirmation ──
  window.completePromise = async function(id, btn) {
    const card = btn.closest('.card');
    const isShared = card.dataset.shared === '1';
    card.classList.add('completing');
    btn.disabled = true;

    try {
      const res = await fetch(`/api/promises/${id}/complete`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.status === 'marked_complete' && isShared) {
        keptCount++;
        localStorage.setItem('promise_kept_count', keptCount);
        card.classList.remove('completing');
        btn.disabled = false;
        btn.textContent = 'Done';
        load();
        return;
      }

      keptCount++;
      localStorage.setItem('promise_kept_count', keptCount);

      const promiseName = card.querySelector('h3')?.textContent || 'This promise';
      runConfetti();
      card.classList.remove('completing');
      card.className = 'card';
      card.innerHTML = `
        <div class="confirmed-wrap">
          ${ICONS.bigCheck}
          <h3>${esc(promiseName)} has been completed!</h3>
          <p>You showed up. That matters.</p>
          <div class="confirmed-actions">
            <button class="btn-outline" onclick="undoComplete(${id})">Undo</button>
            <a href="/promise" class="btn" style="font-size:12px;padding:7px 16px;border-radius:6px;display:inline-block">Make Another</a>
          </div>
        </div>`;
      updateStats();

      setTimeout(() => {
        card.style.transition = 'opacity 0.4s, transform 0.4s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.96)';
        setTimeout(load, 400);
      }, 4000);
    } catch {
      card.classList.remove('completing');
      btn.disabled = false;
      btn.textContent = 'Error';
    }
  };

  window.forfeitPromise = async function(id, btn) {
    const card = btn.closest('.card');
    card.classList.add('completing');
    btn.disabled = true;
    try {
      const res = await fetch(`/api/promises/${id}/forfeit`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error();
      // Redirect to reframe page
      window.location.href = `/reframe?id=${id}`;
    } catch {
      card.classList.remove('completing');
      btn.disabled = false;
      btn.textContent = 'Error';
    }
  };

  window.undoComplete = async function(id) {
    try {
      const res = await fetch('/api/promises/' + id + '/undo-complete', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error();
      keptCount = Math.max(keptCount - 1, 0);
      localStorage.setItem('promise_kept_count', keptCount);
      load();
    } catch (_) {}
  };

  window.incrementProgress = async function(promiseId, btn) {
    const wrap = document.querySelector('.card-progress[data-progress-id="' + promiseId + '"]');
    if (!wrap) return;
    const currentValue = parseInt(wrap.getAttribute('data-current') || '0', 10) || 0;
    const targetAttr = wrap.getAttribute('data-target');
    const targetValue = targetAttr === '' ? null : parseInt(targetAttr, 10);
    const next = (targetValue != null && targetValue > 0)
      ? Math.min((currentValue || 0) + 1, targetValue)
      : ((currentValue || 0) + 1);

    // Optimistic UI: update bar/text instantly.
    wrap.setAttribute('data-current', String(next));
    const fill = wrap.querySelector('.progress-fill');
    const text = wrap.querySelector('.progress-text');
    if (fill) {
      const pct = (targetValue != null && targetValue > 0) ? Math.min(100, (next / targetValue) * 100) : 0;
      fill.style.width = pct + '%';
    }
    if (text) {
      text.textContent = (targetValue != null && targetValue > 0) ? (next + ' / ' + targetValue) : String(next);
    }

    btn.disabled = true;
    try {
      const res = await fetch('/api/promises/' + promiseId + '/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_value: next }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      let payload = null;
      try { payload = await res.json(); } catch (_) {}

      // If backend confirms completion, celebrate and refresh.
      if (payload && (payload.status === 'completed' || payload.status === 'marked_complete')) {
        runConfetti();
        load();
        return;
      }

      // Fallback: if we hit target but backend still reports active, complete explicitly.
      if (targetValue != null && targetValue > 0 && next >= targetValue && (!payload || payload.status === 'active')) {
        const completeRes = await fetch('/api/promises/' + promiseId + '/complete', { method: 'POST', credentials: 'include' });
        if (completeRes.ok) runConfetti();
      }
      load();
    } catch {
      wrap.setAttribute('data-current', String(currentValue));
      if (fill) {
        const pct = (targetValue != null && targetValue > 0) ? Math.min(100, (currentValue / targetValue) * 100) : 0;
        fill.style.width = pct + '%';
      }
      if (text) {
        text.textContent = (targetValue != null && targetValue > 0) ? (currentValue + ' / ' + targetValue) : String(currentValue);
      }
      btn.disabled = false;
    }
  };

  let commentsModalPromiseId = null;
  const commentsModalEl = document.getElementById('commentsModal');
  const commentsModalList = document.getElementById('commentsModalList');
  const commentsModalInput = document.getElementById('commentsModalInput');
  const commentsModalSubmit = document.getElementById('commentsModalSubmit');
  const commentsModalClose = document.getElementById('commentsModalClose');
  const commentsModalTitle = document.getElementById('commentsModalTitle');

  function openCommentsModal(promiseId, promiseName) {
    commentsModalPromiseId = promiseId;
    commentsModalTitle.textContent = 'Comments' + (promiseName ? ': ' + promiseName : '');
    commentsModalInput.value = '';
    commentsModalEl.style.display = '';
    commentsModalEl.setAttribute('aria-hidden', 'false');
    loadCommentsIntoModal();
  }

  function closeCommentsModal() {
    commentsModalEl.style.display = 'none';
    commentsModalEl.setAttribute('aria-hidden', 'true');
    commentsModalPromiseId = null;
  }

  async function loadCommentsIntoModal() {
    if (!commentsModalPromiseId) return;
    commentsModalList.innerHTML = '<p class="comments-loading">Loading...</p>';
    try {
      const res = await fetch('/api/promises/' + commentsModalPromiseId + '/comments', { credentials: 'include' });
      const data = await res.json();
      const comments = data.comments || [];
      if (comments.length === 0) {
        commentsModalList.innerHTML = '<p class="comments-empty">No comments yet. Be the first to comment.</p>';
      } else {
        const root = comments.filter(c => c.parent_comment_id == null);
        const byParent = new Map();
        comments.forEach(c => {
          if (c.parent_comment_id != null) {
            const arr = byParent.get(c.parent_comment_id) || [];
            arr.push(c);
            byParent.set(c.parent_comment_id, arr);
          }
        });
        function renderComment(c) {
          const date = c.created_at ? new Date(c.created_at * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '';
          const replies = byParent.get(c.id) || [];
          return '<div class="comment-item">' +
            '<div class="comment-author">' + esc(c.author_name || 'Someone') + '</div>' +
            '<div class="comment-body">' + esc(c.body) + '</div>' +
            '<div class="comment-date">' + esc(date) + '</div>' +
            '<div class="comment-actions">' +
            '<button type="button" class="comment-action" data-like-comment="' + c.id + '">' + (c.liked_by_me ? 'Unlike' : 'Like') + ' (' + (c.like_count || 0) + ')</button>' +
            '<button type="button" class="comment-action" data-reply-comment="' + c.id + '">Reply</button>' +
            '</div>' +
            (replies.length ? '<div class="comment-replies">' + replies.map(renderComment).join('') + '</div>' : '') +
          '</div>';
        }
        commentsModalList.innerHTML = root.map(renderComment).join('');
        commentsModalList.querySelectorAll('[data-like-comment]').forEach((b) => {
          b.addEventListener('click', async () => {
            const cid = parseInt(b.getAttribute('data-like-comment'), 10);
            await fetch('/api/promises/' + commentsModalPromiseId + '/comments/' + cid + '/like', { method: 'POST', credentials: 'include' });
            loadCommentsIntoModal();
          });
        });
        commentsModalList.querySelectorAll('[data-reply-comment]').forEach((b) => {
          b.addEventListener('click', () => {
            const cid = parseInt(b.getAttribute('data-reply-comment'), 10);
            document.getElementById('commentsModalReplyTo').value = String(cid);
            commentsModalInput.focus();
            commentsModalInput.placeholder = 'Write a reply...';
          });
        });
      }
    } catch (_) {
      commentsModalList.innerHTML = '<p class="comments-empty">Could not load comments.</p>';
    }
  }

  commentsModalClose.addEventListener('click', closeCommentsModal);
  commentsModalEl.querySelector('.comments-modal-backdrop').addEventListener('click', closeCommentsModal);
  commentsModalSubmit.addEventListener('click', async function () {
    const body = commentsModalInput.value.trim();
    if (!body || !commentsModalPromiseId) return;
    const replyTo = document.getElementById('commentsModalReplyTo').value;
    try {
      const res = await fetch('/api/promises/' + commentsModalPromiseId + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, parent_comment_id: replyTo ? parseInt(replyTo, 10) : null }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      commentsModalInput.value = '';
      document.getElementById('commentsModalReplyTo').value = '';
      commentsModalInput.placeholder = 'Add a comment...';
      loadCommentsIntoModal();
    } catch (_) {}
  });

  window.showComments = async function(promiseId) {
    const card = document.querySelector('.card[data-id="' + promiseId + '"]');
    const name = card ? card.querySelector('h3')?.textContent || '' : '';
    openCommentsModal(promiseId, name);
  };

  window.updateProgress = window.incrementProgress;

  window.expandOnTrack = function() {
    document.getElementById('otHidden')?.classList.add('visible');
    document.getElementById('otExpander')?.remove();
  };

  let editModalPromiseId = null;
  const editModalEl = document.getElementById('editModal');
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-edit[data-edit-id]');
    if (!btn) return;
    const id = parseInt(btn.dataset.editId, 10);
    openEditModal(id);
  });
  async function openEditModal(id) {
    editModalPromiseId = id;
    try {
      const res = await fetch('/api/promises/' + id, { credentials: 'include' });
      const p = await res.json();
      document.getElementById('editName').value = p.name || '';
      document.getElementById('editContent').value = p.content || '';
      document.getElementById('editDeadline').value = '';
      editModalEl.style.display = 'flex';
      editModalEl.setAttribute('aria-hidden', 'false');
    } catch (_) {}
  }
  function closeEditModal() {
    editModalEl.style.display = 'none';
    editModalEl.setAttribute('aria-hidden', 'true');
    editModalPromiseId = null;
  }
  document.getElementById('editModalClose')?.addEventListener('click', closeEditModal);
  editModalEl?.querySelector('.comments-modal-backdrop')?.addEventListener('click', closeEditModal);
  document.getElementById('editModalSave')?.addEventListener('click', async function () {
    if (!editModalPromiseId) return;
    const name = document.getElementById('editName').value.trim();
    const content = document.getElementById('editContent').value.trim();
    const deadline = document.getElementById('editDeadline').value.trim();
    const body = {};
    if (name) body.name = name;
    if (content) body.content = content;
    if (deadline) body.deadline = deadline;
    if (Object.keys(body).length === 0) return;
    try {
      const res = await fetch('/api/promises/' + editModalPromiseId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      closeEditModal();
      load();
    } catch (_) {}
  });

  function updateCategoryFavicon(category) {
    const base = "data:image/svg+xml,";
    let svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23faf8f5'/><text x='8' y='41' font-size='28' font-family='Georgia,serif' fill='%231a1a2e'>P</text><circle cx='50' cy='38' r='8' fill='%23f4845f'/></svg>";
    const c = String(category || '').toLowerCase();
    if (c.includes('health')) svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23faf8f5'/><path d='M30 14h4v16h16v4H34v16h-4V34H14v-4h16z' fill='%23f4845f'/></svg>";
    else if (c.includes('work')) svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23faf8f5'/><rect x='14' y='20' width='36' height='28' rx='4' fill='%231a1a2e'/><rect x='24' y='14' width='16' height='6' rx='2' fill='%23f4845f'/></svg>";
    else if (c.includes('learning')) svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23faf8f5'/><path d='M12 22l20-10 20 10-20 10-20-10zM20 30v10c0 4 6 8 12 8s12-4 12-8V30' fill='none' stroke='%231a1a2e' stroke-width='4'/></svg>";
    const link = document.querySelector("link[rel='icon']");
    if (link) link.setAttribute('href', base + svg);
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async function () {
    try {
      await fetch('/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {}
    window.location.href = '/';
  });

  load();
