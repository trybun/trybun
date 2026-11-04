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

/**
 * The actions sit at least 4 px – the width of the focus ring – inside the clipping content box
 * of the phone sheet, and the step counter as far from the screen edge as the sides (#190).
 */
async function expectActionsInsideTheSheet(tip: HTMLElement) {
  const content = tip.querySelector('[data-slot="drawer-content"]');
  await expect(content).not.toBeNull();
  const box = content!.getBoundingClientRect();
  for (const name of ['Next', 'Back', 'Skip tour', 'Close']) {
    const action = screen.getByRole('button', { name }).getBoundingClientRect();
    await expect(action.left - box.left).toBeGreaterThanOrEqual(4);
    await expect(box.right - action.right).toBeGreaterThanOrEqual(4);
    await expect(action.top - box.top).toBeGreaterThanOrEqual(4);
    await expect(box.bottom - action.bottom).toBeGreaterThanOrEqual(4);
  }
  const counter = screen.getByText('Step 2 of 4').getBoundingClientRect();
  await expect(counter.left - box.left).toBeGreaterThanOrEqual(16);
}

// A sheet at the top edge on phones, for a target at the bottom edge (the bottom navigation).
export const PhoneAtTheTop: Story = {
  args: { sheetSide: 'top' },
  globals: viewport('phone'),
  play: async () => {
    const tip = await screen.findByRole('dialog', { name: 'Step 2 of 4 Help' });
    await waitFor(async () => {
      await expect(Math.round(tip.getBoundingClientRect().top)).toBe(0);
    });
    await expectActionsInsideTheSheet(tip);
    // The step counter is as far from the top edge of the screen as from its side.
    const counter = screen.getByText('Step 2 of 4').getBoundingClientRect();
    await expect(counter.top).toBeGreaterThanOrEqual(16);
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
    await expectActionsInsideTheSheet(tip);
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

/**
 * Consecutive steps whose targets are found by a function, as the tours find them: the tip stays
 * open and moves to the target of the new step (#188).
 */
function MovingExample() {
  const [step, setStep] = useState(1);
  const target = step === 1 ? 'first' : 'second';
  return (
    <div className="flex min-h-96 items-start justify-between">
      <Button data-target="first" variant="outline">
        Projects
      </Button>
      <Button data-target="second" variant="outline">
        Account
      </Button>
      <TourTip
        open
        onOpenChange={onClose}
        anchor={() => document.querySelector(`[data-target="${target}"]`)}
        step={step}
        stepCount={2}
      >
        <TourTipTitle>{target}</TourTipTitle>
        <TourTipDescription>The tip follows the target of each step.</TourTipDescription>
        <TourTipFooter onBack={() => setStep(1)} onNext={() => setStep(2)} onSkip={onSkip} />
      </TourTip>
    </div>
  );
}

const isBelow = (tip: Element, target: Element) => {
  const tipBox = tip.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();
  return (
    tipBox.top >= targetBox.bottom &&
    tipBox.top - targetBox.bottom <= 16 &&
    tipBox.left < targetBox.right &&
    tipBox.right > targetBox.left
  );
};

export const FollowsTheTarget: StoryObj<typeof MovingExample> = {
  render: () => <MovingExample />,
  globals: viewport('desktop'),
  play: async ({ userEvent }) => {
    const first = screen.getByRole('button', { name: 'Projects' });
    const second = screen.getByRole('button', { name: 'Account' });
    const tip = await screen.findByRole('dialog', { name: 'Step 1 of 2 first' });
    await waitFor(() => expect(isBelow(tip, first)).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'Step 2 of 2 second' });
    await waitFor(() => expect(isBelow(tip, second)).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(isBelow(tip, first)).toBe(true));
  },
};
