import { bbcodeToHtml } from '../../../utils/bbcode';

/** Legacy article bodies were raw BBCode strings (see bbcode.ts) and never started with
 * "<" - a body already saved by the rich text editor always does, since editor.getHTML()
 * always emits a wrapping block tag. Used to decide whether a one-time conversion is needed. */
export function isLikelyHtml(body: string): boolean {
  return body.trimStart().startsWith('<');
}

/** One-time upgrade path for an article body: converts legacy BBCode to HTML via the
 * existing bbcodeToHtml converter so old articles open already formatted in the new
 * TipTap editor instead of showing raw "[b]" brackets. A no-op for bodies already saved
 * as HTML by the new editor. */
export function toEditorHtml(body: string): string {
  if (!body) return '';
  return isLikelyHtml(body) ? body : bbcodeToHtml(body);
}
