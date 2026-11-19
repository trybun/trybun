// The pseudo-locale of the tests (§2.9, §13.1): generated from the English catalogue, it keeps
// every key and valid ICU syntax, and only its literal text is accented and stretched.
import {
  isLiteralElement,
  isPluralElement,
  isPoundElement,
  isSelectElement,
  isTagElement,
  type MessageFormatElement,
  parse,
  TYPE,
} from '@formatjs/icu-messageformat-parser';
import type * as Printer from '@formatjs/icu-messageformat-parser/printer.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOGUES } from '../catalogues/index.js';
import { PSEUDO_LOCALE } from './index.js';
import {
  catalogueOf,
  PSEUDO_MARKERS,
  pseudoLocalize,
  pseudoLocalizeMessage,
  stretchFactor,
} from './messages.js';

/**
 * The printer of the ICU parser is a third-party boundary: a test can make it drop the last
 * argument, the way a printer bug would, to prove the generator refuses instead of breaking.
 */
const printer = vi.hoisted(() => ({ dropsLastArgument: false }));

vi.mock('@formatjs/icu-messageformat-parser/printer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof Printer>();
  return {
    ...actual,
    printAST: (elements: MessageFormatElement[]) => {
      if (!printer.dropsLastArgument) {
        return actual.printAST(elements);
      }
      const last = elements.findLastIndex((element) => element.type === TYPE.argument);
      return actual.printAST(elements.filter((_, index) => index !== last));
    },
  };
});

/** The messages of a catalogue by their full dot-separated key. */
function flatten(tree: object, prefix = ''): Map<string, string> {
  const messages = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key}`;
    if (typeof value === 'object' && value !== null) {
      for (const entry of flatten(value as object, `${path}.`)) {
        messages.set(...entry);
      }
    } else {
      messages.set(path, value as string);
    }
  }
  return messages;
}

/**
 * The structure of a message without its literal text: arguments with their type and style,
 * `#`, tags, and plural/select options with their keys and offsets, in order.
 */
function skeleton(elements: MessageFormatElement[]): unknown[] {
  return elements.flatMap((element): unknown[] => {
    if (isLiteralElement(element)) {
      return [];
    }
    if (isPoundElement(element)) {
      return ['#'];
    }
    if (isTagElement(element)) {
      return [{ tag: element.value, children: skeleton(element.children) }];
    }
    if (isPluralElement(element) || isSelectElement(element)) {
      return [
        {
          argument: element.value,
          type: element.type,
          offset: 'offset' in element ? element.offset : undefined,
          options: Object.fromEntries(
            Object.entries(element.options).map(([key, option]) => [key, skeleton(option.value)]),
          ),
        },
      ];
    }
    return [
      {
        argument: element.value,
        type: element.type,
        style: 'style' in element ? JSON.stringify(element.style) : undefined,
      },
    ];
  });
}

/**
 * Every literal of a message by its path – the argument and option key of each plural/select it
 * is in, and its position – so literals compare regardless of the order the printer gives options.
 */
function literals(elements: MessageFormatElement[], path = ''): Map<string, string> {
  const found = new Map<string, string>();
  elements.forEach((element, index) => {
    if (isLiteralElement(element)) {
      found.set(`${path}${index}`, element.value);
    } else if (isTagElement(element)) {
      for (const entry of literals(element.children, `${path}${index}<${element.value}>/`)) {
        found.set(...entry);
      }
    } else if (isPluralElement(element) || isSelectElement(element)) {
      for (const [key, option] of Object.entries(element.options)) {
        for (const entry of literals(option.value, `${path}${index}{${element.value} ${key}}/`)) {
          found.set(...entry);
        }
      }
    }
  });
  return found;
}

/** The literal text of a message; a plural or select counts by its longest option. */
function literalLength(elements: MessageFormatElement[]): number {
  return elements.reduce((length, element) => {
    if (isLiteralElement(element)) {
      return length + element.value.length;
    }
    if (isTagElement(element)) {
      return length + literalLength(element.children);
    }
    if (isPluralElement(element) || isSelectElement(element)) {
      const options = Object.values(element.options).map((option) => literalLength(option.value));
      return length + Math.max(0, ...options);
    }
    return length;
  }, 0);
}

/** Removes the markers from the first and the last literal of a parsed pseudo message. */
function withoutMarkers(elements: MessageFormatElement[]): MessageFormatElement[] {
  const [open, close] = PSEUDO_MARKERS;
  const copy = structuredClone(elements);
  const first = copy[0];
  const last = copy.at(-1);
  if (first && isLiteralElement(first) && first.value.startsWith(open)) {
    first.value = first.value.slice(open.length);
  }
  if (last && isLiteralElement(last) && last.value.endsWith(close)) {
    last.value = last.value.slice(0, -close.length);
  }
  return copy.filter((element) => !isLiteralElement(element) || element.value !== '');
}

