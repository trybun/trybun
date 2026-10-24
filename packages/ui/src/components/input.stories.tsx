import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Input } from './input.js';

const meta = {
  title: 'Components/Input',
  component: Input,
  args: { id: 'title', placeholder: 'Short summary of the request' },
  decorators: [
    (story) => (
      <div className="flex max-w-sm flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        {story()}
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = ComponentProps<typeof Input>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Title' });
    await userEvent.type(input, 'Login fails');
    await expect(input).toHaveValue('Login fails');
  },
};

export const WithValue: Story = { args: { defaultValue: 'Login fails after the update' } };

export const Email: Story = { args: { type: 'email', placeholder: 'name@example.com' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: 'Read only' } };

export const Invalid: Story = {
  args: { 'aria-invalid': true, 'aria-describedby': 'title-error', defaultValue: 'x' },
  render: (args: Args) => (
    <>
      <Input {...args} />
      <p id="title-error" className="text-sm text-destructive">
        The title needs at least 3 characters.
      </p>
    </>
  ),
};

// 44 px high with 16 px text on phones and tablets, so iOS does not zoom in (§2.9).
export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: 'Title' });
    await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(getComputedStyle(input).fontSize).toBe('16px');
  },
};

export const Tablet: Story = { globals: viewport('tablet'), play: Phone.play };

export const Desktop: Story = { globals: viewport('desktop') };
