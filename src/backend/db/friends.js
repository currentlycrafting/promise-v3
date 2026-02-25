/**
 * Friends and friend_requests (Phase 3).
 * Prevents duplicate requests, self-add, and duplicate friendships.
 */

export function initFriends(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(from_user_id, to_user_id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id),
      CHECK (from_user_id != to_user_id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (friend_id) REFERENCES users(id),
      CHECK (user_id != friend_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id)`);
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function sendRequest(db, fromUserId, toUserId) {
  if (fromUserId === toUserId) return { error: 'Cannot send request to yourself' };
  const toUser = db.prepare('SELECT id FROM users WHERE id = ?').get(toUserId);
  if (!toUser) return { error: 'User not found' };
  const existing = db.prepare('SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').get(fromUserId, toUserId);
  if (existing) return { error: 'Friend request already sent' };
  const reverse = db.prepare('SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').get(toUserId, fromUserId);
  if (reverse) return { error: 'They already sent you a request. Accept it instead.' };
  if (isFriend(db, fromUserId, toUserId)) return { error: 'Already friends' };
  const now = nowIso();
  const result = db.prepare('INSERT INTO friend_requests (from_user_id, to_user_id, created_at) VALUES (?, ?, ?)').run(fromUserId, toUserId, now);
  return { request: db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(result.lastInsertRowid) };
}

export function getIncomingRequests(db, userId) {
  const rows = db.prepare(`
    SELECT fr.*, u.id as from_id, u.name as from_name, u.display_name as from_display_name, u.email as from_email, u.picture_url as from_picture_url, u.avatar_path as from_avatar_path
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id = ?
    ORDER BY fr.created_at DESC
  `).all(userId);
  return rows;
}

export function getOutgoingRequests(db, userId) {
  const rows = db.prepare(`
    SELECT fr.*, u.id as to_id, u.name as to_name, u.display_name as to_display_name, u.email as to_email, u.picture_url as to_picture_url, u.avatar_path as to_avatar_path
    FROM friend_requests fr
    JOIN users u ON u.id = fr.to_user_id
    WHERE fr.from_user_id = ?
    ORDER BY fr.created_at DESC
  `).all(userId);
  return rows;
}

export function getRequestById(db, requestId) {
  return db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(requestId);
}

export function acceptRequest(db, requestId, acceptedByUserId) {
  const req = getRequestById(db, requestId);
  if (!req) return { error: 'Request not found' };
  if (req.to_user_id !== acceptedByUserId) return { error: 'You can only accept requests sent to you' };
  const now = nowIso();
  db.prepare('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?), (?, ?, ?)').run(req.from_user_id, req.to_user_id, now, req.to_user_id, req.from_user_id, now);
  db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
  return { ok: true };
}

export function declineRequest(db, requestId, declinedByUserId) {
  const req = getRequestById(db, requestId);
  if (!req) return { error: 'Request not found' };
  if (req.to_user_id !== declinedByUserId) return { error: 'You can only decline requests sent to you' };
  db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
  return { ok: true };
}

export function cancelRequest(db, requestId, userId) {
  const req = getRequestById(db, requestId);
  if (!req) return { error: 'Request not found' };
  if (req.from_user_id !== userId) return { error: 'You can only cancel your own requests' };
  db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
  return { ok: true };
}

export function isFriend(db, userId, friendId) {
  const row = db.prepare('SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
  return !!row;
}

export function hasPendingRequest(db, fromUserId, toUserId) {
  const a = db.prepare('SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').get(fromUserId, toUserId);
  const b = db.prepare('SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?').get(toUserId, fromUserId);
  return !!(a || b);
}

export function getFriends(db, userId) {
  const rows = db.prepare(`
    SELECT u.* FROM users u
    JOIN friendships f ON f.friend_id = u.id
    WHERE f.user_id = ?
    ORDER BY u.display_name, u.name
  `).all(userId);
  return rows;
}

export function getMutualCount(db, userId, friendId) {
  const myFriends = new Set(db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').all(userId).map(r => r.friend_id));
  const theirFriends = db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').all(friendId).map(r => r.friend_id);
  return theirFriends.filter(id => id !== userId && myFriends.has(id)).length;
}

export function removeFriend(db, userId, friendId) {
  if (userId === friendId) return { error: 'Invalid' };
  db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(userId, friendId, friendId, userId);
  return { ok: true };
}
