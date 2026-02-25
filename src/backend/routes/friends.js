import { userToJson } from '../db/users.js';
import {
  sendRequest as sendFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getRequestById,
  acceptRequest as acceptFriendRequest,
  declineRequest as declineFriendRequest,
  cancelRequest as cancelFriendRequest,
  getFriends,
  getMutualCount,
  removeFriend as removeFriendDb,
} from '../db/friends.js';
import { createNotification } from '../db/notifications.js';
import { parseParamId, parseToUserId } from '../lib/http/validators.js';
import { sendBadRequest } from '../lib/http/responders.js';
import { requestToJson } from '../lib/friends/serializers.js';

export function friendRoutes(db) {
  return {
    list(req, res) {
      const userId = req.session.userId;
      const friends = getFriends(db, userId);
      const list = friends.map((u) => {
        const json = userToJson(u);
        json.mutual_count = getMutualCount(db, userId, u.id);
        return json;
      });
      res.json({ friends: list });
    },

    requestsIncoming(req, res) {
      const rows = getIncomingRequests(db, req.session.userId);
      res.json({ requests: rows.map((r) => requestToJson(r, 'incoming')) });
    },

    requestsOutgoing(req, res) {
      const rows = getOutgoingRequests(db, req.session.userId);
      res.json({ requests: rows.map((r) => requestToJson(r, 'outgoing')) });
    },

    postRequest(req, res) {
      const fromUserId = req.session.userId;
      const toUserId = parseToUserId(req.body);
      if (!toUserId) return sendBadRequest(res, 'Missing to_user_id');
      const result = sendFriendRequest(db, fromUserId, toUserId);
      if (result.error) return sendBadRequest(res, result.error);
      createNotification(db, {
        userId: toUserId,
        type: 'friend_request',
        fromUserId,
        relatedId: result.request.id,
      });
      res.status(201).json({
        request: { id: result.request.id, to_user_id: toUserId, created_at: result.request.created_at },
      });
    },

    acceptRequest(req, res) {
      const requestId = parseParamId(req.params);
      const reqRow = getRequestById(db, requestId);
      const result = acceptFriendRequest(db, requestId, req.session.userId);
      if (result.error) return sendBadRequest(res, result.error);
      if (reqRow) {
        createNotification(db, {
          userId: reqRow.from_user_id,
          type: 'friend_accepted',
          fromUserId: req.session.userId,
          relatedId: null,
        });
      }
      res.json({ ok: true });
    },

    declineRequest(req, res) {
      const requestId = parseParamId(req.params);
      const result = declineFriendRequest(db, requestId, req.session.userId);
      if (result.error) return sendBadRequest(res, result.error);
      res.json({ ok: true });
    },

    cancelRequest(req, res) {
      const requestId = parseParamId(req.params);
      const result = cancelFriendRequest(db, requestId, req.session.userId);
      if (result.error) return sendBadRequest(res, result.error);
      res.json({ ok: true });
    },

    removeFriend(req, res) {
      const userId = req.session.userId;
      const friendId = parseParamId(req.params);
      if (!friendId) return sendBadRequest(res, 'Invalid friend id');
      const result = removeFriendDb(db, userId, friendId);
      if (result.error) return sendBadRequest(res, result.error);
      res.json({ ok: true });
    },
  };
}
