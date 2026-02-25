/**
 * Toggle shadow class on the landing nav while scrolling.
 */
export function initLandingNavShadow(navId = 'nav') {
  const nav = document.getElementById(navId);
  if (!nav) return;
  window.addEventListener(
    'scroll',
    () => {
      nav.classList.toggle('scrolled', scrollY > 10);
    },
    { passive: true }
  );
}
