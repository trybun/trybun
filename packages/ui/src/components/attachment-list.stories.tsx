import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ComponentProps } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { AttachmentItem, AttachmentList, type AttachmentState } from './attachment-list.js';

// A thumbnail without a network request.
const THUMBNAIL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#2563eb"/><circle cx="1" cy="1" r="0.6" fill="#ffffff"/></svg>',
)}`;

type Item = Omit<ComponentProps<typeof AttachmentItem>, 'onDelete'> & { id: string };

const ITEMS: Item[] = [
  {
    id: '1',
    fileName: 'screenshot.png',
    size: 482_133,
    contentType: 'image/png',
    href: '#screenshot',
    state: 'available',
    thumbnailUrl: THUMBNAIL,
  },
  {
    id: '2',
    fileName: 'server-log-2026-11-06.txt',
    size: 1_572_864,
    contentType: 'text/plain',
    href: '#log',
    state: 'available',
  },
  {
    id: '3',
    fileName: 'invoice.pdf',
    size: 98_304,
    contentType: 'application/pdf',
    href: '#invoice',
    state: 'uploading',
  },
  {
    id: '4',
    fileName: 'report.xlsx',
    size: 24_576,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    href: '#report',
    state: 'checking',
  },
  {
    id: '5',
    fileName: 'setup.zip',
    size: 3_145_728,
    contentType: 'application/zip',
    href: '#setup',
    state: 'infected',
  },
  {
    id: '6',
    fileName: 'archive.7z',
    size: 734,
    contentType: 'application/x-7z-compressed',
    href: '#archive',
    state: 'rejected',
  },
];

interface DemoProps {
  items?: Item[];
  /** Omits Delete, as for a reader without the `delete` action. */
  readOnly?: boolean;
  onDelete?: (fileName: string) => void;
}

/** A list whose Delete removes the item, as the feature does after its confirmation. */
function AttachmentListDemo({ items = ITEMS, readOnly = false, onDelete }: DemoProps) {
  const [shown, setShown] = useState(items);
  return (
    <AttachmentList aria-label="Attachments">
      {shown.map(({ id, ...item }) => (
        <AttachmentItem
          key={id}
          {...item}
          onDelete={
            readOnly
              ? undefined
              : () => {
                  onDelete?.(item.fileName);
                  setShown((current) => current.filter((other) => other.id !== id));
                }
          }
        />
      ))}
    </AttachmentList>
  );
}

const meta = {
  title: 'Components/AttachmentList',
  component: AttachmentListDemo,
  args: { onDelete: fn() },
} satisfies Meta<typeof AttachmentListDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

const only = (state: AttachmentState, image = false) =>
  ITEMS.filter((item) => item.state === state && (item.thumbnailUrl !== undefined) === image);

// Every state carries a text and an icon; a removed file is no link.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('link', { name: 'screenshot.png (opens in a new tab)' }),
    ).toHaveAttribute('href', '#screenshot');
    await expect(canvas.getByText('Uploading…')).toBeVisible();
    await expect(canvas.getByText('Checking…')).toBeVisible();
    await expect(canvas.getByText('File removed: malware detected')).toBeVisible();
    await expect(canvas.getByText('File removed: could not be checked')).toBeVisible();
    for (const name of ['invoice.pdf', 'report.xlsx', 'setup.zip', 'archive.7z']) {
      await expect(canvas.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    await expect(canvas.getByText('1.5 MB')).toBeVisible();
    await expect(canvas.getByText('734 bytes')).toBeVisible();
  },
};

export const Uploading: Story = { args: { items: only('uploading') } };

export const Checking: Story = { args: { items: only('checking') } };

// An image opens in a new tab, so the application tab stays, and says so (§13.3, WCAG G201).
export const AvailableImage: Story = {
  args: { items: only('available', true) },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'screenshot.png (opens in a new tab)' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(canvas.getByRole('presentation')).toHaveAttribute('src', THUMBNAIL);
  },
};

// Any other file is a download: a link in the same tab, without the new-tab hint.
export const AvailableFile: Story = {
  args: {
    items: [
      ...only('available'),
      {
        id: '8',
        fileName: 'contract.pdf',
        size: 98_304,
        contentType: 'application/pdf',
        href: '#contract',
        state: 'available',
      },
    ],
  },
  play: async ({ canvas }) => {
    for (const name of ['server-log-2026-11-06.txt', 'contract.pdf']) {
      const link = canvas.getByRole('link', { name });
      await expect(link).not.toHaveAttribute('target');
      await expect(link).not.toHaveAttribute('rel');
    }
  },
};

// Without a media type a file counts as a download.
export const AvailableWithoutType: Story = {
  args: {
    items: [{ id: '7', fileName: 'notes', size: 512, href: '#notes', state: 'available' }],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'notes' })).not.toHaveAttribute('target');
  },
};

export const Infected: Story = { args: { items: only('infected') } };

export const Rejected: Story = { args: { items: only('rejected') } };

// Without the `delete` action the caller passes no `onDelete`, and no Delete is shown.
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

// Delete by keyboard only: the button is named after the file.
export const DeleteByKeyboard: Story = {
  args: { items: only('available') },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('link', { name: 'server-log-2026-11-06.txt' })).toHaveFocus();
    await userEvent.tab();
    const remove = canvas.getByRole('button', { name: 'Delete server-log-2026-11-06.txt' });
    await expect(remove).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onDelete).toHaveBeenCalledWith('server-log-2026-11-06.txt');
    await expect(canvas.queryByText('server-log-2026-11-06.txt')).not.toBeInTheDocument();
  },
};

/** An upload checked and released, as the polling of the feature delivers it. */
function StateChangeDemo() {
  const [state, setState] = useState<AttachmentState>('uploading');
  useEffect(() => {
    const next: Partial<Record<AttachmentState, AttachmentState>> = {
      uploading: 'checking',
      checking: 'available',
    };
    const following = next[state];
    if (following === undefined) {
      return undefined;
    }
    const timer = setTimeout(() => setState(following), 200);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <AttachmentList aria-label="Attachments">
      <AttachmentItem
        fileName="screenshot.png"
        size={482_133}
        contentType="image/png"
        href="#screenshot"
        state={state}
        thumbnailUrl={THUMBNAIL}
      />
      <AttachmentItem
        fileName="setup.zip"
        size={3_145_728}
        contentType="application/zip"
        href="#setup"
        state={state === 'available' ? 'infected' : 'checking'}
      />
    </AttachmentList>
  );
}

// The polite live region announces each change, also of two items in one update; the first
// render is not announced.
export const StateChanges: Story = {
  render: () => <StateChangeDemo />,
  play: async ({ canvas }) => {
    const region = canvas.getByRole('status');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toBeEmptyDOMElement();
    await waitFor(() => expect(region).toHaveTextContent('screenshot.png: Checking…'));
    await waitFor(() => expect(region).toHaveTextContent('screenshot.png: Available'));
    await expect(region).toHaveTextContent('setup.zip: File removed: malware detected');
    await expect(
      canvas.getByRole('link', { name: 'screenshot.png (opens in a new tab)' }),
    ).toBeVisible();
  },
};

// The texts of the component come from the catalogues, also in Polish (§18.6).
export const Polish: Story = {
  globals: { locale: 'pl' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Przesyłanie…')).toBeVisible();
    await expect(canvas.getByText('Sprawdzanie…')).toBeVisible();
    await expect(canvas.getByText('Plik usunięty: wykryto złośliwe oprogramowanie')).toBeVisible();
    await expect(canvas.getByText('Plik usunięty: nie można go sprawdzić')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Usuń invoice.pdf' })).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'screenshot.png (otwiera się w nowej karcie)' }),
    ).toHaveAttribute('target', '_blank');
    await expect(canvas.getByText('1,5 MB')).toBeVisible();
  },
};

/** The hit area of a link: its `after` element stretched over the item. */
function hitHeight(link: HTMLElement) {
  return Number.parseFloat(getComputedStyle(link, '::after').height);
}

// One column on phones; Delete and the links are 44 px targets on phones and tablets (§2.9).
export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    const lefts = canvas
      .getAllByRole('listitem')
      .map((item) => Math.round(item.getBoundingClientRect().left));
    await expect(new Set(lefts).size).toBe(1);
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    }
    for (const link of canvas.getAllByRole('link')) {
      await expect(hitHeight(link)).toBeGreaterThanOrEqual(44);
    }
  },
};

export const Tablet: Story = {
  globals: viewport('tablet'),
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    for (const link of canvas.getAllByRole('link')) {
      await expect(hitHeight(link)).toBeGreaterThanOrEqual(44);
    }
  },
};

export const Desktop: Story = {
  globals: viewport('desktop'),
  play: async ({ canvas }) => {
    for (const link of canvas.getAllByRole('link')) {
      await expect(hitHeight(link)).toBeGreaterThanOrEqual(44);
    }
  },
};
