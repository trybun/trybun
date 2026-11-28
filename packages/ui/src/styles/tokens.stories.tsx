import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { tokenColor, tokenContrast } from '../../.storybook/colours.js';

// The colour pairs of the theme that must stay legible (2026-11-27-brand-teal-palette,
// 2026-11-28-design-system-foundations, §13.4). The story tests run once per theme, so every pair
// is checked in the light and the dark theme.
interface Pair {
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
  readonly use: string;
}

// Every surface that text, fields and the focus ring sit on.
const SURFACES = [
  '--background',
  '--card',
  '--popover',
  '--sidebar',
  '--sunken',
  '--muted',
  '--accent',
  '--accent-active',
] as const;

const STATUSES = ['--destructive', '--success', '--warning', '--info'] as const;

const PAIRS: readonly Pair[] = [
  {
    foreground: '--primary-foreground',
    background: '--primary',
    minimum: 4.5,
    use: 'Primary button text',
  },
  {
    foreground: '--primary-foreground',
    background: '--primary-hover',
    minimum: 4.5,
    use: 'Primary button text on hover',
  },
  { foreground: '--link', background: '--background', minimum: 4.5, use: 'Link in running text' },
  {
    foreground: '--foreground',
    background: '--selected',
    minimum: 4.5,
    use: 'Text of a selected row',
  },
  {
    foreground: '--muted-foreground',
    background: '--selected',
    minimum: 4.5,
    use: 'Secondary text of a selected row',
  },
  ...SURFACES.flatMap((surface) => [
    { foreground: '--foreground', background: surface, minimum: 4.5, use: `Text on ${surface}` },
    {
      foreground: '--muted-foreground',
      background: surface,
      minimum: 4.5,
      use: `Secondary text on ${surface}`,
    },
    { foreground: '--input', background: surface, minimum: 3, use: `Field border on ${surface}` },
    {
      foreground: '--input-hover',
      background: surface,
      minimum: 3,
      use: `Hovered field border on ${surface}`,
    },
    { foreground: '--link', background: surface, minimum: 4.5, use: `Link on ${surface}` },
    { foreground: '--ring', background: surface, minimum: 3, use: `Focus ring on ${surface}` },
  ]),
  // Error messages sit on the page, cards and popovers, never on a hovered or pressed row.
  ...(['--background', '--card', '--popover'] as const).map((surface) => ({
    foreground: '--destructive',
    background: surface,
    minimum: 4.5,
    use: `Error text on ${surface}`,
  })),
  ...STATUSES.flatMap((status) => [
    {
      foreground: `${status}-foreground`,
      background: status,
      minimum: 4.5,
      use: `Label on the ${status} fill`,
    },
    {
      foreground: `${status}-text`,
      background: `${status}-subtle`,
      minimum: 4.5,
      use: `Text on the ${status} subtle fill`,
    },
  ]),
];

function ColourPairs() {
  return (
    <table className="text-sm">
      <caption className="pb-2 text-left font-medium">Colour pairs of the theme</caption>
      <thead>
        <tr>
          <th scope="col" className="pr-4 text-left">
            Use
          </th>
          <th scope="col" className="pr-4 text-left">
            Foreground on background
          </th>
        </tr>
      </thead>
      <tbody>
        {PAIRS.map((pair) => (
          <tr key={pair.use}>
            <td className="pr-4">{pair.use}</td>
            <td className="pr-4 font-mono">
              {pair.foreground} on {pair.background} (≥ {pair.minimum}:1)
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const meta = {
  title: 'Foundations/Colour tokens',
  component: ColourPairs,
} satisfies Meta<typeof ColourPairs>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Every pair reaches its WCAG 2 minimum: 4.5:1 for text (1.4.3), 3:1 for field borders and the focus
 * ring (1.4.11).
 */
export const Contrast: Story = {
  play: async () => {
    for (const pair of PAIRS) {
      await expect(
        tokenContrast(pair.foreground, pair.background),
        `${pair.use}: ${pair.foreground} on ${pair.background}`,
      ).toBeGreaterThanOrEqual(pair.minimum);
    }
    // The focus ring never takes the danger colour, so a focused valid field never looks invalid.
    await expect(tokenColor('--ring')).not.toBe(tokenColor('--destructive'));
  },
};
