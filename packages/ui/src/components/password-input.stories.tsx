import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Field, FieldDescription, FieldError, FieldLabel } from './field.js';
import { PasswordInput } from './password-input.js';

const meta = {
  title: 'Components/PasswordInput',
  component: PasswordInput,
  args: { autoComplete: 'new-password' },
  decorators: [(story) => <div className="max-w-sm">{story()}</div>],
  render: (args) => (
    <Field>
      <FieldLabel>Password</FieldLabel>
      <PasswordInput {...args} />
    </Field>
  ),
} satisfies Meta<typeof PasswordInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Password');
    const toggle = canvas.getByRole('button', { name: 'Show password' });
    await userEvent.type(input, 'correct horse');
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveAttribute('autocomplete', 'new-password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveValue('correct horse');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(toggle);
    await expect(input).toHaveAttribute('type', 'password');
  },
};

export const WithValue: Story = { args: { defaultValue: 'correct horse' } };

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'correct horse' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Password')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Show password' })).toBeDisabled();
  },
};

// The error of the form library is linked to the input and named by text, not only by colour.
export const Invalid: Story = {
  args: { defaultValue: 'short' },
  render: (args) => (
    <Field invalid>
      <FieldLabel>Password</FieldLabel>
      <PasswordInput {...args} />
      <FieldDescription>At least 12 characters.</FieldDescription>
      <FieldError>The password is too short.</FieldError>
    </Field>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Password');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(
      'At least 12 characters. The password is too short.',
    );
  },
};

export const Polish: Story = {
  globals: { locale: 'pl' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Pokaż hasło' })).toBeInTheDocument();
  },
};

// The input and the toggle are 44 px on phones and tablets, with 16 px text (§2.9).
export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Password');
    const toggle = canvas.getByRole('button', { name: 'Show password' });
    await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(getComputedStyle(input).fontSize).toBe('16px');
    await expect(toggle.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    await expect(toggle.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(toggle.getBoundingClientRect().right).toBe(input.getBoundingClientRect().right);
  },
};

export const Tablet: Story = { globals: viewport('tablet'), play: Phone.play };

// The toggle stays inside the compact input on desktop.
export const Desktop: Story = {
  globals: viewport('desktop'),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText('Password').getBoundingClientRect();
    const toggle = canvas.getByRole('button', { name: 'Show password' }).getBoundingClientRect();
    await expect(toggle.right).toBe(input.right);
    await expect(toggle.height).toBeLessThanOrEqual(input.height);
  },
};
