export type MapToolMode =
  | 'select'
  | 'aoe-circle'
  | 'aoe-cone'
  | 'aoe-square'
  | 'aoe-rectangle'
  | 'aoe-line'
  | 'aoe-line-thin'
  | 'marker'
  | 'ruler'
  | 'eraser'
  | 'fog-reveal'
  | 'fog-hide'
  | 'wall-draw'
  | 'wall-erase';

/** Tools that paint or edit fog/wall state rather than map content. Grouped
 * because they share a cursor, suppress stage dragging, and are the only
 * tools that need the background fit to convert into image space. */
export const FOG_TOOLS: MapToolMode[] = ['fog-reveal', 'fog-hide', 'wall-draw', 'wall-erase'];

export function isFogTool(tool: MapToolMode): boolean {
  return FOG_TOOLS.includes(tool);
}
