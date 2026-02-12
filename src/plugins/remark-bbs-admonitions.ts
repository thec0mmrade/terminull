import type { Root, Blockquote, Paragraph, Text } from 'mdast';
import { visit } from 'unist-util-visit';

const ADMONITION_TYPES: Record<string, string> = {
  '!WARN': 'warn',
  '!HACK': 'hack',
  '!INFO': 'info',
};

export function remarkBbsAdmonitions() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const firstChild = node.children[0];
      if (firstChild?.type !== 'paragraph') return;

      const firstText = firstChild.children[0];
      if (firstText?.type !== 'text') return;

      const match = firstText.value.match(/^\[(!(?:WARN|HACK|INFO))\]\s*(.*)/);
      if (!match) return;

      const type = ADMONITION_TYPES[match[1]];
      const remainingText = match[2];

      // Update the text content
      if (remainingText) {
        firstText.value = remainingText;
      } else {
        // Remove the marker text node
        firstChild.children.shift();
      }

      // Add data attributes for styling
      (node.data ??= {});
      (node.data.hProperties ??= {} as Record<string, unknown>);
      (node.data.hProperties as Record<string, unknown>).className = `admonition admonition-${type}`;

      // Prepend admonition header as first child
      const headerParagraph: Paragraph = {
        type: 'paragraph',
        data: {
          hProperties: { className: 'admonition-header' },
        },
        children: [{ type: 'text', value: type.toUpperCase() } as Text],
      };

      node.children.unshift(headerParagraph);
    });
  };
}
