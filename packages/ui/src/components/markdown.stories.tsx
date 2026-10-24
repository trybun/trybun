import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Markdown } from './markdown.js';

const HELP_PAGE = `Trybun is where you report problems and requests to the team.

## Sign in

1. Open the address of Trybun in your browser.
2. Sign in with your account.

## Find your way around

- The **header** shows the help icon and your account menu.
- The *main navigation* lists the places you can go.

See [Change the language](../how-to/change-language.md) or press \`Ctrl+K\`.

> The search also finds words with small typos.

| Status | Meaning |
|---|---|
| Open | Waiting for the team |
| Done | Resolved |

\`\`\`sh
pnpm help:generate
\`\`\`
`;

const meta = {
  title: 'Components/Markdown',
  component: Markdown,
  args: { children: HELP_PAGE, className: 'max-w-prose' },
} satisfies Meta<typeof Markdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { children: '' } };

/** Raw HTML is sanitized and unsafe link protocols are removed (§13.5). */
export const Sanitized: Story = {
  args: {
    children:
      'Text <img src="x" onerror="alert(1)"> with <script>alert(1)</script> and [a link](javascript:alert(1)).',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('script')).toBeNull();
    await expect(canvasElement.querySelector('[onerror]')).toBeNull();
    const link = within(canvasElement).getByText('a link');
    await expect(link.getAttribute('href') ?? '').not.toContain('javascript');
  },
};

/** Relative links are resolved by the application, e.g. to the address of a help page. */
export const WithUrlTransform: Story = {
  args: {
    children: 'See [Change the language](../how-to/change-language.md).',
    urlTransform: (url) => url.replace(/^\.\.\/(.*)\.md$/, '/help/end-user/$1'),
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Change the language' });
    await expect(link).toHaveAttribute('href', '/help/end-user/how-to/change-language');
  },
};

export const Phone: Story = { globals: viewport('phone') };

export const Tablet: Story = { globals: viewport('tablet') };

export const Desktop: Story = { globals: viewport('desktop') };
