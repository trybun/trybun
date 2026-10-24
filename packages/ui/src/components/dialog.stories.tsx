import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog.js';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  render: (args: ComponentProps<typeof Dialog>) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="outline" />}>Close ticket</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close the ticket?</DialogTitle>
          <DialogDescription>
            The customer is notified and can reopen the ticket within 14 days.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Close ticket</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close ticket' }));
    const dialog = await screen.findByRole('dialog', { name: 'Close the ticket?' });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  },
};

export const Open: Story = { args: { defaultOpen: true } };

export const Polish: Story = {
  args: { defaultOpen: true },
  globals: { locale: 'pl' },
  play: async () => {
    await expect(await screen.findByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
  },
};

// A bottom sheet on phones, a centered dialog from tablets on (§2.9).
export const Phone: Story = {
  args: { defaultOpen: true },
  globals: viewport('phone'),
  play: async () => {
    const dialog = await screen.findByRole('dialog');
    await waitFor(async () => {
      const { bottom, width } = dialog.getBoundingClientRect();
      await expect(Math.round(bottom)).toBe(window.innerHeight);
      await expect(width).toBe(window.innerWidth);
    });
  },
};

export const Tablet: Story = {
  args: { defaultOpen: true },
  globals: viewport('tablet'),
  play: async () => {
    const dialog = await screen.findByRole('dialog');
    await waitFor(async () => {
      const { top, bottom } = dialog.getBoundingClientRect();
      await expect(Math.round(top)).toBe(Math.round(window.innerHeight - bottom));
    });
  },
};

export const Desktop: Story = { args: { defaultOpen: true }, globals: viewport('desktop') };
