import { searchUsers, userToJson } from '../db/users.js';

export function userRoutes(db) {
  return {
    search(req, res) {
      const userId = req.session.userId;
      const q = (req.query.q || '').trim();
      if (!q || q.length < 2) {
        return res.json({ users: [] });
      }
      const rows = searchUsers(db, q, userId);
      const friendIds = new Set(
        db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').all(userId).map((r) => r.friend_id)
      );
      const pendingFrom = new Set(
        db.prepare('SELECT to_user_id FROM friend_requests WHERE from_user_id = ?').all(userId).map((r) => r.to_user_id)
      );
      const pendingTo = new Set(
        db.prepare('SELECT from_user_id FROM friend_requests WHERE to_user_id = ?').all(userId).map((r) => r.from_user_id)
      );
      const users = rows.map((u) => {
        const json = userToJson(u);
        json.is_friend = friendIds.has(u.id);
        json.pending_request_sent = pendingFrom.has(u.id);
        json.pending_request_received = pendingTo.has(u.id);
        return json;
      });
      res.json({ users });
    },
  };
}
