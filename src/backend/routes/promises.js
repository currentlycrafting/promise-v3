import { isFriend } from '../db/friends.js';
import { createNotification } from '../db/notifications.js';
import {
  getDashboardState,
  getPromiseById,
  getPromiseParticipants,
  isSharedPromise,
  setParticipantCompleted,
  addPromiseParticipants,
  logCompletion,
  getStreakForPromise,
  getComments,
  addComment,
  toggleCommentLike,
  getActivityFeed,
  getAccountabilityScore,
  getPromisesNeedingReminder,
  markReminderSent,
  hashPromise,
  parseDuration,
  PROMISE_TYPES,
  RECURRENCE,
  VISIBILITY,
  DEFAULT_CATEGORIES,
} from '../db/promises.js';

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function participantToJson(row) {
  const u = { ...row, avatar_path: row.avatar_path };
  return {
    user_id: row.user_id,
    display_name: row.display_name || row.name,
    name: row.name,
    avatar_url: row.avatar_path ? `/uploads/${row.avatar_path}` : (row.picture_url || null),
    completed_at: row.completed_at,
  };
}

export function promiseRoutes(db) {
  return {
    list(req, res) {
      const userId = req.session.userId;
      const { active, missed } = getDashboardState(db, userId);
      const needingReminder = getPromisesNeedingReminder(db, userId);
      needingReminder.forEach((p) => {
        createNotification(db, { userId, type: 'reminder', fromUserId: null, relatedId: p.id, message: p.name });
        markReminderSent(db, p.id);
      });
      const score = getAccountabilityScore(db, userId);
      const promises = active.map((p) => {
        const participants = getPromiseParticipants(db, p.id);
        const shared = participants.length > 0;
        const streak = getStreakForPromise(db, p.id, userId);
        const comments = getComments(db, p.id);
        return {
          id: p.id,
          name: p.name,
          content: p.content,
          promise_type: p.promise_type,
          status: p.status,
          deadline_at: p.deadline_at,
          time_left: p.time_left,
          participants: p.participants,
          shared,
          participant_list: participants.map(participantToJson),
          category: p.category || null,
          recurrence: p.recurrence || null,
          target_value: p.target_value ?? null,
          current_value: p.current_value ?? null,
          visibility: p.visibility || 'private',
          reminder_at: p.reminder_at ?? null,
          streak_count: streak,
          comment_count: comments.length,
        };
      });
      let missedJson = null;
      if (missed) {
        const participants = getPromiseParticipants(db, missed.id);
        missedJson = {
          id: missed.id,
          name: missed.name,
          content: missed.content,
          promise_type: missed.promise_type,
          status: missed.status,
          deadline_at: missed.deadline_at,
          participants: missed.participants,
          shared: participants.length > 0,
          participant_list: participants.map(participantToJson),
          category: missed.category || null,
          recurrence: missed.recurrence || null,
          target_value: missed.target_value ?? null,
          current_value: missed.current_value ?? null,
          visibility: missed.visibility || 'private',
        };
      }
      res.json({ promises, missed: missedJson, accountability_score: score });
    },

    getOne(req, res) {
      const p = getPromiseById(db, parseInt(req.params.promise_id, 10));
      if (!p) return res.status(404).json({ detail: 'Not found' });
      const participants = getPromiseParticipants(db, p.id);
      const comments = getComments(db, p.id);
      const streak = getStreakForPromise(db, p.id, req.session.userId);
      res.json({
        id: p.id,
        name: p.name,
        content: p.content,
        promise_type: p.promise_type,
        status: p.status,
        deadline_at: p.deadline_at,
        participants: p.participants,
        shared: participants.length > 0,
        participant_list: participants.map(participantToJson),
        category: p.category || null,
        recurrence: p.recurrence || null,
        target_value: p.target_value ?? null,
        current_value: p.current_value ?? null,
        visibility: p.visibility || 'private',
        reminder_at: p.reminder_at ?? null,
        streak_count: streak,
        comments: comments.map((c) => ({
          id: c.id,
          user_id: c.user_id,
          author_name: c.display_name || c.name,
          author_avatar: c.avatar_path ? `/uploads/${c.avatar_path}` : (c.picture_url || null),
          body: c.body,
          created_at: c.created_at,
        })),
      });
    },

    create(req, res) {
      const userId = req.session.userId;
      let { name, promise_type, content, deadline, participant_user_ids, category, recurrence, visibility, target_value, current_value, reminder_hours, reminder_value, reminder_unit } = req.body;
      if (!PROMISE_TYPES[promise_type]) promise_type = 'self';
      const deadlineSeconds = parseDuration(deadline);
      if (!deadlineSeconds) {
        return res.status(400).json({ detail: 'Invalid deadline format e.g. 1h 30m' });
      }
      const created_at = nowSeconds();
      let deadline_at = created_at + deadlineSeconds;
      const vis = visibility && VISIBILITY[visibility] ? visibility : 'private';
      const targetVal = target_value != null ? parseInt(target_value, 10) : null;
      const currentValRaw = current_value != null ? parseInt(current_value, 10) : null;
      let currentVal = null;
      if (targetVal != null && !Number.isNaN(targetVal) && targetVal > 0) {
        if (currentValRaw != null && !Number.isNaN(currentValRaw) && currentValRaw >= 0) {
          currentVal = Math.min(currentValRaw, targetVal);
        } else {
          currentVal = 0;
        }
      }
      let reminder_at = null;
      if (reminder_value != null && reminder_unit) {
        const rv = parseInt(reminder_value, 10);
        if (!Number.isNaN(rv) && rv > 0) {
          const unit = String(reminder_unit).toLowerCase();
          const sec = unit.startsWith('min') ? 60 : unit.startsWith('hour') ? 3600 : 86400;
          reminder_at = deadline_at - rv * sec;
        }
      }
      if (reminder_at == null && reminder_hours != null) {
        const rh = parseInt(reminder_hours, 10);
        if (!Number.isNaN(rh) && rh > 0) reminder_at = deadline_at - rh * 3600;
      }
      const hash_value = hashPromise(0, created_at, name, promise_type, content);

      const isOthers = promise_type === 'others' || promise_type === 'other';
      let participantIds = [];
      if (isOthers && participant_user_ids != null) {
        let raw = participant_user_ids;
        if (typeof raw === 'string') {
          try { raw = JSON.parse(raw); } catch { raw = []; }
        }
        if (!Array.isArray(raw)) raw = [raw].filter(Boolean);
        const ids = raw.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n) && n !== userId);
        for (const fid of ids) {
          if (!isFriend(db, userId, fid)) return res.status(400).json({ detail: 'Can only add friends as participants' });
        }
        participantIds = [...new Set([userId, ...ids])];
      }

      const result = db
        .prepare(
          `INSERT INTO promises (user_id, name, promise_type, content, created_at, deadline_at, status, hash_value, participants, category, recurrence, target_value, current_value, visibility, reminder_at)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(userId, name, promise_type, content, created_at, deadline_at, hash_value, null, category || null, recurrence || null, targetVal, currentVal, vis, reminder_at);
      const id = result.lastInsertRowid;
      const newHash = hashPromise(id, created_at, name, promise_type, content);
      db.prepare('UPDATE promises SET hash_value = ? WHERE id = ?').run(newHash, id);

      if (participantIds.length > 0) addPromiseParticipants(db, id, participantIds);

      res.json({ id, status: 'created' });
    },

    complete(req, res) {
      const id = parseInt(req.params.promise_id, 10);
      const userId = req.session.userId;
      const p = getPromiseById(db, id);
      if (!p) return res.status(404).json({ detail: 'Not found' });
      if (isSharedPromise(db, id)) {
        setParticipantCompleted(db, id, userId);
        const participants = getPromiseParticipants(db, id);
        const allDone = participants.every((r) => r.completed_at != null);
        if (allDone) {
          db.prepare("UPDATE promises SET status = 'COMPLETED' WHERE id = ?").run(id);
          participants.forEach((r) => {
            if (r.user_id !== userId) createNotification(db, { userId: r.user_id, type: 'shared_promise_complete', fromUserId: userId, relatedId: id, message: p.name });
          });
        } else {
          participants.forEach((r) => {
            if (r.user_id !== userId && r.completed_at == null) {
              createNotification(db, { userId: r.user_id, type: 'shared_promise_pending', fromUserId: userId, relatedId: id, message: p.name });
            }
          });
        }
        return res.json({ status: allDone ? 'completed' : 'marked_complete', participant_list: participants.map(participantToJson) });
      }
      logCompletion(db, id, userId);
      db.prepare("UPDATE promises SET status = 'COMPLETED' WHERE id = ?").run(id);
      res.json({ status: 'completed', next_promise_id: null });
    },

    undoComplete(req, res) {
      const id = parseInt(req.params.promise_id, 10);
      const userId = req.session.userId;
      const p = getPromiseById(db, id);
      if (!p) return res.status(404).json({ detail: 'Not found' });

      if (isSharedPromise(db, id)) {
        const me = db.prepare('SELECT completed_at FROM promise_participants WHERE promise_id = ? AND user_id = ?').get(id, userId);
        if (!me) return res.status(403).json({ detail: 'Forbidden' });
        const wasCompleted = me.completed_at != null;
        // Re-open shared promise by undoing only current user's completion.
        db.prepare('UPDATE promise_participants SET completed_at = NULL WHERE promise_id = ? AND user_id = ?').run(id, userId);
        db.prepare("UPDATE promises SET status = 'ACTIVE' WHERE id = ?").run(id);
        if (wasCompleted) {
          const participants = getPromiseParticipants(db, id);
          participants.forEach((r) => {
            if (r.user_id !== userId) {
              createNotification(db, {
                userId: r.user_id,
                type: 'shared_promise_reneged',
                fromUserId: userId,
                relatedId: id,
                message: p.name,
              });
            }
          });
        }
        return res.json({ status: 'active' });
      }

      if (p.user_id !== userId) return res.status(403).json({ detail: 'Forbidden' });

      // Re-open solo promise and remove latest completion log for this user.
      db.prepare("UPDATE promises SET status = 'ACTIVE' WHERE id = ?").run(id);
      db.prepare(`
        DELETE FROM promise_completions
        WHERE id = (
          SELECT id FROM promise_completions
          WHERE promise_id = ? AND user_id = ?
          ORDER BY completed_at DESC, id DESC
          LIMIT 1
        )
      `).run(id, userId);
      res.json({ status: 'active' });
    },

    forfeit(req, res) {
      const id = parseInt(req.params.promise_id, 10);
      const p = getPromiseById(db, id);
      if (!p) return res.status(404).json({ detail: 'Not found' });
      db.prepare("UPDATE promises SET status = 'MISSED' WHERE id = ?").run(id);
      res.json({ status: 'missed' });
    },

    update(req, res) {
      const id = parseInt(req.params.promise_id, 10);
      const userId = req.session.userId;
      const p = getPromiseById(db, id);
      if (!p) return res.status(404).json({ detail: 'Not found' });
      if (p.user_id !== userId) return res.status(403).json({ detail: 'Forbidden' });
      const { name, content, deadline } = req.body;
      const updates = [];
      const params = [];
      if (name != null && String(name).trim()) {
        updates.push('name = ?');
        params.push(name.trim());
      }
      if (content != null) {
        updates.push('content = ?');
        params.push(String(content));
      }
      if (deadline != null) {
        const sec = parseDuration(deadline);
        if (sec != null) {
          const newDeadlineAt = (p.created_at || nowSeconds()) + sec;
          updates.push('deadline_at = ?');
          params.push(newDeadlineAt);
        }
      }
      if (updates.length === 0) return res.status(400).json({ detail: 'No fields to update' });
      const sql = 'UPDATE promises SET ' + updates.join(', ') + ' WHERE id = ?';
      params.push(id);
      db.prepare(sql).run(...params);
      res.json({ id, status: 'updated' });
    },

    updateProgress(req, res) {
      const id = parseInt(req.params.promise_id, 10);
      const userId = req.session.userId;
      const p = getPromiseById(db, id);
      if (!p) return res.status(404).json({ detail: 'Not found' });
      if (p.user_id !== userId) return res.status(403).json({ detail: 'Forbidden' });
      const current_value = parseInt(req.body.current_value, 10);
      if (Number.isNaN(current_value) || current_value < 0) return res.status(400).json({ detail: 'Invalid current_value' });
      const target = p.target_value ?? current_value;
      const capped = Math.min(current_value, target);
      db.prepare('UPDATE promises SET current_value = ? WHERE id = ?').run(capped, id);

      // Auto-complete when progress reaches the target.
      if (p.target_value != null && p.target_value > 0 && capped >= p.target_value && p.status === 'ACTIVE') {
        if (isSharedPromise(db, id)) {
          setParticipantCompleted(db, id, userId);
          const participants = getPromiseParticipants(db, id);
          const allDone = participants.length > 0 && participants.every((r) => r.completed_at != null);
          if (allDone) {
            db.prepare("UPDATE promises SET status = 'COMPLETED' WHERE id = ?").run(id);
            participants.forEach((r) => {
              if (r.user_id !== userId) {
                createNotification(db, { userId: r.user_id, type: 'shared_promise_complete', fromUserId: userId, relatedId: id, message: p.name });
              }
            });
            return res.json({ current_value: capped, target_value: target, status: 'completed' });
          }
          return res.json({ current_value: capped, target_value: target, status: 'marked_complete' });
        }

        logCompletion(db, id, userId);
        db.prepare("UPDATE promises SET status = 'COMPLETED' WHERE id = ?").run(id);
        return res.json({ current_value: capped, target_value: target, status: 'completed' });
      }

      res.json({ current_value: capped, target_value: target, status: 'active' });
    },

    getComments(req, res) {
      const id = parseInt(req.params.promise_id, 10);
      const p = getPromiseById(db, id);
      if (!p) return res.status(404).json({ detail: 'Not found' });
      const comments = getComments(db, id, req.session.userId);
      res.json({
        comments: comments.map((c) => ({
          id: c.id,
          user_id: c.user_id,
          author_name: c.display_name || c.name,
          author_avatar: c.avatar_path ? `/uploads/${c.avatar_path}` : (c.picture_url || null),
          body: c.body,
          parent_comment_id: c.parent_comment_id ?? null,
          like_count: c.like_count ?? 0,
          liked_by_me: !!c.liked_by_me,
          created_at: c.created_at,
        })),
      });
    },

    postComment(req, res) {
      const id = parseInt(req.params.promise_id, 10);
      const userId = req.session.userId;
      const p = getPromiseById(db, id);
      if (!p) return res.status(404).json({ detail: 'Not found' });
      const body = req.body.body || req.body.comment || '';
      if (!body.trim()) return res.status(400).json({ detail: 'Comment body required' });
      const parentCommentIdRaw = req.body.parent_comment_id;
      const parentCommentId = parentCommentIdRaw != null ? parseInt(parentCommentIdRaw, 10) : null;
      const comment = addComment(db, id, userId, body, Number.isNaN(parentCommentId) ? null : parentCommentId);
      res.status(201).json({
        id: comment.id,
        user_id: comment.user_id,
        body: comment.body,
        parent_comment_id: comment.parent_comment_id ?? null,
        created_at: comment.created_at,
      });
    },

    toggleCommentLike(req, res) {
      const promiseId = parseInt(req.params.promise_id, 10);
      const commentId = parseInt(req.params.comment_id, 10);
      const userId = req.session.userId;
      const p = getPromiseById(db, promiseId);
      if (!p) return res.status(404).json({ detail: 'Promise not found' });
      if (Number.isNaN(commentId)) return res.status(400).json({ detail: 'Invalid comment id' });
      const liked = toggleCommentLike(db, commentId, userId);
      res.json({ liked });
    },

    activity(req, res) {
      const userId = req.session.userId;
      const limit = Math.min(parseInt(req.query.limit, 10) || 25, 50);
      const { completed, created } = getActivityFeed(db, userId, limit);
      const activities = [
        ...completed.map((c) => ({ type: 'completed', promise_id: c.id, promise_name: c.name, at: c.completed_at })),
        ...created.map((c) => ({ type: 'created', promise_id: c.id, promise_name: c.name, at: c.created_at })),
      ].sort((a, b) => b.at - a.at).slice(0, limit);
      res.json({ activities });
    },

    categories(req, res) {
      res.json({ categories: DEFAULT_CATEGORIES });
    },

    applyReframe(req, res) {
      const userId = req.session.userId;
      const promise_id = parseInt(req.params.promise_id, 10);
      const promise = getPromiseById(db, promise_id);
      if (!promise) return res.status(404).json({ detail: 'Not found' });
      const { name, content, deadline } = req.body;
      const deadlineSeconds = parseDuration(deadline);
      if (!deadlineSeconds) return res.status(400).json({ detail: 'Invalid deadline' });
      const created_at = nowSeconds();
      const deadline_at = created_at + deadlineSeconds;
      const hash_value = hashPromise(0, created_at, name, promise.promise_type, content);
      const result = db
        .prepare(
          `INSERT INTO promises (user_id, name, promise_type, content, created_at, deadline_at, status, hash_value, participants, category, recurrence, target_value, current_value, visibility)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(promise.user_id || userId, name, promise.promise_type, content, created_at, deadline_at, hash_value, promise.participants, promise.category || null, promise.recurrence || null, promise.target_value ?? null, promise.target_value != null ? 0 : null, promise.visibility || 'private');
      const newId = result.lastInsertRowid;
      const newHash = hashPromise(newId, created_at, name, promise.promise_type, content);
      db.prepare('UPDATE promises SET hash_value = ? WHERE id = ?').run(newHash, newId);
      const existingParticipants = db.prepare('SELECT user_id FROM promise_participants WHERE promise_id = ?').all(promise_id);
      if (existingParticipants.length > 0) {
        addPromiseParticipants(db, newId, existingParticipants.map((r) => r.user_id));
      }
      db.prepare('DELETE FROM promise_participants WHERE promise_id = ?').run(promise_id);
      db.prepare('DELETE FROM promises WHERE id = ?').run(promise_id);
      res.json({ id: newId, status: 'reframed' });
    },
  };
}
