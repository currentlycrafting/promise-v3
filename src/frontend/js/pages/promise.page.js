import { fetchUnreadNotificationsCount, logout } from '../api.js';

  let llm = null;
  try {
    llm = await import('../llm.js');
  } catch (e) {
    console.warn('LLM module not available, using direct submit:', e.message);
  }

  const form = document.getElementById('promiseForm');
  const statusEl = document.getElementById('status');
  const commitBtn = document.getElementById('commitBtn');
  const btnText = commitBtn.querySelector('.btn-text');
  const pulseDots = document.getElementById('pulseDots');
  const aiLoading = document.getElementById('aiLoading');
  const promiseForm = document.getElementById('promiseForm');

  let friendsList = [];

  document.querySelectorAll('.type-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const isOthers = pill.dataset.type === 'others';
      document.getElementById('friendsSelectGroup').style.display = isOthers ? 'block' : 'none';
      if (isOthers && friendsList.length === 0) loadFriendsForPromise();
    });
  });

  function getPillValue(containerId) {
    const el = document.querySelector('#' + containerId + ' .option-pill.active');
    return el ? el.dataset.value || '' : '';
  }
  function setPillValue(containerId, value) {
    document.querySelectorAll('#' + containerId + ' .option-pill').forEach(p => {
      p.classList.toggle('active', (p.dataset.value || '') === value);
    });
  }
  document.getElementById('categoryPills').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-pill');
    if (!btn) return;
    document.querySelectorAll('#categoryPills .option-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
  });
  document.getElementById('recurrencePills').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-pill');
    if (!btn) return;
    document.querySelectorAll('#recurrencePills .option-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
  });
  document.getElementById('visibilityPills').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-pill');
    if (!btn) return;
    document.querySelectorAll('#visibilityPills .option-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
  });

  async function loadFriendsForPromise() {
    const container = document.getElementById('friendsCheckboxes');
    try {
      const res = await fetch('/api/friends', { credentials: 'include' });
      const data = await res.json();
      friendsList = data.friends || [];
      if (friendsList.length === 0) {
        container.innerHTML = '<p class="hint">No friends yet. <a href="/friends">Add friends</a> to make shared promises.</p>';
        return;
      }
      container.innerHTML = friendsList.map(f => {
        const name = f.display_name || f.name || f.email || 'Friend';
        const img = (f.avatar_url || f.picture_url) ? `<img src="${(f.avatar_url || f.picture_url).replace(/"/g, '&quot;')}" alt="">` : '<span>' + (name.trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?') + '</span>';
        return `<label><input type="checkbox" name="participant" value="${f.id}"><span class="avatar-wrap">${img}</span><span>${name.replace(/</g, '&lt;')}</span></label>`;
      }).join('');
    } catch {
      container.innerHTML = '<p class="hint">Could not load friends.</p>';
    }
  }

  // Scroll shadow
  window.addEventListener('scroll', () => {
    document.getElementById('nav').classList.toggle('scrolled', scrollY > 10);
  }, { passive: true });

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = type || '';
  }

  function setBtnState(state) {
    commitBtn.classList.remove('loading', 'thinking', 'saved');
    pulseDots.classList.remove('visible');
    aiLoading.classList.remove('visible');
    promiseForm.style.display = '';
    commitBtn.disabled = false;

    if (state === 'loading') {
      commitBtn.classList.add('loading');
      commitBtn.disabled = true;
      pulseDots.classList.add('visible');
    } else if (state === 'thinking') {
      // Hide form, show AI breathing orb
      promiseForm.style.display = 'none';
      aiLoading.classList.add('visible');
      commitBtn.disabled = true;
    } else if (state === 'saving') {
      aiLoading.classList.remove('visible');
      promiseForm.style.display = '';
      commitBtn.classList.add('loading');
      commitBtn.disabled = true;
    } else if (state === 'saved') {
      commitBtn.classList.add('saved');
      commitBtn.disabled = true;
      btnText.textContent = '\u2713';
    } else {
      btnText.textContent = 'Commit';
    }
  }

  // Pre-load LLM in background
  if (llm) {
    setStatus('Loading AI model...');
    setBtnState('loading');
    llm.initLLM('/models/model.gguf', 'promise-model')
      .then(() => {
        setStatus('AI ready \u2014 faster next time.', 'success');
        setBtnState('idle');
        setTimeout(() => setStatus(''), 3000);
      })
      .catch(() => {
        setStatus('AI unavailable, direct submit enabled.');
        setBtnState('idle');
      });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value.trim();
    const details = document.getElementById('details').value.trim();
    const deadline = document.getElementById('deadline').value.trim();
    const promiseType = document.querySelector('.type-pill.active')?.dataset.type || 'self';

    if (!title || !deadline) {
      setStatus('Please fill in the promise and deadline.', 'error');
      return;
    }

    let name = title;
    let content = details ? `${title} — ${details}` : `I promise I will ${title.toLowerCase()}`;
    let deadlineToUse = deadline;
    let llmResult = null;

    // If LLM is available, use it to improve wording, deadline, reminder, progress
    if (llm) {
      try {
        setBtnState('thinking');
        setStatus('AI is thinking...');
        promiseForm.style.display = 'none';
        aiLoading.classList.add('visible');
        const rawText = details ? `${title}. ${details}` : title;
        const formatted = await llm.formatNewPromiseFull(rawText, deadline);
        const parsed = llm.parseCreateFull ? llm.parseCreateFull(formatted) : (() => {
          const c = llm.parseCreate(formatted);
          return { name: c.name, type: c.type, promise: c.promise, deadline: '', reminder_value: null, reminder_unit: '', target_value: null };
        })();
        if (parsed.name) name = parsed.name;
        if (parsed.promise) content = parsed.promise;
        if (parsed.deadline) deadlineToUse = parsed.deadline;
        llmResult = { reminder_value: parsed.reminder_value, reminder_unit: parsed.reminder_unit, target_value: parsed.target_value };
      } catch (err) {
        console.warn('LLM formatting failed, using raw input:', err.message);
        setStatus('AI unavailable, submitting directly...');
      }
      promiseForm.style.display = '';
      aiLoading.classList.remove('visible');
    }

    const participantIds = promiseType === 'others'
      ? Array.from(document.querySelectorAll('input[name="participant"]:checked')).map(el => parseInt(el.value, 10)).filter(n => !Number.isNaN(n))
      : [];

    try {
      setBtnState('saving');
      setStatus('Saving your promise...');
      const body = new FormData();
      body.append('name', name);
      body.append('promise_type', promiseType);
      body.append('content', content);
      body.append('deadline', deadlineToUse);
      if (participantIds.length > 0) body.append('participant_user_ids', JSON.stringify(participantIds));
      const cat = getPillValue('categoryPills');
      if (cat) body.append('category', cat);
      const rec = getPillValue('recurrencePills');
      if (rec) body.append('recurrence', rec);
      const vis = getPillValue('visibilityPills') || 'private';
      body.append('visibility', vis);
      const progressRaw = (document.getElementById('progress_manual')?.value || '').trim();
      let manualTarget = Number.NaN;
      let manualCurrent = Number.NaN;
      if (progressRaw.includes('/')) {
        const parts = progressRaw.split('/').map((p) => p.trim());
        manualCurrent = parseInt(parts[0] || '', 10);
        manualTarget = parseInt(parts[1] || '', 10);
      } else {
        manualTarget = parseInt(progressRaw, 10);
      }
      if (!Number.isNaN(manualTarget) && manualTarget > 0) {
        body.append('target_value', String(manualTarget));
        if (!Number.isNaN(manualCurrent) && manualCurrent >= 0) {
          body.append('current_value', String(Math.min(manualCurrent, manualTarget)));
        }
      } else if (llmResult && llmResult.target_value != null) {
        body.append('target_value', String(llmResult.target_value));
      }
      if (llmResult && llmResult.reminder_value != null && llmResult.reminder_unit) body.append('reminder_value', String(llmResult.reminder_value));
      if (llmResult && llmResult.reminder_unit) body.append('reminder_unit', llmResult.reminder_unit);

      const res = await fetch('/api/promises', { method: 'POST', body, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create promise');
      }

      setBtnState('saved');
      setStatus('Promise created!', 'success');
      setTimeout(() => { window.location.href = '/dashboard'; }, 800);
    } catch (err) {
      setStatus(err.message, 'error');
      setBtnState('idle');
    }
  });

  fetchUnreadNotificationsCount()
    .then(d => {
      const el = document.getElementById('navNotifBadge');
      if (!el) return;
      const n = d.count || 0;
      el.textContent = n > 99 ? '99+' : n;
      el.style.display = n > 0 ? 'flex' : 'none';
    })
    .catch(() => {});

  document.getElementById('logoutBtn')?.addEventListener('click', async function () {
    try { await logout(); } catch (_) {}
    window.location.href = '/';
  });
