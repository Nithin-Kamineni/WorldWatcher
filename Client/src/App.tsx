import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeModeProvider } from './theme/ThemeModeContext';
import { AppRoutes } from './routes/routes';
import { DiceRollOverlay } from './components/dice/DiceRollOverlay';
import { FLOATING_SCROLLBAR_CLASS } from './theme/scrollbarSx';

const SCROLL_IDLE_MS = 650;

/** One capture-phase 'scroll' listener for the whole app - scroll events don't bubble, so this
 * is the only way to catch them from a single place instead of wiring a handler onto every
 * scrollable container. Marks whichever `.ww-floating-scroll` element just scrolled with
 * `data-ww-scrolling="true"` and clears it again after a short idle period, which is what lets
 * thinScrollbarSx (scrollbarSx.ts) show the thumb only while actually scrolling. */
function useFloatingScrollbars() {
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
    const handleScroll = (e: Event) => {
      const el = e.target as Element | null;
      if (!el?.classList?.contains(FLOATING_SCROLLBAR_CLASS)) return;
      el.setAttribute('data-ww-scrolling', 'true');
      const existing = timers.get(el);
      if (existing) clearTimeout(existing);
      timers.set(
        el,
        setTimeout(() => el.removeAttribute('data-ww-scrolling'), SCROLL_IDLE_MS),
      );
    };
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, []);
}

function App() {
  useFloatingScrollbars();
  return (
    <ThemeModeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      {/* OUTSIDE the router, deliberately. The dice table owns a BabylonJS engine, a physics
          worker and a WebGL context, and it keeps a running count of how many throws it has
          already served. Mounted inside a page (it used to live in SectionLayout) all three
          are rebuilt on every navigation - which leaked a WebGL context per page change and,
          because the throw-count watermark restarted at zero, made the overlay "catch up" by
          re-throwing every die rolled that session. Here it mounts once and stays. It still
          portals to <body>, so this position decides its lifetime, not where it draws. */}
      <DiceRollOverlay />
    </ThemeModeProvider>
  );
}

export default App;
