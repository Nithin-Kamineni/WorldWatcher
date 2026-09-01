/** Pixel position of a textarea's caret, relative to the viewport - a plain HTML textarea has
 * no API for this, so the standard workaround is a hidden "mirror" div styled identically to
 * the textarea, with the same text up to the caret, then reading the position of a marker span
 * appended at the end of it. No third-party dependency; ~40 lines is cheaper than a library. */

const MIRRORED_PROPERTIES: (keyof CSSStyleDeclaration)[] = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'whiteSpace',
  'wordWrap',
];

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(el: HTMLTextAreaElement, index: number): CaretCoordinates {
  const div = document.createElement('div');
  const computed = window.getComputedStyle(el);

  for (const prop of MIRRORED_PROPERTIES) {
    // CSSStyleDeclaration's string-indexed values are always strings for these props.
    (div.style as unknown as Record<string, string>)[prop as string] = computed[prop] as string;
  }
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.top = '0';
  div.style.left = '0';
  div.style.overflow = 'hidden';

  div.textContent = el.value.substring(0, index);

  const marker = document.createElement('span');
  marker.textContent = el.value.substring(index) || '.';
  div.appendChild(marker);

  document.body.appendChild(div);
  const elRect = el.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const coordinates: CaretCoordinates = {
    top: elRect.top + (markerRect.top - divRect.top) - el.scrollTop,
    left: elRect.left + (markerRect.left - divRect.left) - el.scrollLeft,
    height: parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2,
  };
  document.body.removeChild(div);

  return coordinates;
}
