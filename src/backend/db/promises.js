import crypto from 'crypto';

const PROMISE_TYPES = { self: 'self', others: 'others', other: 'others', world: 'world' };

export function initPromises(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      promise_type TEXT,
      content TEXT,
      created_at INTEGER,
      deadline_at INTEGER,
      status TEXT,
      hash_value TEXT,
      participants TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  const cols = db.prepare('PRAGMA table_info(promises)').all().map((r) => r.name);
  if (!cols.includes('user_id')) db.exec('ALTER TABLE promises ADD COLUMN user_id INTEGER REFERENCES users(id)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS promise_participants (
      promise_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      completed_at INTEGER,
      PRIMARY KEY (promise_id, user_id),
      FOREIGN KEY (promise_id) REFERENCES promises(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_promise_participants_promise ON promise_participants(promise_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_promise_participants_user ON promise_participants(user_id)');
  db.prepare('UPDATE promises SET user_id = 1 WHERE user_id IS NULL').run();

  // Phase 6: category, recurrence, progress, visibility, reminders
  const pcols = db.prepare('PRAGMA table_info(promises)').all().map((r) => r.name);
  if (!pcols.includes('category')) db.exec('ALTER TABLE promises ADD COLUMN category TEXT');
  if (!pcols.includes('recurrence')) db.exec('ALTER TABLE promises ADD COLUMN recurrence TEXT');
  if (!pcols.includes('parent_promise_id')) db.exec('ALTER TABLE promises ADD COLUMN parent_promise_id INTEGER');
  if (!pcols.includes('target_value')) db.exec('ALTER TABLE promises ADD COLUMN target_value INTEGER');
  if (!pcols.includes('current_value')) db.exec('ALTER TABLE promises ADD COLUMN current_value INTEGER');
  if (!pcols.includes('visibility')) db.exec('ALTER TABLE promises ADD COLUMN visibility TEXT DEFAULT "private"');
  if (!pcols.includes('reminder_at')) db.exec('ALTER TABLE promises ADD COLUMN reminder_at INTEGER');
  if (!pcols.includes('reminder_sent')) db.exec('ALTER TABLE promises ADD COLUMN reminder_sent INTEGER DEFAULT 0');

  db.exec(`
    CREATE TABLE IF NOT EXISTS promise_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promise_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      FOREIGN KEY (promise_id) REFERENCES promises(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_promise_completions_promise ON promise_completions(promise_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_promise_completions_user ON promise_completions(user_id)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS promise_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promise_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      parent_comment_id INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (promise_id) REFERENCES promises(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_comment_id) REFERENCES promise_comments(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_promise_comments_promise ON promise_comments(promise_id)');
  const commentCols = db.prepare('PRAGMA table_info(promise_comments)').all().map((r) => r.name);
  if (!commentCols.includes('parent_comment_id')) db.exec('ALTER TABLE promise_comments ADD COLUMN parent_comment_id INTEGER REFERENCES promise_comments(id)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS promise_comment_likes (
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES promise_comments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_promise_comment_likes_comment ON promise_comment_likes(comment_id)');
}

export function hashPromise(promiseId, createdAt, name, promiseType, content) {
  return crypto.createHash('sha256').update(`${promiseId}|${createdAt}|${name}|${promiseType}|${content}`).digest('hex');
}

export function parseDuration(value) {
  if (!value || typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  const matches = text.matchAll(/(\d+)\s*(d|h|m|s)/g);
  let total = 0;
  for (const [, a, u] of matches) {
    total += parseInt(a, 10) * (u === 'd' ? 86400 : u === 'h' ? 3600 : u === 'm' ? 60 : 1);
  }
  return total || null;
}

export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const rem = totalSeconds % 3600;
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return parts.join(' ');
}

/** Promises visible to userId: owned by them or they are a participant. */
function getVisiblePromiseIds(db, userId) {
  const owned = db.prepare('SELECT id FROM promises WHERE user_id = ?').all(userId).map((r) => r.id);
  const participated = db.prepare('SELECT promise_id FROM promise_participants WHERE user_id = ?').all(userId).map((r) => r.promise_id);
  const ids = [...new Set([...owned, ...participated])];
  return ids.length ? ids : [0];
}

export function getDashboardState(db, userId) {
  const now = Math.floor(Date.now() / 1000);
  const visibleIds = getVisiblePromiseIds(db, userId);
  const placeholders = visibleIds.map(() => '?').join(',');
  db.prepare(`UPDATE promises SET status = 'MISSED' WHERE status = 'ACTIVE' AND deadline_at <= ? AND id IN (${placeholders})`).run(now, ...visibleIds);
  const missed = db.prepare(`SELECT * FROM promises WHERE status = 'MISSED' AND id IN (${placeholders}) ORDER BY deadline_at ASC LIMIT 1`).get(...visibleIds);
  const activeRows = db.prepare(`SELECT * FROM promises WHERE status = 'ACTIVE' AND id IN (${placeholders}) ORDER BY deadline_at ASC`).all(...visibleIds);
  const active = activeRows.map((p) => ({
    ...p,
    time_left: formatDuration(Math.max(p.deadline_at - now, 0)),
  }));
  return { active, missed };
}

export function getPromiseById(db, id) {
  return db.prepare('SELECT * FROM promises WHERE id = ?').get(id);
}

export function getPromiseParticipants(db, promiseId) {
  return db.prepare(`
    SELECT pp.user_id, pp.completed_at, u.name, u.display_name, u.picture_url, u.avatar_path
    FROM promise_participants pp
    JOIN users u ON u.id = pp.user_id
    WHERE pp.promise_id = ?
    ORDER BY pp.completed_at IS NULL DESC, pp.user_id
  `).all(promiseId);
}

export function isSharedPromise(db, promiseId) {
  const count = db.prepare('SELECT COUNT(*) as c FROM promise_participants WHERE promise_id = ?').get(promiseId);
  return count && count.c > 0;
}

export function setParticipantCompleted(db, promiseId, userId) {
  db.prepare('UPDATE promise_participants SET completed_at = ? WHERE promise_id = ? AND user_id = ?')
    .run(Math.floor(Date.now() / 1000), promiseId, userId);
}

export function areAllParticipantsCompleted(db, promiseId) {
  const rows = db.prepare('SELECT completed_at FROM promise_participants WHERE promise_id = ?').all(promiseId);
  return rows.length > 0 && rows.every((r) => r.completed_at != null);
}

export function addPromiseParticipants(db, promiseId, userIds) {
  const insert = db.prepare('INSERT OR IGNORE INTO promise_participants (promise_id, user_id, completed_at) VALUES (?, ?, NULL)');
  for (const uid of userIds) {
    insert.run(promiseId, uid);
  }
}

export function logCompletion(db, promiseId, userId) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO promise_completions (promise_id, user_id, completed_at) VALUES (?, ?, ?)').run(promiseId, userId, now);
}

export function getStreakForPromise(db, promiseId, userId) {
  const rows = db.prepare('SELECT completed_at FROM promise_completions WHERE promise_id = ? AND user_id = ? ORDER BY completed_at DESC LIMIT 100').all(promiseId, userId);
  return rows.length;
}

export function getComments(db, promiseId, viewerUserId = 0) {
  return db.prepare(`
    SELECT c.*, u.name, u.display_name, u.avatar_path, u.picture_url
      , (SELECT COUNT(*) FROM promise_comment_likes l WHERE l.comment_id = c.id) AS like_count
      , EXISTS(SELECT 1 FROM promise_comment_likes l2 WHERE l2.comment_id = c.id AND l2.user_id = ?) AS liked_by_me
    FROM promise_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.promise_id = ?
    ORDER BY c.created_at ASC
  `).all(viewerUserId, promiseId);
}

export function addComment(db, promiseId, userId, body, parentCommentId = null) {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('INSERT INTO promise_comments (promise_id, user_id, body, parent_comment_id, created_at) VALUES (?, ?, ?, ?, ?)').run(promiseId, userId, body.trim(), parentCommentId, now);
  return db.prepare('SELECT * FROM promise_comments WHERE id = ?').get(result.lastInsertRowid);
}

export function toggleCommentLike(db, commentId, userId) {
  const existing = db.prepare('SELECT 1 FROM promise_comment_likes WHERE comment_id = ? AND user_id = ?').get(commentId, userId);
  if (existing) {
    db.prepare('DELETE FROM promise_comment_likes WHERE comment_id = ? AND user_id = ?').run(commentId, userId);
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO promise_comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)').run(commentId, userId, now);
  return true;
}

export function getActivityFeed(db, userId, limit = 25) {
  const visibleIds = getVisiblePromiseIds(db, userId);
  const placeholders = visibleIds.map(() => '?').join(',');
  const completed = db.prepare(`
    SELECT p.id, p.name, p.deadline_at, pc.completed_at, pc.user_id
    FROM promise_completions pc
    JOIN promises p ON p.id = pc.promise_id
    WHERE pc.user_id = ? AND p.id IN (${placeholders})
    ORDER BY pc.completed_at DESC LIMIT ?
  `).all(userId, ...visibleIds, limit);
  const created = db.prepare(`
    SELECT id, name, created_at FROM promises WHERE user_id = ? AND id IN (${placeholders}) ORDER BY created_at DESC LIMIT ?
  `).all(userId, ...visibleIds, limit);
  return { completed, created };
}

export function getAccountabilityScore(db, userId) {
  const visibleIds = getVisiblePromiseIds(db, userId);
  const placeholders = visibleIds.map(() => '?').join(',');
  const completed = db.prepare(`SELECT COUNT(*) as c FROM promises WHERE status = 'COMPLETED' AND user_id = ?`).get(userId);
  const missed = db.prepare(`SELECT COUNT(*) as c FROM promises WHERE status = 'MISSED' AND user_id = ?`).get(userId);
  const total = (completed?.c ?? 0) + (missed?.c ?? 0);
  if (total === 0) return null;
  return Math.round(((completed?.c ?? 0) / total) * 100);
}

export function getPromisesNeedingReminder(db, userId) {
  const now = Math.floor(Date.now() / 1000);
  return db.prepare(`
    SELECT id, name, deadline_at, reminder_at FROM promises
    WHERE status = 'ACTIVE' AND user_id = ?
    AND reminder_at IS NOT NULL AND (reminder_sent IS NULL OR reminder_sent = 0) AND reminder_at <= ?
  `).all(userId, now);
}

export function markReminderSent(db, promiseId) {
  db.prepare('UPDATE promises SET reminder_sent = 1 WHERE id = ?').run(promiseId);
}

export const RECURRENCE = { daily: 86400, weekly: 604800, monthly: 2592000 };
export const VISIBILITY = { private: 'private', friends: 'friends', public: 'public' };
export const DEFAULT_CATEGORIES = ['Health', 'Work', 'Personal', 'Social', 'Learning', 'Other'];

export { PROMISE_TYPES };
