import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from './field.js';
import { Input } from './input.js';
import { PasswordInput } from './password-input.js';

const meta = {
  title: 'Components/Field',
  component: Field,
  decorators: [(story) => <div className="max-w-sm">{story()}</div>],
  render: (args) => (
    <Field {...args}>
      <FieldLabel>E-mail address</FieldLabel>
      <Input type="email" autoComplete="email" defaultValue="anna@example.com" />
      <FieldDescription>Used for signing in and notifications.</FieldDescription>
    </Field>
  ),
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = ComponentProps<typeof Field>;

// The label and the description are linked to the input without IDs written by hand.
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'E-mail address' });
    await expect(input).toHaveAccessibleDescription('Used for signing in and notifications.');
    await expect(input).not.toHaveAttribute('aria-invalid');
    await userEvent.click(canvas.getByText('E-mail address'));
    await expect(input).toHaveFocus();
  },
};

// `invalid` and `FieldError` come from the form library (e.g. `fieldState` of React Hook Form).
export const Invalid: Story = {
  args: { invalid: true },
  render: (args) => (
    <Field {...args}>
      <FieldLabel>E-mail address</FieldLabel>
      <Input type="email" defaultValue="anna@" />
      <FieldDescription>Used for signing in and notifications.</FieldDescription>
      <FieldError errors={[{ message: 'Enter a valid e-mail address.' }]} />
    </Field>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: 'E-mail address' });
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(
      'Used for signing in and notifications. Enter a valid e-mail address.',
    );
    await expect(canvas.getByRole('alert')).toHaveTextContent('Enter a valid e-mail address.');
  },
};

// Several distinct errors become a list; duplicates are shown once.
export const SeveralErrors: Story = {
  args: { invalid: true },
  render: (args) => (
    <Field {...args}>
      <FieldLabel>Password</FieldLabel>
      <PasswordInput defaultValue="abc" />
      <FieldError
        errors={[
          { message: 'Use at least 12 characters.' },
          { message: 'Use at least one digit.' },
          { message: 'Use at least one digit.' },
          undefined,
        ]}
      />
    </Field>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

// Without errors the error element is not rendered and the input is not marked invalid.
export const NoErrors: Story = {
  render: (args) => (
    <Field {...args}>
      <FieldLabel>Display name</FieldLabel>
      <Input defaultValue="Anna Nowak" />
      <FieldError errors={[undefined]} />
    </Field>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'E-mail address' })).toBeDisabled();
  },
};

export const Responsive: Story = {
  args: { orientation: 'responsive' },
  render: (args) => (
    <FieldGroup>
      <Field {...args}>
        <FieldContent>
          <FieldLabel>Display name</FieldLabel>
          <FieldDescription>Shown to other people.</FieldDescription>
        </FieldContent>
        <Input defaultValue="Anna Nowak" />
      </Field>
    </FieldGroup>
  ),
};

// Outside a `Field`, the description and the error of a fieldset are plain elements.
export const FieldSetError: Story = {
  render: (args) => (
    <FieldSet>
      <FieldLegend variant="label">Language</FieldLegend>
      <FieldDescription>Used for the texts and e-mails of your account.</FieldDescription>
      <Field {...args}>
        <FieldLabel>Language code</FieldLabel>
        <Input defaultValue="xx" />
      </Field>
      <FieldError>Choose a supported language.</FieldError>
    </FieldSet>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Choose a supported language.');
  },
};

/** A form like the first-run wizard: grouped fields, a fieldset with a legend and a separator. */
const form = (args: Args) => (
  <form onSubmit={(event) => event.preventDefault()}>
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Administrator</FieldLegend>
        <FieldDescription>The first account of this installation.</FieldDescription>
        <FieldGroup>
          <Field {...args}>
            <FieldLabel>Display name</FieldLabel>
            <Input autoComplete="name" />
          </Field>
          <Field {...args}>
            <FieldLabel>E-mail address</FieldLabel>
            <Input type="email" autoComplete="email" />
          </Field>
          <Field {...args} invalid>
            <FieldLabel>Password</FieldLabel>
            <PasswordInput autoComplete="new-password" />
            <FieldError>The password is too short.</FieldError>
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSeparator>Defaults</FieldSeparator>
      <Field {...args}>
        <FieldTitle>Time zone</FieldTitle>
        <FieldDescription>Europe/Warsaw, changed in .env.</FieldDescription>
      </Field>
      <Field {...args} orientation="horizontal">
        <Button type="submit">Create account</Button>
      </Field>
    </FieldGroup>
  </form>
);

export const Form: Story = {
  render: form,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Administrator' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Display name' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Password')).toHaveAccessibleDescription(
      'The password is too short.',
    );
  },
};

// Fields are 44 px high with 16 px text on phones and tablets, so iOS does not zoom in (§2.9).
export const Phone: Story = {
  render: form,
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    for (const input of [
      canvas.getByRole('textbox', { name: 'Display name' }),
      canvas.getByRole('textbox', { name: 'E-mail address' }),
      canvas.getByLabelText('Password'),
    ]) {
      await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      await expect(getComputedStyle(input).fontSize).toBe('16px');
    }
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  },
};

export const Tablet: Story = { render: form, globals: viewport('tablet'), play: Phone.play };

export const Desktop: Story = { render: form, globals: viewport('desktop') };
