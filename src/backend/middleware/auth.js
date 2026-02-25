/**
 * requireAuth: protect routes; req.session.userId must be set (replication guide 3.5).
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.userId = req.session.userId;
  next();
}
