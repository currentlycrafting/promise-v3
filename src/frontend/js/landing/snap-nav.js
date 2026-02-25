/**
 * Wire section snap behavior for wheel, keys, and indicator button.
 */
export function initLandingSnapNavigation(mainSelector = 'main', indicatorId = 'scrollIndicator') {
  const sections = Array.from(document.querySelectorAll(`${mainSelector} > section`));
  const indicator = document.getElementById(indicatorId);
  if (!sections.length || !indicator) return;

  let snapLock = false;
  let currentSection = 0;

  function getNearestSectionIndex() {
    const y = window.scrollY + window.innerHeight * 0.45;
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    sections.forEach((sec, idx) => {
      const dist = Math.abs(sec.offsetTop - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  function updateIndicator() {
    currentSection = getNearestSectionIndex();
    indicator.classList.toggle('hidden', currentSection >= sections.length - 1);
  }

  function goToSection(idx) {
    if (idx < 0 || idx >= sections.length || snapLock) return;
    snapLock = true;
    currentSection = idx;
    sections[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      snapLock = false;
      updateIndicator();
    }, 520);
  }

  window.addEventListener(
    'wheel',
    (e) => {
      if (snapLock) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      goToSection(getNearestSectionIndex() + dir);
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      goToSection(getNearestSectionIndex() + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goToSection(getNearestSectionIndex() - 1);
    }
  });

  indicator.addEventListener('click', () => goToSection(getNearestSectionIndex() + 1));
  window.addEventListener('scroll', updateIndicator, { passive: true });
  updateIndicator();
}
