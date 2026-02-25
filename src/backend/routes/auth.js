import { OAuth2Client } from 'google-auth-library';
import { upsertUser, getUserById, userToJson } from '../db/users.js';

/**
 * Auth routes: POST /auth/google, GET /me, POST /logout (replication guide 3.4).
 * Optional: POST /auth/dev when GOOGLE_CLIENT_ID is not set.
 */
export function authRoutes(db, CLIENT_ID) {
  const oauth2Client = new OAuth2Client(CLIENT_ID);

  return {
    async postGoogle(req, res) {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Missing token' });
      }
      if (!CLIENT_ID) {
        return res.status(503).json({ error: 'Google Sign-In not configured' });
      }
      try {
        const ticket = await oauth2Client.verifyIdToken({
          idToken: token.trim(),
          audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const user = upsertUser(db, {
          google_sub: payload.sub,
          email: payload.email ?? '',
          name: payload.name ?? null,
          picture_url: payload.picture ?? null,
        });
        req.session.userId = user.id;
        req.session.save((err) => {
          if (err) return res.status(500).json({ error: 'Session save failed' });
          res.json({ user: userToJson(user) });
        });
      } catch (e) {
        console.error('Google token verify failed', e.message);
        res.status(401).json({ error: 'Invalid token' });
      }
    },

    getMe(req, res) {
      if (!req.session?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = getUserById(db, req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'User not found' });
      }
      res.json({ user: userToJson(user) });
    },

    postLogout(req, res) {
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.clearCookie('connect.sid', { path: '/' });
        res.json({ ok: true });
      });
    },

    postDev(req, res) {
      if (CLIENT_ID) {
        return res.status(404).json({ error: 'Dev login only when Google is not configured' });
      }
      const user = upsertUser(db, {
        google_sub: '__dev__',
        email: 'dev@local',
        name: 'Dev User',
        picture_url: null,
      });
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) return res.status(500).json({ error: 'Session save failed' });
        res.json({ user: userToJson(user) });
      });
    },
  };
}
