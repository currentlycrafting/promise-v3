/**
 * Clone feed content for infinite terminal scroll illusion.
 */
export function initLandingFeedLoop(scrollId = 'fs', listId = 'fl') {
  const scrollEl = document.getElementById(scrollId);
  const listEl = document.getElementById(listId);
  if (!scrollEl || !listEl) return;
  scrollEl.appendChild(listEl.cloneNode(true));
}
