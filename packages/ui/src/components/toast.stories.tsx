import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { expect, screen, waitFor, within } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog.js';
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

/** A toast added from an open dialog, like "Link copied" of the invitation link (#172). */
function ToastInDialogDemo() {
  const [manager] = useState(createToastManager);
  return (
    <Toaster toastManager={manager}>
      <Dialog>
        <DialogTrigger render={<Button variant="outline" />}>Copy new link</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New invitation link</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => manager.add({ type: 'success', title: 'Link copied' })}>
              Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Toaster>
  );
}

// On phones the dialog is a bottom sheet: the toast stays above it (#172) and sits at the top of the
// screen, so it never covers the actions of the sheet (#207).
export const AboveDialogOnPhone: Story = {
  render: () => <ToastInDialogDemo />,
  globals: viewport('phone'),
  play: async ({ canvas, userEvent }) => {
    // The dialog opens after the toaster mounted, so its portal comes later in the document.
    await userEvent.click(canvas.getByRole('button', { name: 'Copy new link' }));
    const dialog = await screen.findByRole('dialog', { name: 'New invitation link' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    const title = await screen.findByText('Link copied');
    await waitFor(async () => {
      const { left, top, width, height } = title.getBoundingClientRect();
      const topmost = document.elementFromPoint(left + width / 2, top + height / 2);
      await expect(title.contains(topmost)).toBe(true);
    });
    const action = within(dialog).getByRole('button', { name: 'Copy link' });
    const toastBox = title.closest('[data-slot="toast"]')!.getBoundingClientRect();
    const actionBox = action.getBoundingClientRect();
    await expect(toastBox.bottom).toBeLessThan(actionBox.top);
    const center = document.elementFromPoint(
      actionBox.left + actionBox.width / 2,
      actionBox.top + actionBox.height / 2,
    );
    await expect(action.contains(center)).toBe(true);
    await userEvent.click(screen.getByLabelText('Close notification'));
    await waitFor(() => expect(screen.queryByText('Link copied')).not.toBeInTheDocument());
    await expect(dialog).toBeInTheDocument();
  },
};

/** A toast added before the toaster mounts, as `LazyToaster` does after the first paint. */
function ToastBeforeToasterDemo() {
  const [manager] = useState(createToastManager);
  const [hasToaster, setHasToaster] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => manager.add({ type: 'success', title: 'Assigned to Jan', timeout: 0 })}
      >
        Assign
      </Button>
      <Button variant="outline" onClick={() => setHasToaster(true)}>
        Mount the toaster
      </Button>
      {hasToaster && <Toaster toastManager={manager} />}
    </div>
  );
}

// Base UI passes a toast only to the toasters listening at that moment; the manager keeps it until
// one does, so an action right after the first paint keeps its confirmation.
export const AddedBeforeTheToaster: Story = {
  render: () => <ToastBeforeToasterDemo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Assign' }));
    await expect(screen.queryByText('Assigned to Jan')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Mount the toaster' }));
    await expect(await screen.findByText('Assigned to Jan')).toBeVisible();
  },
};

/** A toast with an action, counting its presses, like **Undo** of a change. */
function ToastActionDemo() {
  const [manager] = useState(createToastManager);
  const [undone, setUndone] = useState(0);
  return (
    <Toaster toastManager={manager}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() =>
            manager.add({
              type: 'success',
              title: 'Priority changed to Critical',
              timeout: 0,
              actionProps: { children: 'Undo', onClick: () => setUndone((count) => count + 1) },
            })
          }
        >
          Change priority
        </Button>
        <output>Undone {undone} times</output>
      </div>
    </Toaster>
  );
}

// Pressing the action closes its toast at once, and a second press – a double click – never
// repeats it (Material Design snackbar, Sonner).
export const ActionClosesTheToast: Story = {
  render: () => <ToastActionDemo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Change priority' }));
    const title = await screen.findByText('Priority changed to Critical');
    await expect(title).toBeVisible();

    await userEvent.dblClick(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() =>
      expect(screen.queryByText('Priority changed to Critical')).not.toBeInTheDocument(),
    );
    await expect(canvas.getByText('Undone 1 times')).toBeInTheDocument();
  },
};
