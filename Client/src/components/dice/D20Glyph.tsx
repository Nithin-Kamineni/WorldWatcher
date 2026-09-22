import { D20_INNER_FACETS, D20_SILHOUETTE, D20_VIEWBOX } from './d20Shape';

interface D20GlyphProps {
  size: number;
}

/** The d20 on the toolbar button. Flat, single-colour, no numbers: it is an icon for an
 * action, and the die it rolls is a 3D mesh rendered by DiceRollOverlay, not this. */
export function D20Glyph({ size }: D20GlyphProps) {
  return (
    <svg width={size} height={size} viewBox={D20_VIEWBOX} aria-hidden focusable="false">
      <polygon points={D20_SILHOUETTE} fill="currentColor" opacity={0.16} />
      <g fill="none" stroke="currentColor" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round">
        <polygon points={D20_SILHOUETTE} />
        {D20_INNER_FACETS.map((points, i) => (
          <polygon key={i} points={points} />
        ))}
      </g>
    </svg>
  );
}
