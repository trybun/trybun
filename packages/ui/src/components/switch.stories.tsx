import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Field, FieldDescription, FieldLabel } from './field.js';
import { Switch } from './switch.js';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: { onCheckedChange: fn() },
  render: (args) => (
    <Field orientation="horizontal">
      <Switch {...args} />
      <FieldLabel>Archive completed tickets</FieldLabel>
      <FieldDescription>Hides them from the board.</FieldDescription>
    </Field>
  ),
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const toggle = canvas.getByRole('switch', { name: 'Archive completed tickets' });
    await expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    await expect(toggle).toBeChecked();
  },
};

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toBeChecked();
  },
};

export const Keyboard: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('switch')).toBeChecked();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Invalid: Story = {
  args: { 'aria-invalid': true },
};

// The hit area is at least 44 px on phones and tablets (§2.9).
async function expectHitArea(root: HTMLElement) {
  const hit = getComputedStyle(root, '::after');
  await expect(parseFloat(hit.height)).toBeGreaterThanOrEqual(44);
}

export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    await expectHitArea(canvas.getByRole('switch'));
  },
};

export const Tablet: Story = {
  globals: viewport('tablet'),
  play: Phone.play,
};

export const Desktop: Story = {
  globals: viewport('desktop'),
};
