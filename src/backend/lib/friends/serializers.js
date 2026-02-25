import { userToJson } from '../../db/users.js';

/**
 * Serialize incoming/outgoing friend request row.
 * @param {any} row
 * @param {'incoming'|'outgoing'} kind
 */
export function requestToJson(row, kind) {
  const isIncoming = kind === 'incoming';
  const other = isIncoming
    ? {
        id: row.from_id,
        name: row.from_name,
        display_name: row.from_display_name,
        email: row.from_email,
        picture_url: row.from_picture_url,
        avatar_path: row.from_avatar_path,
      }
    : {
        id: row.to_id,
        name: row.to_name,
        display_name: row.to_display_name,
        email: row.to_email,
        picture_url: row.to_picture_url,
        avatar_path: row.to_avatar_path,
      };
  return {
    id: row.id,
    created_at: row.created_at,
    from_user_id: row.from_user_id,
    to_user_id: row.to_user_id,
    user: userToJson(other),
  };
}
