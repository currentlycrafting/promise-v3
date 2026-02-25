/**
 * Notifications (Phase 5).
 * Types: friend_request, friend_accepted, shared_promise_complete, shared_promise_pending, shared_promise_reneged, system_corrupt_promise, reminder
 */

export const NOTIFICATION_TYPES = {
  friend_request: 'friend_request',
  friend_accepted: 'friend_accepted',
  shared_promise_complete: 'shared_promise_complete',
  shared_promise_pending: 'shared_promise_pending',
  shared_promise_reneged: 'shared_promise_reneged',
  system_corrupt_promise: 'system_corrupt_promise',
  reminder: 'reminder',
};

export function initNotifications(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      from_user_id INTEGER,
      related_id INTEGER,
      message TEXT,
      read_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id)
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at)');
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function createNotification(db, { userId, type, fromUserId = null, relatedId = null, message = null }) {
  const created_at = nowSeconds();
  db.prepare(`
    INSERT INTO notifications (user_id, type, from_user_id, related_id, message, read_at, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `).run(userId, type, fromUserId, relatedId, message, created_at);
}

export function getUnreadCount(db, userId) {
  const row = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId);
  return row ? row.c : 0;
}

export function getNotifications(db, userId, limit = 50) {
  const rows = db.prepare(`
    SELECT n.*, u.name as from_name, u.display_name as from_display_name, u.avatar_path as from_avatar_path, u.picture_url as from_picture_url
    FROM notifications n
    LEFT JOIN users u ON u.id = n.from_user_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `).all(userId, limit);
  return rows;
}

export function markRead(db, notificationId, userId) {
  const now = nowSeconds();
  const result = db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(now, notificationId, userId);
  return result.changes > 0;
}

export function markAllRead(db, userId) {
  const now = nowSeconds();
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now, userId);
}
