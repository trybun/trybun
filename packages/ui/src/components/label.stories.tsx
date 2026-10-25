import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Input } from './input.js';
import { Label } from './label.js';

// A label outside a `Field`; inside one, `FieldLabel` links itself to the control.
const meta = {
  title: 'Components/Label',
  component: Label,
  args: { htmlFor: 'title', children: 'Title' },
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label {...args} />
      <Input id="title" />
    </div>
  ),
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Title' });
    await userEvent.click(canvas.getByText('Title'));
    await expect(input).toHaveFocus();
  },
};

export const Disabled: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Input id="title" disabled className="peer order-last" />
      <Label {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'Title' })).toBeDisabled();
  },
};

export const Phone: Story = { globals: viewport('phone'), play: Default.play };

export const Tablet: Story = { globals: viewport('tablet'), play: Default.play };

export const Desktop: Story = { globals: viewport('desktop'), play: Default.play };
