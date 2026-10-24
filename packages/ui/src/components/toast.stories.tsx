import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { expect, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import { createToastManager, Toaster } from './toast.js';

const TYPES = [
  { type: 'success', title: 'Ticket closed', description: 'TRY-42 was closed.' },
  { type: 'info', title: 'New comment', description: 'Anna replied to TRY-42.' },
  { type: 'warning', title: 'SLA at risk', description: 'TRY-42 is due in 30 minutes.' },
  { type: 'error', title: 'Not saved', description: 'The ticket was changed by someone else.' },
] as const;

/** A toast manager per story, so stories do not share toasts. */
function ToastDemo({ open = false }: { open?: boolean }) {
  const [manager] = useState(createToastManager);
  useEffect(() => {
    if (open) {
      for (const toast of TYPES) {
        manager.add({ ...toast, timeout: 0 });
      }
    }
  }, [manager, open]);
  return (
    <Toaster toastManager={manager}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            manager.add({
              type: 'success',
              title: 'Ticket closed',
              description: 'TRY-42 was closed.',
              actionProps: { children: 'Undo' },
            })
          }
        >
          Close ticket
        </Button>
      </div>
    </Toaster>
  );
}

const meta = {
  title: 'Components/Toast',
  component: ToastDemo,
} satisfies Meta<typeof ToastDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close ticket' }));
    await expect(await screen.findByText('TRY-42 was closed.')).toBeVisible();
    await expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible();
    // Base UI hides the close button from screen readers until the toasts are expanded or focused;
    // keyboard users reach them with F6.
    await userEvent.click(screen.getByLabelText('Close notification'));
    await waitFor(() => expect(screen.queryByText('TRY-42 was closed.')).not.toBeInTheDocument());
  },
};

export const Types: Story = { args: { open: true } };

export const Polish: Story = {
  args: { open: true },
  globals: { locale: 'pl' },
  play: async () => {
    await expect((await screen.findAllByLabelText('Zamknij powiadomienie')).length).toBe(
      TYPES.length,
    );
  },
};

export const Phone: Story = { args: { open: true }, globals: viewport('phone') };

export const Tablet: Story = { args: { open: true }, globals: viewport('tablet') };

export const Desktop: Story = { args: { open: true }, globals: viewport('desktop') };
