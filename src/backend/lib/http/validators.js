/**
 * Parse integer id from route params.
 * @param {Record<string, string>} params
 * @param {string} key
 * @returns {number}
 */
export function parseParamId(params, key = 'id') {
  return parseInt(params[key], 10);
}

/**
 * Parse optional positive limit with max cap.
 * @param {Record<string, any>} query
 * @param {number} [fallback]
 * @param {number} [max]
 * @returns {number}
 */
export function parseLimit(query, fallback = 50, max = 100) {
  return Math.min(parseInt(query.limit, 10) || fallback, max);
}

/**
 * Parse friend request recipient id from accepted payload keys.
 * @param {Record<string, any>} body
 * @returns {number}
 */
export function parseToUserId(body) {
  return parseInt(body.to_user_id || body.user_id, 10);
}
