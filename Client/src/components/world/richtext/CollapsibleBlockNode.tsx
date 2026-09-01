import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CollapsibleCardView } from './CollapsibleCardView';

/** A titled, collapsible card the author can drop rich content into - the "custom block"
 * WorldAnvil-style article feature. Stored as a plain <div data-type="collapsible-block"> with
 * data-title/data-open attributes, so it round-trips through the same body:TEXT column as any
 * other HTML the rich text editor produces (see Server/app/models/article.py). */
export const CollapsibleBlock = Node.create({
  name: 'collapsibleBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: 'Section',
        parseHTML: (el) => el.getAttribute('data-title') ?? 'Section',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      open: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-open') !== 'false',
        renderHTML: (attrs) => ({ 'data-open': attrs.open ? 'true' : 'false' }),
      },
      variant: {
        default: 'collapsible',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="collapsible-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'collapsible-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleCardView);
  },
});
