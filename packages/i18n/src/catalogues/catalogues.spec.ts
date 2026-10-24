// The checks of the message catalogues in CI (§13.1): a missing, extra or malformed translation
// fails the tests.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  isLiteralElement,
  isPluralElement,
  isPoundElement,
  isSelectElement,
  isTagElement,
  type MessageFormatElement,
  parse,
} from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';
import { CATALOGUES, LOCALES } from './index.js';

const MESSAGES_DIR = join(import.meta.dirname, '../../messages');

/** The messages of a catalogue by their full dot-separated key. */
function flatten(tree: object, prefix = ''): Map<string, unknown> {
  const messages = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key}`;
    if (typeof value === 'object' && value !== null) {
      for (const entry of flatten(value as object, `${path}.`)) {
        messages.set(...entry);
      }
    } else {
      messages.set(path, value);
    }
  }
  return messages;
}

/** The names of the arguments and tags of a parsed message, sorted. */
function argumentNames(elements: MessageFormatElement[]): string[] {
  const names = new Set<string>();
  const visit = (nodes: MessageFormatElement[]) => {
    for (const node of nodes) {
      if (isTagElement(node)) {
        names.add(`<${node.value}>`);
        visit(node.children);
      } else if (isPluralElement(node) || isSelectElement(node)) {
        names.add(node.value);
        Object.values(node.options).forEach((option) => visit(option.value));
      } else if (!isLiteralElement(node) && !isPoundElement(node)) {
        names.add(node.value);
      }
    }
  };
  visit(elements);
  return [...names].sort();
}

const reference = flatten(CATALOGUES.en);

describe('message catalogues', () => {
  it('has a catalogue for every file in messages/', () => {
    const files = readdirSync(MESSAGES_DIR).map((file) => file.replace(/\.json$/, ''));

    expect([...LOCALES].sort()).toEqual(files.sort());
  });

  describe.each(LOCALES)('%s', (locale) => {
    const messages = flatten(CATALOGUES[locale]);

    it('has exactly the keys of the English catalogue', () => {
      expect([...messages.keys()].sort()).toEqual([...reference.keys()].sort());
    });

    it.each([...messages])(
      '%s is a valid message with the arguments of English',
      (key, message) => {
        expect(typeof message === 'string' && message.trim() !== '').toBe(true);
        const elements = parse(message as string);
        expect(argumentNames(elements)).toEqual(argumentNames(parse(reference.get(key) as string)));
      },
    );
  });
});
