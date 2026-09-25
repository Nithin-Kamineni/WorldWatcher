import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type DiceBox from '@3d-dice/dice-box';
import type { DiceBoxResult } from '@3d-dice/dice-box';
import { latestDiceSeq, useDiceRollStore, type DiceGroupResult } from '../../store/useDiceRollStore';
import { BRAND_AMBER } from '../../theme/brandColors';

/** Above every overlay MUI has (modal 1300, snackbar 1400, tooltip 1500). */
const DICE_Z_INDEX = 1600;

const CONTAINER_ID = 'ww-dice-box';

/** Where `Client/public/assets/dice-box` is served from. The package fetches its ammo.js wasm
 * and its dice meshes/textures from here at runtime, so these are real files in `public/`,
 * copied out of `node_modules/@3d-dice/dice-box/dist/assets` - NOT bundled. Re-copy them if
 * the package is ever upgraded. */
const ASSET_PATH = '/assets/dice-box/';

/** Minimum gap between two throws. Tapping the button three times fast should read as
 * three throws, not one handful dropped at once. */
const THROW_GAP_MS = 260;

/** Die size, in dice-box's world units. */
const DIE_SCALE = 7;

/** WHERE THE DICE LAND - and why this code does NOT try to control it. Read this before
 * adding a throwForce/size override back; both were tried, measured, and reverted.
 *
 * The ask was: launch from anywhere on the screen edge, but come to rest near the middle.
 * That is not achievable with dice-box 1.1.4. From its physics worker (inlined as base64 in
 * dist/dice-box.es.js - none of this is in the documented options, though the worker merges
 * the whole config object, so it is all settable):
 *   - a die SPAWNS ON A WALL of the physics table. The wall is the entry point, so wherever
 *     the table edge is, that is where dice appear from.
 *   - the physics table's extent is the `size` option, but the VISUAL box has its own
 *     hardcoded 9.5 and the camera is built from the aspect ratio alone. So `size` moves the
 *     walls without moving the camera, giving only three options: 9.5 (walls at the screen
 *     edges - dice enter from the edges and may rest anywhere), smaller (dice stay central
 *     but visibly spawn mid-screen), or larger (dice spawn off-screen, and can also come to
 *     REST off-screen, invisible).
 *   - launch speed is `random(0.5, throwForce) x distance from centre`, and that 0.5 floor
 *     is hardcoded. A weakly thrown die stops near the wall it came from no matter what, so
 *     the resting spot varies from 'at the edge' to 'across the table' at every setting.
 *   - friction is Coulomb, so travel grows with the SQUARE of launch speed while the
 *     distance needed is linear in spawn offset. On a 16:9 table the x half-extent is 8.45
 *     world units against 4.75 for z, so side-spawned dice overshoot while top/bottom ones
 *     stall - one axis can be tuned well, never both.
 *
 * Measured at 1537x864 (screenshot diffed against a dice-free baseline, dice clustered;
 * 1.0 = the nearest screen edge). Lowering throwForce to 2.5 and squaring the table did pull
 * the median in from 0.91 to 0.46, with 6/10 dice in the middle half instead of 1/8 - but it
 * only worked by moving the walls inward, which is what made dice start mid-screen. Getting
 * both at once would mean patching the worker's throw, which is not worth vendoring a fork
 * of the library for.
 *
 * So the dice are left as the library throws them: walls at the screen edges, dice in from
 * any edge, resting wherever the physics puts them.
 */

/** Offscreen but still announced. Spelled out here rather than taken from MUI because this
 * component deliberately imports no MUI components - see the note on the render. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'fixed',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

/** The 3D dice table.
 *
 * NO MUI IN HERE, on purpose, and do not add any. This is mounted from App.tsx, so it sits in
 * the eager entry chunk and everything it imports statically is downloaded before the app
 * paints. Measured: a single `useTheme` from `@mui/material/styles` took the entry chunk from
 * 198 kB to 399 kB, because it pulls MUI's whole styles runtime forward. (`@mui/material/Box`
 * was the first suspect and was NOT the cause - removing it changed nothing; removing
 * `useTheme` gave the 198 kB back on its own.) Hence two plain divs, an inline style object,
 * and the one colour taken from theme/brandColors.ts, which imports nothing.
 *
 * This is a real physics simulation, not an animation of a number we already picked:
 * `@3d-dice/dice-box` (BabylonJS + ammo.js in a web worker) throws an actual die mesh (d4
 * to d20) - the
 * real solid, with the real face numbering, readable the whole way down because the numbers
 * are on the model - lets it tumble and settle, then raycasts straight up from the resting
 * die against a collider-face map to see which face ended on top. THAT is the roll. Nothing
 * in this file may ever decide a value; see useDiceRollStore for why that matters.
 *
 * Three things make it cheap enough to sit over the Play page:
 *   - the module (BabylonJS, ~1.4MB) is dynamically imported on the FIRST roll, so pages that
 *     never roll a die never load it, and it lands in its own lazy chunk;
 *   - dice-box stops its own render loop and suspends the physics worker the moment every die
 *     is asleep, so an idle table costs nothing but a retained WebGL context;
 *   - the canvas is `pointer-events: none`, so the app underneath stays fully usable while
 *     dice are on it - clicking anything is in fact how you sweep them away. */
