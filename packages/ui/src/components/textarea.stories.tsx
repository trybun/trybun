import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Field, FieldDescription, FieldLabel } from './field.js';
import { Textarea } from './textarea.js';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  args: { id: 'description', placeholder: 'What happened, and what did you expect?' },
  decorators: [
    (story) => (
      <div className="flex max-w-md flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        {story()}
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = ComponentProps<typeof Textarea>;

const LONG_TEXT = Array.from(
  { length: 40 },
  (_, index) => `Line ${index + 1} of the steps to reproduce.`,
).join('\n');

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Description' });
    await userEvent.type(textarea, 'The export fails.{Enter}Since the update.');
    await expect(textarea).toHaveValue('The export fails.\nSince the update.');
  },
};

export const WithValue: Story = {
  args: { defaultValue: 'The invoice export fails since the update.' },
};

/** The field grows with its content up to a maximum height, then scrolls. */
export const LongText: Story = {
  args: { defaultValue: LONG_TEXT },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Description' });
    await expect(textarea.clientHeight).toBeLessThanOrEqual(384);
    await expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight);
  },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: 'Read only' } };

export const Invalid: Story = {
  args: { 'aria-invalid': true, 'aria-describedby': 'description-error', defaultValue: 'x' },
  render: (args: Args) => (
    <>
      <Textarea {...args} />
      <p id="description-error" className="text-sm text-destructive">
        Describe the problem in at least 10 characters.
      </p>
    </>
  ),
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Description' });
    await expect(textarea).toBeInvalid();
    await expect(textarea).toHaveAccessibleDescription(
      'Describe the problem in at least 10 characters.',
    );
  },
};

/** Inside a `Field`, the label and the description link to the textarea without IDs. */
export const InField: Story = {
  decorators: [(story) => <div className="max-w-md">{story()}</div>],
  render: () => (
    <Field>
      <FieldLabel>Steps to reproduce</FieldLabel>
      <Textarea />
      <FieldDescription>One step per line.</FieldDescription>
    </Field>
  ),
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Steps to reproduce' });
    await expect(textarea).toHaveAccessibleDescription('One step per line.');
  },
};

// 16 px text on phones and tablets, so iOS does not zoom in (§2.9).
export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Description' });
    await expect(textarea.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(getComputedStyle(textarea).fontSize).toBe('16px');
  },
};

export const Tablet: Story = { globals: viewport('tablet'), play: Phone.play };

export const Desktop: Story = { globals: viewport('desktop') };
