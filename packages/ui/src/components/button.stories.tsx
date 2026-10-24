import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRightIcon, PlusIcon, TrashIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { expect, fn } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';

const VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const SIZES = ['xs', 'sm', 'default', 'lg'] as const;
const ICON_SIZES = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save', onClick: fn() },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: [...SIZES, ...ICON_SIZES] },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = ComponentProps<typeof Button>;

const variants = (args: Args) => (
  <div className="flex flex-wrap gap-2">
    {VARIANTS.map((variant) => (
      <Button {...args} key={variant} variant={variant}>
        {variant}
      </Button>
    ))}
  </div>
);

const sizes = (args: Args) => (
  <div className="flex flex-wrap items-center gap-2">
    {SIZES.map((size) => (
      <Button {...args} key={size} size={size}>
        {size}
      </Button>
    ))}
  </div>
);

const withIcons = (args: Args) => (
  <div className="flex flex-wrap items-center gap-2">
    <Button {...args}>
      <PlusIcon data-icon="inline-start" />
      New ticket
    </Button>
    <Button {...args} variant="outline">
      Next
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
    {ICON_SIZES.map((size) => (
      <Button {...args} key={size} size={size} variant="outline" aria-label="Delete">
        <TrashIcon />
      </Button>
    ))}
  </div>
);

/** All variants and sizes, shown in the three viewports. */
const overview = (args: Args) => (
  <div className="flex flex-col gap-4">
    {variants(args)}
    {sizes(args)}
    {withIcons(args)}
  </div>
);

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Variants: Story = { render: variants };

export const Sizes: Story = { render: sizes };

export const WithIcon: Story = { render: withIcons };

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();
  },
};

export const Invalid: Story = {
  args: { 'aria-invalid': true, variant: 'outline' },
};

// Touch targets are 44 px on phones and tablets (§2.9), compact on desktop with a mouse.
export const Phone: Story = {
  render: overview,
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) {
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  },
};

export const Tablet: Story = {
  render: overview,
  globals: viewport('tablet'),
  play: Phone.play,
};

export const Desktop: Story = {
  render: overview,
  globals: viewport('desktop'),
};
