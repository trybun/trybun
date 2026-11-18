import {
  isLiteralElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  type MessageFormatElement,
  parse,
  TYPE,
} from '@formatjs/icu-messageformat-parser';
import { printAST } from '@formatjs/icu-messageformat-parser/printer.js';
import type { Messages } from '../catalogues/index.js';

/**
 * The pseudo-locale of the tests (§2.9, §13.1): English, accented and stretched. `XA` is a
 * private-use region of ISO 3166, the tag Android, Chromium and FormatJS use for this purpose.
 * It is not a language of the product: it is never in `LOCALES` or `CATALOGUES`.
 */
export const PSEUDO_LOCALE = 'en-XA';

export type PseudoLocale = typeof PSEUDO_LOCALE;

export function isPseudoLocale(value: unknown): value is PseudoLocale {
  return value === PSEUDO_LOCALE;
}

/**
 * How much a text of `length` characters grows in translation: the lower bound of each band of
 * W3C Internationalization, "Text size in translation" – short texts grow the most.
 */
export function stretchFactor(length: number): number {
  if (length <= 10) return 2;
  if (length <= 20) return 1.8;
  if (length <= 30) return 1.6;
  if (length <= 50) return 1.4;
  if (length <= 70) return 1.5;
  return 1.3;
}

/** The markers around every message: a cut-off text shows a missing one. */
export const PSEUDO_MARKERS = ['[', ']'] as const;

/**
 * Accented forms of the ASCII letters within Latin-1 (U+00C0–U+00FF), the range of the `latin`
 * subset of the web font, so the stretched text is measured in the font of the product rather
 * than in a fallback font. Letters without a Latin-1 accented form stay as they are.
 */
const ACCENTED: Readonly<Record<string, string>> = {
  a: 'á',
  c: 'ç',
  d: 'ð',
  e: 'é',
  i: 'í',
  n: 'ñ',
  o: 'ó',
  u: 'ú',
  y: 'ý',
  A: 'Á',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  I: 'Í',
  N: 'Ñ',
  O: 'Ó',
  U: 'Ú',
  Y: 'Ý',
};

const WORD = /\p{L}+/gu;
const LETTER = /\p{L}/u;
const VOWEL = /[aeiouyAEIOUY]/;

/** The length of the literal text of a message; a plural or select counts by its longest option. */
function literalLength(elements: MessageFormatElement[]): number {
  let length = 0;
  for (const element of elements) {
    if (isLiteralElement(element)) {
      length += element.value.length;
    } else if (isTagElement(element)) {
      length += literalLength(element.children);
    } else if (isPluralElement(element) || isSelectElement(element)) {
      length += Math.max(
        0,
        ...Object.values(element.options).map((option) => literalLength(option.value)),
      );
    }
  }
  return length;
}

/** Splits `total` over `weights` in proportion to them (largest remainder), summing to `total`. */
function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((weight) => (total * weight) / sum);
  const parts = shares.map(Math.floor);
  const order = shares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let left = total - parts.reduce((a, b) => a + b, 0), i = 0; left > 0; left--, i++) {
    parts[order[i % order.length]!.index]! += 1;
  }
  return parts;
}

/** Lengthens a word by `extra` letters, repeating its vowels in turn (else its last letter). */
function lengthenWord(word: string, extra: number): string {
  const letters = [...word];
  const positions = letters.flatMap((letter, index) => (VOWEL.test(letter) ? [index] : []));
  const targets = positions.length > 0 ? positions : [letters.length - 1];
  const repeats = apportion(
    extra,
    targets.map(() => 1),
  );
  return letters
    .map((letter, index) => {
      const target = targets.indexOf(index);
      return target === -1 ? letter : letter.repeat(1 + repeats[target]!);
    })
    .join('');
}

function accent(text: string): string {
  return [...text].map((character) => ACCENTED[character] ?? character).join('');
}

/**
 * Stretches a literal by the factor of its message. A literal without a letter – spaces and
 * punctuation between arguments – keeps its length; the words of the others grow in proportion
 * to their length, so the places where a line can break stay where English has them.
 */
function stretchLiteral(value: string, factor: number): string {
  if (!LETTER.test(value)) {
    return value;
  }
  const extra = Math.ceil(value.length * factor) - value.length;
  const words = value.match(WORD) ?? [];
  const extras = apportion(
    extra,
    words.map((word) => word.length),
  );
  let index = 0;
  return accent(value.replace(WORD, (word) => lengthenWord(word, extras[index++]!)));
}

function stretchElements(elements: MessageFormatElement[], factor: number): MessageFormatElement[] {
  return elements.map((element) => {
    if (isLiteralElement(element)) {
      return { ...element, value: stretchLiteral(element.value, factor) };
    }
    if (isTagElement(element)) {
      return { ...element, children: stretchElements(element.children, factor) };
    }
    if (isPluralElement(element) || isSelectElement(element)) {
      return {
        ...element,
        options: Object.fromEntries(
          Object.entries(element.options).map(([key, option]) => [
            key,
            { ...option, value: stretchElements(option.value, factor) },
          ]),
        ),
      };
    }
    return element;
  });
}

/** One message in the pseudo-locale: accented, stretched and between the markers. */
export function pseudoLocalizeMessage(message: string): string {
  const elements = parse(message);
  const stretched = stretchElements(elements, stretchFactor(literalLength(elements)));
  const [open, close] = PSEUDO_MARKERS;
  return printAST([
    { type: TYPE.literal, value: open },
    ...stretched,
    { type: TYPE.literal, value: close },
  ]);
}

function pseudoLocalizeTree(tree: object): object {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? pseudoLocalizeMessage(value)
        : pseudoLocalizeTree(value as object),
    ]),
  );
}

/**
 * The messages of the pseudo-locale, generated from a catalogue (in practice the English one):
 * every key stays, ICU arguments, plural and select syntax and tags stay intact, and only the
 * literal text is accented, stretched by `stretchFactor` and put between `PSEUDO_MARKERS`.
 */
export function pseudoLocalize(messages: Messages): Messages {
  return pseudoLocalizeTree(messages) as Messages;
}
