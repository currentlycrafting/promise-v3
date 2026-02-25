/**
 * User store (replication guide 3.6).
 * Phase 2: + display_name, bio, timezone, profile_visibility, avatar_path.
 */

export function initUsers(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      name TEXT,
      picture_url TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    )
  `);
  // Phase 2 profile columns (add if missing)
  const cols = db.prepare("PRAGMA table_info(users)").all().map((r) => r.name);
  if (!cols.includes('display_name')) db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  if (!cols.includes('bio')) db.exec('ALTER TABLE users ADD COLUMN bio TEXT');
  if (!cols.includes('timezone')) db.exec('ALTER TABLE users ADD COLUMN timezone TEXT');
  if (!cols.includes('profile_visibility')) db.exec('ALTER TABLE users ADD COLUMN profile_visibility TEXT DEFAULT "public"');
  if (!cols.includes('avatar_path')) db.exec('ALTER TABLE users ADD COLUMN avatar_path TEXT');
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function upsertUser(db, { google_sub, email, name, picture_url }) {
  const now = nowIso();
  const existing = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(google_sub);
  if (existing) {
    db.prepare(`
      UPDATE users SET email = ?, name = ?, picture_url = ?, last_login_at = ?
      WHERE id = ?
    `).run(email ?? existing.email, name ?? existing.name, picture_url ?? existing.picture_url, now, existing.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
  }
  const result = db.prepare(`
    INSERT INTO users (google_sub, email, name, picture_url, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(google_sub, email ?? '', name ?? null, picture_url ?? null, now, now);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

export function getUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

/** Search by name or email; exclude userId. Optional: only public profiles. */
export function searchUsers(db, query, excludeUserId, publicOnly = true) {
  const q = `%${String(query).trim()}%`;
  let sql = `
    SELECT * FROM users
    WHERE id != ?
    AND (name LIKE ? OR display_name LIKE ? OR email LIKE ?)
  `;
  const params = [excludeUserId, q, q, q];
  if (publicOnly) {
    sql += ` AND (profile_visibility IS NULL OR profile_visibility = 'public')`;
  }
  sql += ` ORDER BY name, display_name LIMIT 25`;
  return db.prepare(sql).all(...params);
}

export function updateProfile(db, userId, { display_name, bio, timezone, profile_visibility }) {
  const u = getUserById(db, userId);
  if (!u) return null;
  db.prepare(`
    UPDATE users SET display_name = ?, bio = ?, timezone = ?, profile_visibility = ?
    WHERE id = ?
  `).run(
    display_name !== undefined ? display_name : u.display_name,
    bio !== undefined ? bio : u.bio,
    timezone !== undefined ? timezone : u.timezone,
    profile_visibility !== undefined ? profile_visibility : (u.profile_visibility || 'public'),
    userId
  );
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function updateUserAvatar(db, userId, avatar_path) {
  db.prepare('UPDATE users SET avatar_path = ? WHERE id = ?').run(avatar_path, userId);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function userToJson(u) {
  const avatarUrl = u.avatar_path ? `/uploads/${u.avatar_path}` : (u.picture_url || null);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    display_name: u.display_name ?? null,
    bio: u.bio ?? null,
    timezone: u.timezone ?? null,
    profile_visibility: u.profile_visibility || 'public',
    picture_url: u.picture_url ?? null,
    avatar_url: avatarUrl,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  };
}
