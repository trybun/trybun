import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './popover.js';

const meta = {
  title: 'Components/Popover',
  component: Popover,
  render: (args: ComponentProps<typeof Popover>) => (
    <Popover {...args}>
      <PopoverTrigger render={<Button variant="outline" />}>SLA</PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>First response</PopoverTitle>
          <PopoverDescription>Due in 2 hours, by 11:00 on business days.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'SLA' }));
    const popover = await screen.findByRole('dialog', { name: 'First response' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popover).not.toBeInTheDocument());
  },
};

export const Open: Story = { args: { defaultOpen: true } };

// Next to its trigger on every viewport, inside the screen of the narrowest phone (§2.9).
export const Phone: Story = {
  args: { defaultOpen: true },
  globals: viewport('phone'),
  play: async () => {
    const popover = await screen.findByRole('dialog', { name: 'First response' });
    await waitFor(async () => {
      const { left, right } = popover.getBoundingClientRect();
      await expect(left).toBeGreaterThanOrEqual(0);
      await expect(right).toBeLessThanOrEqual(window.innerWidth);
    });
  },
};

export const Tablet: Story = { args: { defaultOpen: true }, globals: viewport('tablet') };

export const Desktop: Story = { args: { defaultOpen: true }, globals: viewport('desktop') };
