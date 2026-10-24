// Lint rules of Tailwind CSS classes (§2.6): only the tokens of the theme are used.
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';

/**
 * Utilities of the token categories – colours, spacing, sizing, typography, radii and shadows –
 * as the start of a class (after its variants and the important or negative prefix).
 */
const TOKEN_UTILITIES = [
  'bg',
  'text',
  'font',
  'leading',
  'tracking',
  'indent',
  'decoration',
  'underline-offset',
  'border(?:-[xytrblse])?',
  'divide(?:-[xy])?',
  'outline(?:-offset)?',
  'ring(?:-offset)?',
  'inset-ring',
  'shadow',
  'inset-shadow',
  'drop-shadow',
  'text-shadow',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
  'accent',
  'caret',
  'placeholder',
  'p[xytrblse]?',
  'm[xytrblse]?',
  'scroll-[mp][xytrblse]?',
  'gap(?:-[xy])?',
  'space-[xy]',
  'w',
  'h',
  'size',
  'min-[wh]',
  'max-[wh]',
  'basis',
  'inset(?:-[xy])?',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'rounded(?:-[a-z]{1,2})?',
];

/**
 * Arbitrary values in the token categories (`bg-[#E0482C]`, `p-[13px]`). CSS variables
 * (`h-(--drawer-height)`) and CSS-wide keywords (`rounded-[inherit]`) are allowed.
 */
export const ARBITRARY_TOKEN_VALUE = `(?:^|:)!?-?(?:${TOKEN_UTILITIES.join('|')})-\\[(?!(?:inherit|initial|unset|revert)\\])`;

/** A literal colour anywhere in an arbitrary value, property or variable. */
export const LITERAL_COLOUR =
  '\\[[^\\]]*(?:#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\\()';

const TOKENS_ONLY = 'Use a token of the theme instead of an arbitrary value (§2.6).';

/**
 * The correctness rules of eslint-plugin-better-tailwindcss and the ban on arbitrary values.
 * Class order is left to the Prettier plugin of Tailwind CSS.
 * @param {{ entryPoint: string }} options `entryPoint` is the CSS file with the theme
 */
export function tailwind({ entryPoint }) {
  return [
    {
      name: 'trybun/tailwind',
      files: ['**/*.{ts,tsx}'],
      plugins: { 'better-tailwindcss': betterTailwindcss },
      settings: { 'better-tailwindcss': { entryPoint } },
      rules: {
        ...betterTailwindcss.configs['correctness-error'].rules,
        'better-tailwindcss/no-restricted-classes': [
          'error',
          {
            restrict: [
              { pattern: ARBITRARY_TOKEN_VALUE, message: TOKENS_ONLY },
              { pattern: LITERAL_COLOUR, message: TOKENS_ONLY },
            ],
          },
        ],
      },
    },
  ];
}
