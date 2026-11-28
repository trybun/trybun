import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { tokenColor, tokenContrast } from '../../.storybook/colours.js';

// The colour pairs of the theme that must stay legible (2026-11-27-brand-teal-palette, §13.4).
// The story tests run once per theme, so every pair is checked in the light and the dark theme.
const PAIRS = [
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
  { foreground: '--ring', background: '--background', minimum: 3, use: 'Focus ring on the page' },
  { foreground: '--ring', background: '--card', minimum: 3, use: 'Focus ring on a card' },
  { foreground: '--ring', background: '--popover', minimum: 3, use: 'Focus ring in a popover' },
  { foreground: '--ring', background: '--muted', minimum: 3, use: 'Focus ring on a muted surface' },
] as const;

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

/** Every pair reaches its WCAG 2 minimum: 4.5:1 for text (1.4.3), 3:1 for the focus ring (1.4.11). */
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
