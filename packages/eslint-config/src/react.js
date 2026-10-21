// Lint rules of React code (§18.5, §18.6).
import reactHooks from 'eslint-plugin-react-hooks';

/** No string literals in JSX: texts come from translations (§18.5). */
const TRANSLATE = 'Use a translated message instead of a string literal (§18.5).';

export const JSX_TEXT_LITERALS = [
  { selector: 'JSXText[value=/\\p{L}/u]', message: TRANSLATE },
  { selector: 'JSXExpressionContainer > Literal[value=/\\p{L}/u]', message: TRANSLATE },
  {
    selector:
      'JSXAttribute[name.name=/^(aria-label|aria-description|alt|title|placeholder)$/] > Literal[value=/\\p{L}/u]',
    message: TRANSLATE,
  },
];

/** Base UI composes through the `render` prop (§18.9). */
export const NO_AS_CHILD = {
  selector: "JSXAttribute[name.name='asChild']",
  message: 'Use the `render` prop of Base UI instead of `asChild` (§18.6).',
};

/** The `recommended` preset of eslint-plugin-react-hooks, every rule as an error (§14.2). */
export const reactHooksRecommended = {
  name: 'trybun/react-hooks',
  files: ['**/*.{ts,tsx}'],
  plugins: reactHooks.configs.flat.recommended.plugins,
  rules: Object.fromEntries(
    Object.keys(reactHooks.configs.flat.recommended.rules).map((rule) => [rule, 'error']),
  ),
};

export const react = [
  reactHooksRecommended,
  {
    name: 'trybun/react',
    files: ['**/*.tsx'],
    ignores: ['**/*.spec.tsx', '**/*.stories.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...JSX_TEXT_LITERALS, NO_AS_CHILD],
    },
  },
];
