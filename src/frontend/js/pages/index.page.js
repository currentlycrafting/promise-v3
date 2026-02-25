import { initLandingFeedLoop } from '../landing/feed-loop.js';
import { initLandingNavShadow } from '../landing/nav-shadow.js';
import { initLandingReveal } from '../landing/reveal.js';
import { initLandingSnapNavigation } from '../landing/snap-nav.js';

initLandingNavShadow('nav');
initLandingFeedLoop('fs', 'fl');
initLandingReveal('[data-reveal]');
initLandingSnapNavigation('main', 'scrollIndicator');