/** Straight from the simulation - whichever faces are pointing up, grouped per notation. */
function toGroupResults(results: DiceBoxResult[]): DiceGroupResult[] {
  return results.map((group) => {
    const rolls = (group.rolls ?? []).map((r) => r.value);
    const modifier = group.modifier ?? 0;
    return {
      sides: Number(group.sides) || 0,
      rolls,
      modifier,
      total: rolls.reduce((sum, v) => sum + v, 0) + modifier,
    };
  });
}

/** "Rolled 2d6+1: 3, 5 (9); d20: 14" - for the live region. */
function describeResults(results: DiceGroupResult[]): string {
  const parts = results.map((g) => {
    const mod = g.modifier > 0 ? `+${g.modifier}` : g.modifier < 0 ? `${g.modifier}` : '';
    const label = `${g.rolls.length > 1 ? g.rolls.length : ''}d${g.sides}${mod}`;
    return g.rolls.length > 1 || g.modifier ? `${label}: ${g.rolls.join(', ')} (${g.total})` : `${label}: ${g.total}`;
  });
  return parts.length ? `Rolled ${parts.join('; ')}` : '';
}

export function DiceRollOverlay() {
  const requests = useDiceRollStore((s) => s.requests);
  const dismissCount = useDiceRollStore((s) => s.dismissCount);
  const diceOnTable = useDiceRollStore((s) => s.diceOnTable);
  const dismissSeconds = useDiceRollStore((s) => s.dismissSeconds);
  const results = useDiceRollStore((s) => s.results);
  const dismiss = useDiceRollStore((s) => s.dismiss);
  const setDiceOnTable = useDiceRollStore((s) => s.setDiceOnTable);
  const setResults = useDiceRollStore((s) => s.setResults);
  const recordRoll = useDiceRollStore((s) => s.recordRoll);

  const boxRef = useRef<DiceBox | null>(null);
  const boxPromiseRef = useRef<Promise<DiceBox | null> | null>(null);
  /** Serialises throws, so two presses in the same tick can't both see an empty table and
   * both call `roll()` (which clears) instead of one `roll()` and one `add()`. */
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const lastThrowAtRef = useRef(0);
  // Seeded from the store's CURRENT counts, not from 0. The store's counters are monotonic
  // and session-long, so a watermark of 0 means "nothing has ever been handled" - and a fresh
  // overlay would dutifully catch up by throwing one die per press ever made. That is exactly
  // what happened when this component was mounted inside SectionLayout: every page renders
  // its own, so each navigation remounted it and re-threw the whole history. Mounting it once
  // at the app root (App.tsx) is the real fix; seeding these makes the bug unreachable even
  // if it is ever mounted somewhere short-lived again.
  const handledRequestsRef = useRef(latestDiceSeq(useDiceRollStore.getState().requests));
  const handledDismissRef = useRef(useDiceRollStore.getState().dismissCount);
  const sweepTimerRef = useRef<number | null>(null);
  const onTableRef = useRef(false);
  /** True from a throw onto a clean table until that throw settles - tells recordRoll
   * whether this is a new roll or more dice added to the last one. */
  const freshThrowRef = useRef(false);
  /** Read inside `onRollComplete`, which is installed once when the box is built and so must
   * not close over the setting's value at that moment. */
  const dismissSecondsRef = useRef(dismissSeconds);
  dismissSecondsRef.current = dismissSeconds;

  const cancelSweep = useCallback(() => {
    if (sweepTimerRef.current !== null) {
      window.clearTimeout(sweepTimerRef.current);
      sweepTimerRef.current = null;
    }
  }, []);

  const sweep = useCallback(() => {
    cancelSweep();
    boxRef.current?.clear();
    onTableRef.current = false;
    setDiceOnTable(false);
    setResults([]);
  }, [cancelSweep, setDiceOnTable, setResults]);

  /** Loads and initialises the box once, on demand. Returns null if it could not start (no
   * WebGL, assets missing) - a DM who can't have 3D dice should lose the dice, not the app. */
  const ensureBox = useCallback((): Promise<DiceBox | null> => {
    if (boxPromiseRef.current) return boxPromiseRef.current;
    boxPromiseRef.current = (async () => {
      try {
        const { default: DiceBoxClass } = await import('@3d-dice/dice-box');
        const box = new DiceBoxClass({
          container: `#${CONTAINER_ID}`,
          assetPath: ASSET_PATH,
          theme: 'default',
          // The brand amber, stated rather than read from the MUI theme: `useTheme` here would
          // put MUI's styles runtime in the entry chunk (see the note above). It does not track
          // light/dark, and should not - the die is a lit 3D object with its own shading and a
          // cast shadow, not a surface that has to hold contrast against the page.
          themeColor: BRAND_AMBER,
          scale: DIE_SCALE,
          // The package's own note: 0 causes stuttering and physics popping.
          delay: 10,
          enableShadows: true,
          lightIntensity: 1,
        });
        box.onRollComplete = (results: DiceBoxResult[]) => {
          const groups = toGroupResults(results);
          setResults(groups);
          recordRoll(groups, !freshThrowRef.current);
          freshThrowRef.current = false;
          // The countdown starts when the dice STOP, not when they are thrown, so a long
          // tumble never eats into the time you have to read them.
          cancelSweep();
          sweepTimerRef.current = window.setTimeout(sweep, dismissSecondsRef.current * 1000);
        };
        await box.init();
        boxRef.current = box;
        return box;
      } catch (error) {
        console.error('[dice] 3D dice could not start', error);
        return null;
      }
    })();
    return boxPromiseRef.current;
  }, [cancelSweep, sweep, setResults, recordRoll]);

  // ---- presses -> throws ------------------------------------------------------------------
  useEffect(() => {
    const latest = latestDiceSeq(requests);
    if (latest <= handledRequestsRef.current) return;
    const pending = requests.filter((r) => r.seq > handledRequestsRef.current);
    handledRequestsRef.current = latest;

    queueRef.current = queueRef.current.then(async () => {
      const box = await ensureBox();
      if (!box) return;
      for (const request of pending) {
        const since = Date.now() - lastThrowAtRef.current;
        if (since < THROW_GAP_MS) await new Promise((r) => setTimeout(r, THROW_GAP_MS - since));
        cancelSweep();
        // Reveal before throwing, not after: the container starts hidden, and making it
        // visible costs a React render the throw should not have to wait behind.
        setDiceOnTable(true);
        // `roll` clears the table first; `add` throws onto the dice already on it. That
        // distinction is the whole of the "press twice, get two dice" behaviour - and a
        // `fresh` request (the sidebar's Roll button) always wants a clean table, so its
        // total is the total of what it threw and nothing left over.
        if (onTableRef.current && request.mode === 'add') box.add(request.notation);
        else {
          freshThrowRef.current = true;
          box.roll(request.notation);
        }
        onTableRef.current = true;
        lastThrowAtRef.current = Date.now();
      }
    });
  }, [requests, ensureBox, cancelSweep, setDiceOnTable]);

  // ---- dismiss requests -------------------------------------------------------------------
  useEffect(() => {
    if (dismissCount <= handledDismissRef.current) return;
    handledDismissRef.current = dismissCount;
    sweep();
  }, [dismissCount, sweep]);

  // ---- click anywhere / Escape ------------------------------------------------------------
  useEffect(() => {
    if (!diceOnTable) return;
    const onPointerDown = (e: PointerEvent) => {
      // ...except the button that throws them. Pointerdown beats the button's own click, so
      // without this every press after the first would sweep away the dice it had just added,
      // and tapping three times would only ever leave one die on the table.
      if ((e.target as Element | null)?.closest?.('[data-dice-roll-trigger]')) return;
      dismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    // Capture phase, so a click a page handler stops from propagating still clears the table.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [diceOnTable, dismiss]);

  // A newly mounted overlay owns no canvas and no dice, so any leftover "there are dice out"
  // flag from a previous instance is a lie that would keep the container visible and the
  // dismiss listeners armed over an empty table.
  useEffect(() => {
    onTableRef.current = false;
    setDiceOnTable(false);
    setResults([]);
    return () => cancelSweep();
  }, [cancelSweep, setDiceOnTable, setResults]);

  return createPortal(
    <>
      {/* A <canvas> is opaque to a screen reader, so the only way the result reaches one is
          to say it. Also the one place the settled values exist in the DOM, which is what
          makes "does the reported number match the face that is actually up" checkable. */}
      <div
        role="status"
        aria-live="polite"
        data-dice-results={results.map((g) => g.rolls.join('+')).join(',')}
        style={VISUALLY_HIDDEN}
      >
        {describeResults(results)}
      </div>
      {/* The canvas has to be at its final size BEFORE `box.init()` runs, because that is
          when dice-box measures clientWidth/clientHeight to size its drawing buffer AND to
          derive the physics table's aspect ratio. Styling it imperatively after init left the
          buffer at the canvas default of 300x150 stretched across the container - a blurry,
          vertically squashed render, and a physics table whose shape had nothing to do with
          the window. A real rule applies the instant dice-box inserts the canvas, so this
          cannot happen; do not replace it with an inline style on an element that does not
          exist yet. */}
      <style>{`#${CONTAINER_ID} canvas{width:100%;height:100%;display:block}`}</style>
      <div
        id={CONTAINER_ID}
        style={{
          position: 'fixed',
          // Full screen. The physics walls sit at the canvas edges, so this is also what
          // makes dice enter from the edges of the window - see the note above.
          inset: 0,
          zIndex: DICE_Z_INDEX,
          pointerEvents: 'none',
          // Hidden rather than unmounted: dice-box owns the canvas inside and re-creating it
          // per roll would mean re-initialising BabylonJS and re-fetching the meshes each time.
          visibility: diceOnTable ? 'visible' : 'hidden',
        }}
      />
    </>,
    document.body,
  );
}
