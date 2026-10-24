import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import { TourTip, TourTipDescription, TourTipFooter, TourTipTitle } from './tour-tip.js';

const onNext = fn();
const onBack = fn();
const onSkip = fn();
const onClose = fn();

/** A tip next to a button of the page, as a tour shows it (§2.4). */
function Example({
  step = 2,
  stepCount = 4,
  hasTarget = true,
  sheetSide,
}: {
  step?: number;
  stepCount?: number;
  hasTarget?: boolean;
  sheetSide?: 'bottom' | 'top';
}) {
  const [target, setTarget] = useState<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="flex min-h-96 items-start">
      <Button ref={setTarget} variant="outline">
        Help
      </Button>
      {(!hasTarget || target !== null) && (
        <TourTip
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            onClose(open);
          }}
          anchor={hasTarget ? target : null}
          sheetSide={sheetSide}
          step={step}
          stepCount={stepCount}
        >
          <TourTipTitle>Help</TourTipTitle>
          <TourTipDescription>
            The help for each view is here, and you can take this tour again from it.
          </TourTipDescription>
          <TourTipFooter onBack={onBack} onNext={onNext} onSkip={onSkip} />
        </TourTip>
      )}
    </div>
  );
}

const meta = {
  title: 'Components/TourTip',
  component: Example,
} satisfies Meta<typeof Example>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ userEvent }) => {
    const tip = await screen.findByRole('dialog', { name: 'Step 2 of 4 Help' });
    const next = screen.getByRole('button', { name: 'Next' });
    // Focus moves to the primary action.
    await waitFor(() => expect(next).toHaveFocus());
    await userEvent.click(next);
    await expect(onNext).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await expect(onBack).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    await expect(onSkip).toHaveBeenCalledOnce();
    // A press on the page leaves the tip open: a tour never blocks work.
    await userEvent.click(screen.getByRole('button', { name: 'Help' }));
    await expect(tip).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(tip).not.toBeInTheDocument());
    await expect(onClose).toHaveBeenLastCalledWith(false);
  },
};

export const FirstStep: Story = {
  args: { step: 1 },
  play: async () => {
    await screen.findByRole('dialog', { name: 'Step 1 of 4 Help' });
    await expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  },
};

export const LastStep: Story = {
  args: { step: 4 },
  play: async () => {
    await screen.findByRole('dialog', { name: 'Step 4 of 4 Help' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeVisible());
    await expect(screen.queryByRole('button', { name: 'Skip tour' })).not.toBeInTheDocument();
  },
};

export const WithoutTarget: Story = { args: { hasTarget: false, step: 1 } };

export const Closable: Story = {
  play: async ({ userEvent }) => {
    const tip = await screen.findByRole('dialog', { name: 'Step 2 of 4 Help' });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(tip).not.toBeInTheDocument());
  },
};

// A sheet at the top edge on phones, for a target at the bottom edge (the bottom navigation).
export const PhoneAtTheTop: Story = {
  args: { sheetSide: 'top' },
  globals: viewport('phone'),
  play: async () => {
    const tip = await screen.findByRole('dialog', { name: 'Step 2 of 4 Help' });
    await waitFor(async () => {
      await expect(Math.round(tip.getBoundingClientRect().top)).toBe(0);
    });
  },
};

// A bottom sheet on phones (§2.9) with 44 px actions.
export const Phone: Story = {
  globals: viewport('phone'),
  play: async () => {
    const tip = await screen.findByRole('dialog', { name: 'Step 2 of 4 Help' });
    await waitFor(async () => {
      const { bottom, width } = tip.getBoundingClientRect();
      await expect(Math.round(bottom)).toBe(window.innerHeight);
      await expect(width).toBe(window.innerWidth);
    });
    for (const name of ['Next', 'Back', 'Skip tour', 'Close']) {
      const { height } = screen.getByRole('button', { name }).getBoundingClientRect();
      await expect(height).toBeGreaterThanOrEqual(44);
    }
  },
};

export const Tablet: Story = {
  globals: viewport('tablet'),
  play: async () => {
    const tip = await screen.findByRole('dialog', { name: 'Step 2 of 4 Help' });
    const target = screen.getByRole('button', { name: 'Help' });
    // Next to its target, below it.
    await waitFor(async () => {
      await expect(tip.getBoundingClientRect().top).toBeGreaterThan(
        target.getBoundingClientRect().bottom,
      );
    });
  },
};

export const Desktop: Story = { globals: viewport('desktop') };