const english = flatten(CATALOGUES.en);
const pseudo = flatten(pseudoLocalize(CATALOGUES.en));

describe('the pseudo-locale', () => {
  it('keeps every key of the English catalogue', () => {
    expect([...pseudo.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('is deterministic', () => {
    expect(pseudoLocalize(CATALOGUES.en)).toEqual(pseudoLocalize(CATALOGUES.en));
  });

  describe.each([...english])('%s', (key, message) => {
    const source = parse(message);
    const result = pseudo.get(key)!;
    const elements = parse(result);

    it('is a valid message with the structure of English', () => {
      expect(skeleton(elements)).toEqual(skeleton(source));
    });

    it('is between the markers', () => {
      expect(result.startsWith(PSEUDO_MARKERS[0])).toBe(true);
      expect(result.endsWith(PSEUDO_MARKERS[1])).toBe(true);
    });

    it('stretches every literal with a letter by the factor of the message', () => {
      const factor = stretchFactor(literalLength(source));
      const before = literals(source);
      const after = literals(withoutMarkers(elements));
      // A literal is never split, merged or moved.
      expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
      for (const [path, literal] of before) {
        const stretched = after.get(path)!;
        if (/\p{L}/u.test(literal)) {
          expect(stretched.length).toBeGreaterThanOrEqual(Math.ceil(literal.length * factor));
        } else {
          expect(stretched).toBe(literal);
        }
      }
    });
  });
});

describe('catalogueOf', () => {
  it('returns the catalogue of a language of the product as it is', () => {
    expect(catalogueOf('pl')).toBe(CATALOGUES.pl);
    expect(catalogueOf('en')).toBe(CATALOGUES.en);
  });

  it('generates the pseudo-locale once from English', () => {
    expect(catalogueOf(PSEUDO_LOCALE)).toEqual(pseudoLocalize(CATALOGUES.en));
    expect(catalogueOf(PSEUDO_LOCALE)).toBe(catalogueOf(PSEUDO_LOCALE));
  });
});

describe('stretchFactor', () => {
  it.each([
    [1, 2],
    [10, 2],
    [11, 1.8],
    [20, 1.8],
    [21, 1.6],
    [30, 1.6],
    [31, 1.4],
    [50, 1.4],
    [51, 1.5],
    [70, 1.5],
    [71, 1.3],
    [500, 1.3],
  ])('stretches %i characters by %d (lower bound of the W3C band)', (length, factor) => {
    expect(stretchFactor(length)).toBe(factor);
  });
});

describe('pseudoLocalizeMessage', () => {
  it('doubles a short label and accents it', () => {
    expect(pseudoLocalizeMessage('Bug')).toBe('[Búúúúg]');
  });

  it('keeps the number of words, so a line breaks where English does', () => {
    const result = pseudoLocalizeMessage('Pending sharing approvals');
    expect(result.slice(1, -1).split(' ')).toHaveLength(3);
    expect(result.length - 2).toBeGreaterThanOrEqual(40);
  });

  it('repeats the last letter of a word without a vowel', () => {
    expect(pseudoLocalizeMessage('CSV')).toBe('[ÇSVVVV]');
  });

  it('keeps plural options, # and the argument intact', () => {
    const result = pseudoLocalizeMessage('{count, plural, one {# ticket} other {# tickets}}');
    expect(result).toMatch(/^\[\{count,plural,one\{# \S+\} other\{# \S+\}\}\]$/);
  });

  it('keeps select options and tags intact', () => {
    expect(
      pseudoLocalizeMessage('{gender, select, female {She} other {They}} <link>replied</link>'),
    ).toMatch(/^\[\{gender,select,female\{\S+\} other\{\S+\}\} <link>\S+<\/link>\]$/);
  });

  it('leaves the separators between arguments as they are', () => {
    expect(pseudoLocalizeMessage('{a} · {b}')).toBe('[{a} · {b}]');
  });

  it('keeps the argument after a literal that ends with an apostrophe', () => {
    expect(pseudoLocalizeMessage("{a}''{b}")).toBe("[{a}''{b}]");
  });

  describe('when the ICU printer cannot write a message back', () => {
    afterEach(() => {
      printer.dropsLastArgument = false;
    });

    it('refuses the message instead of losing an argument', () => {
      printer.dropsLastArgument = true;
      expect(() => pseudoLocalizeMessage('{a} · {b}')).toThrow(/cannot keep the structure/);
    });
  });

  it('keeps quoted ICU syntax quoted', () => {
    const result = pseudoLocalizeMessage("It''s '{'literal'}'");
    expect(parse(result).every(isLiteralElement)).toBe(true);
    expect(result).toContain("'{");
  });

  it('adds no character outside Latin-1, the subset of the web font', () => {
    for (const [key, message] of pseudo) {
      const source = new Set(english.get(key));
      const added = [...message].filter(
        (character) => character.codePointAt(0)! > 0xff && !source.has(character),
      );
      expect(added, key).toEqual([]);
    }
  });
});
