export type AoEShapeType = 'circle' | 'cone' | 'square' | 'rectangle' | 'line' | 'thin-line' | 'freehand';

export interface AoEShape {
  id: string;
  type: AoEShapeType;
  x: number;
  y: number;
  /** circle radius, or cone length, or square side */
  radius: number;
  /** cone facing, in degrees */
  rotation: number;
  color: string;
  /** rectangle only */
  width?: number;
  height?: number;
  /** line/thin-line (2 points, relative to x,y) or freehand (full point list, relative to x,y) */
  points?: number[];
  /** line/thin-line/freehand stroke width */
  strokeWidth?: number;
}

export const STROKE_SHAPE_TYPES: AoEShapeType[] = ['line', 'thin-line', 'freehand'];

export const AOE_SHAPE_OPACITY = 0.35;
export const STROKE_SHAPE_OPACITY = 0.9;
export const CONE_ANGLE_DEGREES = 53; // ~ a 5e "cone" spell template
export const THIN_LINE_WIDTH = 3;
export const DEFAULT_MARKER_WIDTH = 4;
export const MIN_MARKER_WIDTH = 1;
export const MAX_MARKER_WIDTH = 20;
export const DEFAULT_SHAPE_COLOR = '#e5484d';

export const AOE_COLOR_PRESETS = ['#e5484d', '#f5c542', '#3b82f6', '#22c55e', '#a855f7'];
