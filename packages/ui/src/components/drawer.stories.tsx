import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer.js';

const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  render: (args: ComponentProps<typeof Drawer>) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Ticket actions</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Ticket actions</DrawerTitle>
          <DrawerDescription>Change the status or the assignee of the ticket.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Assign to me</Button>
          <DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
} satisfies Meta<typeof Drawer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A finger swipe of `distance` px down from the middle of `element`. */
async function swipeDown(element: HTMLElement, distance: number) {
  const { left, top, width, height } = element.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const touch = (dy: number) =>
    new Touch({ identifier: 1, target: element, clientX: x, clientY: y + dy });
  const fire = (type: string, dy: number) => {
    const touches = type === 'touchend' ? [] : [touch(dy)];
    element.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches,
        targetTouches: touches,
        changedTouches: [touch(dy)],
      }),
    );
  };
  fire('touchstart', 0);
  for (let step = 1; step <= 10; step++) {
    await new Promise((resolve) => setTimeout(resolve, 16));
    fire('touchmove', (distance * step) / 10);
  }
  fire('touchend', distance);
}

export const Default: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ticket actions' }));
    const drawer = await screen.findByRole('dialog', { name: 'Ticket actions' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(drawer).not.toBeInTheDocument());
  },
};

export const Open: Story = { args: { defaultOpen: true } };

export const WithoutSwipeHandle: Story = { args: { defaultOpen: true, showSwipeHandle: false } };

export const FromTheRight: Story = { args: { defaultOpen: true, swipeDirection: 'right' } };

// The bottom sheet of phones (§2.9): it covers the bottom edge and closes with a swipe down.
export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ticket actions' }));
    const drawer = await screen.findByRole('dialog', { name: 'Ticket actions' });
    await waitFor(async () => {
      const { bottom, width } = drawer.getBoundingClientRect();
      await expect(Math.round(bottom)).toBe(window.innerHeight);
      await expect(width).toBe(window.innerWidth);
    });
    await swipeDown(drawer, 300);
    await waitFor(() => expect(drawer).not.toBeInTheDocument());
  },
};

export const Tablet: Story = { args: { defaultOpen: true }, globals: viewport('tablet') };

export const Desktop: Story = { args: { defaultOpen: true }, globals: viewport('desktop') };
