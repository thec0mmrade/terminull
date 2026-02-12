import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

// Note: we need to install unist-util-visit
export function rehypeTerminalCode() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre') return;

      const codeEl = node.children.find(
        (child): child is Element =>
          child.type === 'element' && child.tagName === 'code'
      );

      if (!codeEl) return;

      // Extract language from class
      const className = (codeEl.properties?.className as string[] || []).join(' ');
      const langMatch = className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : '';

      if (!lang) return;

      // Create header element
      const header: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-header'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['code-lang'] },
            children: [{ type: 'text', value: lang }],
          },
        ],
      };

      // Wrap pre contents: add header before existing children
      node.children.unshift(header);
    });
  };
}
