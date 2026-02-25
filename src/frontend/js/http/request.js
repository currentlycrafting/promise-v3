/**
 * Minimal fetch helpers with consistent JSON/error handling.
 * @param {Response} res
 * @returns {Promise<any>}
 */
export async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch (_) {
    return {};
  }
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<{ok:boolean,status:number,data:any}>}
 */
export async function requestJson(url, init = {}) {
  try {
    const res = await fetch(url, init);
    const data = await parseJsonSafe(res);
    return { ok: res.ok, status: res.status, data };
  } catch (_) {
    return { ok: false, status: 0, data: {} };
  }
}
