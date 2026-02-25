import { escapeHtml, initials } from '../utils.js';

/**
 * Build avatar HTML for sidebar/profile chips.
 * @param {{display_name?:string,name?:string,avatar_url?:string,picture_url?:string}} user
 * @returns {string}
 */
export function avatarHtml(user) {
  const name = user?.display_name || user?.name || '';
  const imgUrl = user?.avatar_url || user?.picture_url || null;
  if (imgUrl) return `<img src="${escapeHtml(imgUrl)}" alt="">`;
  return `<span>${escapeHtml(initials(name))}</span>`;
}
