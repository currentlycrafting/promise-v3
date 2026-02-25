import { updateProfile, updateUserAvatar, getUserById, userToJson } from '../db/users.js';
import { isAllowedAvatarMime, removeOldAvatar, removeUploadedAvatar } from '../lib/profile/avatar.js';

export function profileRoutes(db, uploadAvatar) {
  return {
    getProfile(req, res) {
      const user = getUserById(db, req.session.userId);
      if (!user) return res.status(401).json({ error: 'User not found' });
      res.json({ user: userToJson(user) });
    },

    patchProfile(req, res) {
      const userId = req.session.userId;
      const { display_name, bio, timezone, profile_visibility } = req.body;
      const updated = updateProfile(db, userId, {
        display_name: display_name !== undefined ? String(display_name).trim() || null : undefined,
        bio: bio !== undefined ? String(bio).trim() || null : undefined,
        timezone: timezone !== undefined ? String(timezone).trim() || null : undefined,
        profile_visibility:
          profile_visibility !== undefined && ['public', 'private'].includes(profile_visibility)
            ? profile_visibility
            : undefined,
      });
      if (!updated) return res.status(404).json({ error: 'User not found' });
      res.json({ user: userToJson(updated) });
    },

    postAvatar(req, res) {
      const userId = req.session.userId;
      if (!req.file) return res.status(400).json({ detail: 'No file uploaded' });
      if (!isAllowedAvatarMime(req.file.mimetype)) {
        removeUploadedAvatar(req.file.path);
        return res.status(400).json({ detail: 'Invalid file type. Use JPEG, PNG, GIF, or WebP.' });
      }
      const user = getUserById(db, userId);
      if (!user) return res.status(401).json({ error: 'User not found' });
      const oldPath = user.avatar_path;
      const filename = req.file.filename;
      updateUserAvatar(db, userId, filename);
      removeOldAvatar(req.file.path, oldPath);
      const updated = getUserById(db, userId);
      res.json({ user: userToJson(updated) });
    },
  };
}
