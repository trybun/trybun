import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Checkbox } from './checkbox.js';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from './field.js';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: { onCheckedChange: fn() },
  render: (args) => (
    <Field orientation="horizontal">
      <Checkbox {...args} />
      <FieldLabel>Assign to me</FieldLabel>
    </Field>
  ),
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const checkbox = canvas.getByRole('checkbox', { name: 'Assign to me' });
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(canvas.getByText('Assign to me'));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    await expect(checkbox).toBeChecked();
  },
};

export const Checked: Story = {
  args: { defaultChecked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox')).toBeChecked();
  },
};

export const Keyboard: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(canvas.getByRole('checkbox')).toBeChecked();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Invalid: Story = {
  render: (args) => (
    <Field orientation="horizontal" invalid>
      <Checkbox {...args} aria-invalid />
      <FieldLabel>Accept the terms</FieldLabel>
    </Field>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  },
};

/** A choice card: the whole card is the label and the hit area. */
export const ChoiceCard: Story = {
  render: (args) => (
    <FieldLabel>
      <Field orientation="horizontal">
        <Checkbox {...args} />
        <FieldContent>
          <FieldTitle>Assign to me</FieldTitle>
          <FieldDescription>You can change the assignee later.</FieldDescription>
        </FieldContent>
      </Field>
    </FieldLabel>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('You can change the assignee later.'));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    await expect(canvas.getByRole('checkbox', { name: /Assign to me/ })).toBeChecked();
  },
};

// The hit area is at least 44 px on phones and tablets (§2.9).
async function expectHitArea(checkbox: HTMLElement) {
  const hit = getComputedStyle(checkbox, '::after');
  await expect(parseFloat(hit.height)).toBeGreaterThanOrEqual(44);
  await expect(parseFloat(hit.width)).toBeGreaterThanOrEqual(44);
}

export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    await expectHitArea(canvas.getByRole('checkbox', { name: 'Assign to me' }));
  },
};

export const Tablet: Story = {
  globals: viewport('tablet'),
  play: Phone.play,
};

export const Desktop: Story = {
  globals: viewport('desktop'),
};
