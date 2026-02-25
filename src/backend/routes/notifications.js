import { getUnreadCount, getNotifications, markRead, markAllRead } from '../db/notifications.js';
import { parseLimit, parseParamId } from '../lib/http/validators.js';
import { sendNotFound } from '../lib/http/responders.js';

export function notificationRoutes(db) {
  return {
    list(req, res) {
      const userId = req.session.userId;
      const limit = parseLimit(req.query, 50, 100);
      const rows = getNotifications(db, userId, limit);
      res.json({
        notifications: rows.map((r) => ({
          id: r.id,
          type: r.type,
          from_user_id: r.from_user_id,
          from_name: r.from_display_name || r.from_name,
          from_avatar_url: r.from_avatar_path ? `/uploads/${r.from_avatar_path}` : (r.from_picture_url || null),
          related_id: r.related_id,
          message: r.message,
          read_at: r.read_at,
          created_at: r.created_at,
        })),
      });
    },

    unreadCount(req, res) {
      const count = getUnreadCount(db, req.session.userId);
      res.json({ count });
    },

    markRead(req, res) {
      const id = parseParamId(req.params);
      const ok = markRead(db, id, req.session.userId);
      if (!ok) return sendNotFound(res);
      res.json({ ok: true });
    },

    markAllRead(req, res) {
      markAllRead(db, req.session.userId);
      res.json({ ok: true });
    },
  };
}
