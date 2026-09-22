import { Node, mergeAttributes } from '@tiptap/core';
import type { EntityRefType } from '../../../utils/bbcode';

/** The rich-text counterpart of BBCode's `[ref type="..." id="..."]Label[/ref]` (utils/
 * bbcode.ts) - one inline atom holding a mention of an NPC/Creature/Spell/Encounter/Place/
 * Faction/Table.
 *
 * It renders EXACTLY the markup bbcodeToHtml already emits for a `[ref]` tag - a
 * `span.ww-ref` carrying data-ref-type/data-ref-id - so three things line up for free:
 * a legacy BBCode note converted by toEditorHtml() parses straight back into these nodes,
 * EntityRefPreview's existing click delegation keeps working on the rendered output, and a
 * note body round-trips through the editor without losing its mentions.
 *
 * Atomic on purpose: a mention is one indivisible token, so backspace deletes the whole
 * thing rather than letting the DM edit the label out from under the id it points at. */
export interface EntityRefAttributes {
  refType: EntityRefType;
  refId: string;
  label: string;
}

export const EntityRefNode = Node.create({
  name: 'entityRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      refType: {
        default: 'npc',
        parseHTML: (element) => element.getAttribute('data-ref-type'),
        renderHTML: (attributes) => ({ 'data-ref-type': attributes.refType }),
      },
      refId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-ref-id'),
        renderHTML: (attributes) => ({ 'data-ref-id': attributes.refId }),
      },
      label: {
        default: '',
        parseHTML: (element) => element.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.ww-ref[data-ref-type]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'ww-ref', role: 'button', tabindex: '0' }),
      String(node.attrs.label ?? ''),
    ];
  },
});
