/**
 * Simple status text setter for form/message regions.
 * @param {HTMLElement|null} el
 * @param {string} text
 * @param {boolean} [isError]
 */
export function setStatusMessage(el, text, isError = false) {
  if (!el) return;
  el.textContent = text || '';
  el.className = 'msg' + (isError ? ' err' : '');
}
