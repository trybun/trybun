import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Markdown } from './markdown.js';

const ALLOWED_ID = '0b9c3f6e-2d1a-4e8b-9c7d-5a6f1e2d3c4b';

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

/** Raw HTML is not rendered and links with unsafe protocols are plain text (§13.5). */
export const Sanitized: Story = {
  args: {
    children:
      'Text <img src="x" onerror="alert(1)"> with <script>alert(1)</script> and [a link](javascript:alert(1)).',
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('script')).toBeNull();
    await expect(canvasElement.querySelector('[onerror]')).toBeNull();
    // A link with an unsafe target renders as its plain text.
    await expect(within(canvasElement).queryByRole('link')).toBeNull();
    await expect(canvasElement).toHaveTextContent('and a link.');
  },
};

/** Code blocks with a language are highlighted with the theme's tokens (§6.2). */
export const Code: Story = {
  args: {
    children: `Inline \`code\` and a block:

\`\`\`ts
// Returns the answer.
export function answer(question: string): number {
  return question.length > 0 ? 42 : 0;
}
\`\`\`
`,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.hljs-keyword')).not.toBeNull();
  },
};

/** A table scrolls sideways on narrow screens instead of widening the page (Rule 9). */
export const Table: Story = {
  args: {
    children: `| Ticket | Title | Status | Assignee | Updated |
|---|---|---|---|---|
| ERP-101 | Invoices are not exported to the accounting system | In progress | Anna Nowak | 2026-11-04 |
| ERP-102 | Printing a delivery note takes a minute | Open | – | 2026-11-05 |
`,
  },
};

/**
 * Only attachments the view allows render as images (§13.3); an external image and an image of an
 * unknown attachment render as links (§6.2).
 */
export const Images: Story = {
  args: {
    attachmentImageIds: [ALLOWED_ID],
    children: `![Screenshot of the error](/api/v1/attachments/${ALLOWED_ID}/content)

![External logo](https://example.com/logo.png)

![Another ticket's file](/api/v1/attachments/7e1d2c3b-4a5f-4e6d-8c9b-0a1f2e3d4c5b/content)
`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'Screenshot of the error' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'External logo' })).toHaveAttribute(
      'rel',
      'nofollow ugc noopener noreferrer',
    );
    await expect(canvas.getByRole('link', { name: "Another ticket's file" })).toBeInTheDocument();
    await expect(canvas.getAllByRole('img')).toHaveLength(1);
  },
};

/** Task lists render with read-only checkboxes (§6.2). */
export const TaskList: Story = {
  args: { children: '- [x] Reproduce the error\n- [ ] Fix the export\n- [ ] Tell the requester' },
  play: async ({ canvasElement }) => {
    const boxes = within(canvasElement).getAllByRole('checkbox');
    await expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      await expect(box).toBeDisabled();
    }
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
