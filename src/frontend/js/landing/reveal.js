/**
 * Reveal elements as they enter viewport.
 */
export function initLandingReveal(selector = '[data-reveal]') {
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('revealed');
      });
    },
    { threshold: 0.25 }
  );
  document.querySelectorAll(selector).forEach((el) => obs.observe(el));
}
