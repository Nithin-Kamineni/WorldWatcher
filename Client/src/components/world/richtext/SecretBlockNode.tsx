import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CollapsibleCardView } from './CollapsibleCardView';

/** A "Secret" card - same collapsible mechanics as CollapsibleBlock, but defaults to closed
 * and reads as a spoiler/GM-only note (dashed amber border, lock icon - see
 * CollapsibleCardView). There is no auth/role system in this app (single local user), so this
 * is a writing aid to hide spoilers from a quick read-through, not real access control. */
export const SecretBlock = Node.create({
  name: 'secretBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: 'Secret',
        parseHTML: (el) => el.getAttribute('data-title') ?? 'Secret',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      open: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-open') === 'true',
        renderHTML: (attrs) => ({ 'data-open': attrs.open ? 'true' : 'false' }),
      },
      variant: {
        default: 'secret',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="secret-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'secret-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleCardView);
  },
});
