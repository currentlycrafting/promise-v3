import path from 'path';
import fs from 'fs';

export const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * @param {string} mime
 */
export function isAllowedAvatarMime(mime) {
  return ALLOWED_AVATAR_MIMES.includes(mime);
}

/**
 * Remove previous avatar file from same uploads directory.
 * @param {string} uploadedFilePath
 * @param {string | null | undefined} oldAvatarPath
 */
export function removeOldAvatar(uploadedFilePath, oldAvatarPath) {
  if (!oldAvatarPath) return;
  const dir = path.dirname(uploadedFilePath);
  const oldFull = path.join(dir, oldAvatarPath);
  if (fs.existsSync(oldFull)) fs.unlinkSync(oldFull);
}

/**
 * Remove newly uploaded file when validation fails.
 * @param {string} filePath
 */
export function removeUploadedAvatar(filePath) {
  fs.unlink(filePath, () => {});
}
