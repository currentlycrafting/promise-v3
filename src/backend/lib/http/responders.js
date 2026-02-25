/**
 * Send standard bad request detail response.
 * @param {import('express').Response} res
 * @param {string} detail
 */
export function sendBadRequest(res, detail) {
  return res.status(400).json({ detail });
}

/**
 * Send standard not found detail response.
 * @param {import('express').Response} res
 * @param {string} detail
 */
export function sendNotFound(res, detail = 'Not found') {
  return res.status(404).json({ detail });
}
