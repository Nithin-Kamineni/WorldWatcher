export const TOKEN_DRAG_MIME = 'application/x-worldwatcher-token-id';
export const ENCOUNTER_ENTRY_DRAG_MIME = 'application/x-worldwatcher-encounter-entry-id';
export const FAVORITE_CREATURE_DRAG_MIME = 'application/x-worldwatcher-favorite-creature-id';

export interface StagePoint {
  x: number;
  y: number;
}

/**
 * Converts a browser drop event's client coordinates into Konva stage-local
 * coordinates, accounting for the container's position plus the stage's
 * current imperative pan/zoom transform.
 */
export function clientPointToStagePoint(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  stage: { x(): number; y(): number; scaleX(): number },
): StagePoint {
  const rect = container.getBoundingClientRect();
  const pointerX = clientX - rect.left;
  const pointerY = clientY - rect.top;
  const scale = stage.scaleX() || 1;
  return {
    x: (pointerX - stage.x()) / scale,
    y: (pointerY - stage.y()) / scale,
  };
}
