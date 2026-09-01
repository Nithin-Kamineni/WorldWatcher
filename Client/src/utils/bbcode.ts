/** Minimal BBCode -> safe HTML converter for the article body editor (issue 4d - no rich
 * text/BBCode library exists anywhere in this codebase yet, and this is a small enough tag
 * set that hand-rolling avoids a new dependency). Security model: escape every character of
 * the raw input to HTML entities FIRST, then substitute only our own whitelisted tag
 * patterns for actual HTML - so `dangerouslySetInnerHTML` can only ever emit HTML this
 * function generated itself, never anything from the raw source. */

const ALLOWED_COLORS = new Set([
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey', 'cyan', 'magenta',
]);
const HEX_COLOR = /^#[0-9a-fA-F]{3,6}$/;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s)/relative URLs - blocks `javascript:`/`data:` and other schemes that
 * could execute in an href/src even though the surrounding text was already escaped. */
function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#')) return escapeHtml(trimmed);
  return null;
}

interface TagRule {
  pattern: RegExp;
  replace: (...groups: string[]) => string;
}

const TAG_RULES: TagRule[] = [
  { pattern: /\[b\]([\s\S]*?)\[\/b\]/gi, replace: (_m, inner) => `<strong>${inner}</strong>` },
  { pattern: /\[i\]([\s\S]*?)\[\/i\]/gi, replace: (_m, inner) => `<em>${inner}</em>` },
  { pattern: /\[u\]([\s\S]*?)\[\/u\]/gi, replace: (_m, inner) => `<span style="text-decoration:underline">${inner}</span>` },
  { pattern: /\[s\]([\s\S]*?)\[\/s\]/gi, replace: (_m, inner) => `<span style="text-decoration:line-through">${inner}</span>` },
  {
    pattern: /\[h([1-3])\]([\s\S]*?)\[\/h\1\]/gi,
    replace: (_m, level, inner) => `<h${level} style="margin:0.6em 0">${inner}</h${level}>`,
  },
  { pattern: /\[center\]([\s\S]*?)\[\/center\]/gi, replace: (_m, inner) => `<div style="text-align:center">${inner}</div>` },
  {
    pattern: /\[quote\]([\s\S]*?)\[\/quote\]/gi,
    replace: (_m, inner) =>
      `<blockquote style="margin:0.5em 0;padding:0.5em 1em;border-left:3px solid currentColor;opacity:0.85">${inner}</blockquote>`,
  },
  {
    pattern: /\[color=([a-zA-Z#0-9]+)\]([\s\S]*?)\[\/color\]/gi,
    replace: (_m, color, inner) => {
      const safe = ALLOWED_COLORS.has(color.toLowerCase()) || HEX_COLOR.test(color) ? color : 'inherit';
      return `<span style="color:${safe}">${inner}</span>`;
    },
  },
  {
    pattern: /\[size=(\d{1,3})\]([\s\S]*?)\[\/size\]/gi,
    replace: (_m, size, inner) => {
      const px = Math.min(48, Math.max(8, parseInt(size, 10) || 14));
      return `<span style="font-size:${px}px">${inner}</span>`;
    },
  },
  {
    pattern: /\[url=(.+?)\]([\s\S]*?)\[\/url\]/gi,
    replace: (_m, url, inner) => {
      const safe = sanitizeUrl(url);
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
    },
  },
  {
    pattern: /\[url\](.+?)\[\/url\]/gi,
    replace: (_m, url) => {
      const safe = sanitizeUrl(url);
      return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>` : url;
    },
  },
  {
    pattern: /\[img\](.+?)\[\/img\]/gi,
    replace: (_m, url) => {
      const safe = sanitizeUrl(url);
      return safe ? `<img src="${safe}" style="max-width:100%;border-radius:8px" />` : '';
    },
  },
  {
    pattern: /\[list\]([\s\S]*?)\[\/list\]/gi,
    replace: (_m, inner) => {
      const items = inner
        .split(/\[\*\]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) => `<li>${s}</li>`)
        .join('');
      return `<ul style="margin:0.4em 0;padding-left:1.4em">${items}</ul>`;
    },
  },
  // Entity mention inserted by the @-mention picker (BBCodeEditor) - the source is escaped
  // first, so this matches the &quot;-encoded attribute form, not raw quotes. Rendered as an
  // inline clickable span; EntityRefPreview's click delegation reads the data-ref-* attributes.
  {
    pattern: /\[ref type=&quot;(npc|creature|spell|encounter|place|faction|situational_table)&quot; id=&quot;([a-zA-Z0-9-]+)&quot;\]([\s\S]*?)\[\/ref\]/gi,
    replace: (_m, type, id, label) =>
      `<span class="ww-ref" data-ref-type="${type}" data-ref-id="${id}" role="button" tabindex="0">${label}</span>`,
  },
];

export type EntityRefType = 'npc' | 'creature' | 'spell' | 'encounter' | 'place' | 'faction' | 'situational_table';

/** Builds the `[ref]` tag the @-mention picker inserts - the write-side counterpart to the
 * TAG_RULES pattern above that parses it back out on render. Strips brackets from the label so
 * a mentioned name can never be mistaken for the start of another BBCode tag. */
export function buildEntityRefTag(type: EntityRefType, id: string, label: string): string {
  const safeLabel = label.replace(/[[\]]/g, '');
  return `[ref type="${type}" id="${id}"]${safeLabel}[/ref]`;
}

export function bbcodeToHtml(source: string): string {
  if (!source) return '';
  let html = escapeHtml(source);
  // Run twice so simple non-overlapping nesting (e.g. [b]bold [i]italic[/i][/b]) resolves -
  // this is a lightweight converter, not a real parser/AST, so deep nesting isn't guaranteed.
  for (let pass = 0; pass < 2; pass++) {
    for (const rule of TAG_RULES) {
      html = html.replace(rule.pattern, rule.replace as (...args: string[]) => string);
    }
  }
  return html.replace(/\n/g, '<br />');
}

export const BBCODE_TOOLBAR_TAGS: { label: string; open: string; close: string }[] = [
  { label: 'Bold', open: '[b]', close: '[/b]' },
  { label: 'Italic', open: '[i]', close: '[/i]' },
  { label: 'Underline', open: '[u]', close: '[/u]' },
  { label: 'Strikethrough', open: '[s]', close: '[/s]' },
  { label: 'Heading', open: '[h2]', close: '[/h2]' },
  { label: 'Quote', open: '[quote]', close: '[/quote]' },
  { label: 'List', open: '[list]\n[*]', close: '\n[/list]' },
  { label: 'Link', open: '[url=https://]', close: '[/url]' },
  { label: 'Image', open: '[img]', close: '[/img]' },
  { label: 'Center', open: '[center]', close: '[/center]' },
];
