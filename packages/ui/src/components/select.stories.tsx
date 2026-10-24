import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select.js';

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const meta = {
  title: 'Components/Select',
  component: Select,
  args: { items: PRIORITIES },
  render: (args: ComponentProps<typeof Select>) => (
    <Select {...args}>
      <SelectTrigger aria-label="Priority" className="w-48">
        <SelectValue placeholder="Choose a priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Priority</SelectLabel>
          {PRIORITIES.slice(0, 3).map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectItem value="urgent">Urgent</SelectItem>
      </SelectContent>
    </Select>
  ),
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'Priority' }));
    await userEvent.click(await screen.findByRole('option', { name: 'High' }));
    await expect(canvas.getByRole('combobox', { name: 'Priority' })).toHaveTextContent('High');
  },
};

export const WithValue: Story = { args: { defaultValue: 'normal' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: 'normal' } };

export const Open: Story = { args: { defaultOpen: true, defaultValue: 'normal' } };

// Options are 44 px high on phones and tablets (§2.9).
export const Phone: Story = {
  args: Open.args,
  globals: viewport('phone'),
  play: async () => {
    const options = await screen.findAllByRole('option');
    // After the opening animation of the popup.
    await waitFor(async () => {
      for (const option of options) {
        await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    });
  },
};

export const Tablet: Story = { args: Open.args, globals: viewport('tablet'), play: Phone.play };

export const Desktop: Story = { args: Open.args, globals: viewport('desktop') };
