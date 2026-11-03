import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { expect, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip.js';

type TooltipStoryArgs = ComponentProps<typeof Tooltip> & {
  side?: ComponentProps<typeof TooltipContent>['side'];
};

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  // Without the delay, so the stories and their tests show the tooltip at once.
  render: ({ side, ...args }: TooltipStoryArgs) => (
    <TooltipProvider delay={0}>
      <Tooltip {...args}>
        <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Settings" />}>
          <SettingsIcon aria-hidden />
        </TooltipTrigger>
        <TooltipContent side={side}>Settings</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
} satisfies Meta<TooltipStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Hover shows the name; leaving hides it. The trigger keeps its own name, without a description. */
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await userEvent.hover(trigger);
    const tooltip = await screen.findByText('Settings', {
      selector: '[data-slot=tooltip-content]',
    });
    await expect(tooltip).toBeVisible();
    await expect(trigger).not.toHaveAttribute('aria-describedby');
    await userEvent.unhover(trigger);
    await waitFor(() => expect(tooltip).not.toBeInTheDocument());
  },
};

/** Keyboard focus shows it too; Escape hides it (WCAG 1.4.13). */
export const Focus: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Settings' })).toHaveFocus();
    const tooltip = await screen.findByText('Settings', {
      selector: '[data-slot=tooltip-content]',
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(tooltip).not.toBeInTheDocument());
  },
};

export const Open: Story = { args: { defaultOpen: true } };

export const Right: Story = { args: { defaultOpen: true, side: 'right' } };

/** A disabled tooltip never opens, on hover or on focus. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await userEvent.hover(trigger);
    await userEvent.tab();
    await expect(
      screen.queryByText('Settings', { selector: '[data-slot=tooltip-content]' }),
    ).not.toBeInTheDocument();
  },
};

// Next to its trigger, inside the screen of the narrowest phone (§2.9); the trigger keeps 44 px.
export const Phone: Story = {
  args: { defaultOpen: true },
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Settings' });
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    const tooltip = await screen.findByText('Settings', {
      selector: '[data-slot=tooltip-content]',
    });
    await waitFor(async () => {
      const { left, right } = tooltip.getBoundingClientRect();
      await expect(left).toBeGreaterThanOrEqual(0);
      await expect(right).toBeLessThanOrEqual(window.innerWidth);
    });
  },
};

export const Tablet: Story = { args: { defaultOpen: true }, globals: viewport('tablet') };

export const Desktop: Story = { args: { defaultOpen: true }, globals: viewport('desktop') };
