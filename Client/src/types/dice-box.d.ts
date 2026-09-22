/** Hand-written types for `@3d-dice/dice-box`, which ships no `.d.ts`.
 *
 * Deliberately NARROW: it covers only the surface DiceRollOverlay uses, taken from the
 * package's own `dist/dice-box.es.js` rather than from the docs site, which is a version or
 * two ahead of what npm installs. Widen it from the dist source if more is ever needed. */
declare module '@3d-dice/dice-box' {
  /** One die's outcome. The value is NOT generated - dice-box raycasts straight up from the
   * settled die against a collider-face map and reports whichever face is on top. */
  export interface DiceBoxResult {
    groupId: number;
    rollId: number;
    sides: number;
    dieType: string;
    theme: string;
    themeColor: string;
    value: number;
  }

  export interface DiceBoxConfig {
    /** Where the `ammo/` and `themes/` folders are served from. The only required option. */
    assetPath: string;
    /** CSS selector or element the canvas is appended to. */
    container?: string | HTMLElement;
    id?: string;
    theme?: string;
    themeColor?: string;
    scale?: number;
    gravity?: number;
    /** ms between dice in one notation - 0 causes physics popping, per the package. */
    delay?: number;

    // --- physics ---------------------------------------------------------------------------
    // Absent from this version's documented option list, but the physics worker merges the
    // whole config object over its own defaults, so they take effect. Names and defaults read
    // out of the worker source inlined in dist/dice-box.es.js.
    /** Table size in WORLD units (default 9.5). The canvas only supplies the aspect ratio. */
    size?: number;
    /** Launch speed toward the centre, as a multiplier on the die's distance from it, itself
     * scaled by `(1 + scale/6)` (default 5). */
    throwForce?: number;
    spinForce?: number;
    startingHeight?: number;
    linearDamping?: number;
    angularDamping?: number;
    friction?: number;
    restitution?: number;
    /** ms after which a still-moving die is forced to settle (default 5000). */
    settleTimeout?: number;
    enableShadows?: boolean;
    shadowTransparency?: number;
    lightIntensity?: number;
    /** Render on an OffscreenCanvas in a worker; falls back automatically. */
    offscreen?: boolean;
    origin?: string;
    onRollComplete?: (results: DiceBoxResult[]) => void;
    onDieComplete?: (result: DiceBoxResult) => void;
  }

  export default class DiceBox {
    constructor(config: DiceBoxConfig);
    init(): Promise<void>;
    /** Clears the table, then throws. */
    roll(notation: string): Promise<DiceBoxResult[]>;
    /** Throws onto a table that already has dice on it. */
    add(notation: string): Promise<DiceBoxResult[]>;
    clear(): this;
    hide(): this;
    show(): this;
    updateConfig(config: Partial<DiceBoxConfig>): this;
    onRollComplete: (results: DiceBoxResult[]) => void;
    onDieComplete: (result: DiceBoxResult) => void;
  }
}
