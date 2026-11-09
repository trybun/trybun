import type { Element, ElementContent, Root } from 'hast';

type Parent = Root | Element;

/** The text of a list item without its nested lists: the name of its checkbox. */
function itemText(node: ElementContent): string {
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type !== 'element' || node.tagName === 'ul' || node.tagName === 'ol') {
    return '';
  }
  return node.children.map(itemText).join('');
}

function findCheckbox(item: Element): Element | undefined {
  for (const child of item.children) {
    if (child.type !== 'element') {
      continue;
    }
    if (child.tagName === 'input') {
      return child;
    }
    // A loose list wraps the item's content in a paragraph.
    if (child.tagName === 'p') {
      return findCheckbox(child);
    }
  }
  return undefined;
}

function label(parent: Parent): void {
  for (const child of parent.children) {
    if (child.type !== 'element') {
      continue;
    }
    if (child.tagName === 'li') {
      const checkbox = findCheckbox(child);
      if (checkbox !== undefined) {
        checkbox.properties.ariaLabel = child.children.map(itemText).join('').trim();
      }
    }
    label(child);
  }
}

/**
 * Names the read-only checkbox of a task-list item by the item's text (§13.4), so assistive
 * technology announces "Fix the export, checkbox, checked". Runs after sanitizing.
 */
export function rehypeTaskListLabels() {
  return (tree: Root): void => {
    label(tree);
  };
}
