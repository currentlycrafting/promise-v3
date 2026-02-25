import { logout } from '../api.js';

  let llm = null;
  try {
    llm = await import('../llm.js');
  } catch (e) {
    console.warn('LLM module not available:', e.message);
  }

  const params = new URLSearchParams(window.location.search);
  const promiseId = params.get('id');
  const LOAD_TIMEOUT_MS = 8000;
  let missedPromise = null;
  let selectedSolution = null;
  let solutionsRaw = '';

  const statusEl = document.getElementById('status');
  const status2El = document.getElementById('status2');

  function setStatus(el, msg, type) {
    el.textContent = msg;
    el.className = type || '';
  }

  window.addEventListener('scroll', () => {
    document.getElementById('nav').classList.toggle('scrolled', scrollY > 10);
  }, { passive: true });

  // ── Load missed promise by ID from URL param ──
  async function loadMissed() {
    if (!promiseId) {
      window.location.href = '/dashboard';
      return;
    }

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
    });

    try {
      const res = await Promise.race([
        fetch(`/api/promises/${promiseId}`, { credentials: 'include' }),
        timeout,
      ]);
      if (!res.ok) {
        window.location.href = '/dashboard';
        return;
      }
      const data = await res.json();
      missedPromise = data;
      document.getElementById('missedName').textContent = data.name;
      document.getElementById('missedContent').textContent = data.content;
    } catch {
      setStatus(statusEl, 'Could not load this reframe. Redirecting to dashboard...', 'error');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1200);
    }
  }

  // ── Step 1: Generate solutions ──
  document.getElementById('generateBtn').addEventListener('click', async () => {
    const reason = document.getElementById('reason').value.trim();
    const category = document.getElementById('category').value;
    if (!reason) {
      setStatus(statusEl, 'Please explain what happened.', 'error');
      return;
    }

    const btn = document.getElementById('generateBtn');
    btn.disabled = true;

    // Transition: hide step1, show AI loading
    const step1 = document.getElementById('step1');
    step1.classList.add('step-leaving');
    await new Promise(r => setTimeout(r, 300));
    step1.style.display = 'none';
    document.getElementById('aiLoading').classList.add('visible');

    if (llm) {
      try {
        await llm.initLLM('/models/model.gguf', 'promise-model');
        solutionsRaw = await llm.refinePromise(missedPromise.content, reason, category, missedPromise.promise_type);
        showSolutions(solutionsRaw);
      } catch (err) {
        console.warn('LLM failed:', err.message);
        showFallbackSolutions();
      }
    } else {
      // Simulate brief thinking for demo feel
      await new Promise(r => setTimeout(r, 1500));
      showFallbackSolutions();
    }
    btn.disabled = false;
  });

  function showFallbackSolutions() {
    const raw = missedPromise.content;
    const core = raw.replace(/^I promise I will\s*/i, '');
    solutionsRaw = `1. Conservative Solution:\n- Revised promise: I promise I will ${core}, but with a smaller scope\n\n2. Moderate Solution:\n- Revised promise: I promise I will ${core}, with adjusted expectations\n\n3. Progressive Solution:\n- Revised promise: I promise I will ${core}, and push even further`;
    showSolutions(solutionsRaw);
  }

  function showSolutions(text) {
    // Hide AI loading
    document.getElementById('aiLoading').classList.remove('visible');

    const solutions = [];
    const labels = ['Conservative', 'Moderate', 'Progressive'];

    const parts = text.split(/(?:\d+\.\s*|#{1,3}\s*)(?:conservative|moderate|progressive)\s*solution\s*:?/i);
    for (let i = 1; i < parts.length && solutions.length < 3; i++) {
      const chunk = parts[i].trim();
      const promiseMatch = chunk.match(/(?:[Rr]evised promise:\s*|[-*]\s*)?(I promise I will[^\n]+)/);
      const text_ = promiseMatch ? promiseMatch[1].trim() : chunk.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))[0]?.replace(/^[-*]\s*/, '').trim() || chunk.trim();
      if (text_) solutions.push({ label: labels[solutions.length] || `Option ${solutions.length + 1}`, text: text_ });
    }

    if (!solutions.length) {
      const promises = text.match(/I promise I will[^\n]+/gi) || [];
      for (let i = 0; i < Math.min(promises.length, 3); i++) {
        solutions.push({ label: labels[i], text: promises[i].trim() });
      }
    }

    if (!solutions.length) {
      const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        solutions.push({ label: labels[i], text: lines[i].replace(/^[-*\d.]\s*/, '').trim() });
      }
    }

    const listEl = document.getElementById('solutionsList');
    listEl.innerHTML = solutions.map((s, i) => `
      <div class="solution" data-idx="${i}" data-label="${s.label}" data-text="${esc(s.text)}">
        <div class="sol-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg></div>
        <div class="sol-label">${s.label}</div>
        <div class="sol-text">${esc(s.text)}</div>
      </div>
    `).join('');

    listEl.querySelectorAll('.solution').forEach(el => {
      el.addEventListener('click', () => {
        listEl.querySelectorAll('.solution').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
        selectedSolution = { label: el.dataset.label, text: el.dataset.text };
        document.getElementById('applyBtn').disabled = false;
      });
    });

    document.getElementById('step2').classList.add('visible');
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Step 2: Apply solution ──
  document.getElementById('applyBtn').addEventListener('click', async () => {
    if (!selectedSolution) return;

    const btn = document.getElementById('applyBtn');
    btn.disabled = true;
    btn.classList.add('applying');

    const reason = document.getElementById('reason').value.trim();
    const category = document.getElementById('category').value;
    let name = missedPromise.name + ' (revised)';
    let content = selectedSolution.text;
    let deadline = '24h';

    if (llm) {
      try {
        setStatus(status2El, 'AI is refining your new promise...');
        const updated = await llm.generateUpdatedPromise(
          missedPromise.content, reason, category, selectedSolution.label
        );
        const parsed = llm.parseUpdate(updated);
        if (parsed.name) name = parsed.name;
        if (parsed.promise) content = parsed.promise;
        if (parsed.deadline) deadline = parsed.deadline;
      } catch (err) {
        console.warn('LLM update failed, using defaults:', err.message);
      }
    }

    try {
      setStatus(status2El, 'Saving...');
      const body = new FormData();
      body.append('name', name);
      body.append('content', content);
      body.append('deadline', deadline);

      const id = missedPromise.id;
      const res = await fetch(`/api/reframe/${id}/apply`, { method: 'POST', body, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to apply');
      }

      // Show success state
      document.getElementById('step2').classList.remove('visible');
      document.querySelector('.promise-card').style.display = 'none';
      document.querySelector('.reframe-header').style.display = 'none';
      document.getElementById('successState').classList.add('visible');

      setTimeout(() => { window.location.href = '/dashboard'; }, 2200);
    } catch (err) {
      setStatus(status2El, err.message, 'error');
      btn.disabled = false;
      btn.classList.remove('applying');
    }
  });

  // ── Back button ──
  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('step2').classList.remove('visible');
    const step1 = document.getElementById('step1');
    step1.style.display = '';
    step1.classList.remove('step-leaving');
    selectedSolution = null;
  });

  loadMissed();

  // Shared logout behavior
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await logout(); } catch (_) {}
      window.location.href = '/';
    });
  }
