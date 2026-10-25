import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Separator } from './separator.js';

const meta = {
  title: 'Components/Separator',
  component: Separator,
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-3 text-sm">
      <p>Ticket details</p>
      <Separator {...args} />
      <div className="flex h-5 items-center gap-3">
        <span>Open</span>
        <Separator orientation="vertical" />
        <span>High priority</span>
      </div>
    </div>
  ),
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const [horizontal, vertical] = canvas.getAllByRole('separator');
    await expect(horizontal).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(vertical).toHaveAttribute('aria-orientation', 'vertical');
  },
};

export const Phone: Story = { globals: viewport('phone') };

export const Tablet: Story = { globals: viewport('tablet') };

export const Desktop: Story = { globals: viewport('desktop') };
