import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.js';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  args: { defaultValue: 'overview', onValueChange: fn() },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = ComponentProps<typeof Tabs>;

const tabs = (args: Args) => (
  <Tabs {...args}>
    <TabsList aria-label="Project sections">
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="members">Members</TabsTrigger>
      <TabsTrigger value="workflow">Workflow</TabsTrigger>
      <TabsTrigger value="fields">Custom fields</TabsTrigger>
      <TabsTrigger value="settings">Settings</TabsTrigger>
    </TabsList>
    <TabsContent value="overview">Overview panel</TabsContent>
    <TabsContent value="members">Members panel</TabsContent>
    <TabsContent value="workflow">Workflow panel</TabsContent>
    <TabsContent value="fields">Fields panel</TabsContent>
    <TabsContent value="settings">Settings panel</TabsContent>
  </Tabs>
);

export const Default: Story = {
  render: tabs,
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(canvas.getByRole('tab', { name: 'Members' }));
    await expect(args.onValueChange).toHaveBeenCalledWith('members', expect.anything());
    // The previous panel stays in the document until its exit transition ends.
    await waitFor(() => expect(canvas.getByRole('tabpanel')).toHaveTextContent('Members panel'));
  },
};

export const Keyboard: Story = {
  render: tabs,
  play: async ({ canvas, userEvent }) => {
    canvas.getByRole('tab', { name: 'Overview' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Members' })).toHaveFocus();
  },
};

export const Controlled: Story = {
  args: { defaultValue: undefined, value: 'workflow' },
  render: tabs,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Workflow panel');
  },
};

export const Disabled: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings" disabled>
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="settings">Settings panel</TabsContent>
    </Tabs>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

// Touch targets are 44 px on phones and tablets (§2.9); the list scrolls instead of wrapping, and a
// fade shows the side that hides more tabs (Rule 9).
export const Phone: Story = {
  render: tabs,
  globals: viewport('phone'),
  play: async ({ canvas, canvasElement }) => {
    for (const tab of canvas.getAllByRole('tab')) {
      await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    const list = canvas.getByRole('tablist');
    await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
    await expect(
      new Set(canvas.getAllByRole('tab').map((tab) => tab.getBoundingClientRect().top)).size,
    ).toBe(1);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="overflow-end"]')).not.toBeNull(),
    );
  },
};

// The selected tab is scrolled into view; the list scrolls, the page does not.
export const SelectedTabInView: Story = {
  args: { defaultValue: 'settings' },
  render: tabs,
  globals: viewport('phone'),
  play: async ({ canvas, canvasElement }) => {
    const list = canvas.getByRole('tablist');
    await waitFor(() => expect(list.scrollLeft).toBeGreaterThan(0));
    await expect(
      canvas.getByRole('tab', { name: 'Settings' }).getBoundingClientRect().right,
    ).toBeLessThanOrEqual(list.getBoundingClientRect().right + 1);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="overflow-start"]')).not.toBeNull(),
    );
    await expect(window.scrollX).toBe(0);
  },
};

export const Tablet: Story = {
  render: tabs,
  globals: viewport('tablet'),
  play: async ({ canvas }) => {
    for (const tab of canvas.getAllByRole('tab')) {
      await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  },
};

export const Desktop: Story = {
  render: tabs,
  globals: viewport('desktop'),
};
