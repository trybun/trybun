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

// The focus ring has the colour of the primary fill; a gap in the page background separates them.
// Without the transition, so the computed shadow is the final one.
export const Focused: Story = {
  args: { className: 'transition-none' },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Save' });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    const background = getComputedStyle(document.body).backgroundColor;
    await expect(getComputedStyle(button).boxShadow).toContain(`${background} 0px 0px 0px 2px`);
  },
};

// The target of a product tour step (§2.4) has the ring of the tour, whatever its variant; the
// `outline-none` of the button does not remove it (#186). A button outside a tour has no outline;
// a target at an edge of the screen, marked `inset`, has the ring inside its border (#196).
export const TourTarget: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4 p-2">
      {VARIANTS.map((variant) => (
        <Button {...args} key={variant} variant={variant} data-tour-highlighted="">
          {variant}
        </Button>
      ))}
      <Button
        {...args}
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label="New ticket"
        data-tour-highlighted=""
      >
        <PlusIcon />
      </Button>
      <Button {...args} data-tour-highlighted="inset">
        At the screen edge
      </Button>
      <Button {...args}>Not a target</Button>
    </div>
  ),
  play: async ({ canvas }) => {
    const round = canvas.getByRole('button', { name: 'New ticket' });
    const square = canvas.getByRole('button', { name: 'default' });
    for (const target of [
      ...VARIANTS.map((variant) => canvas.getByRole('button', { name: variant })),
      round,
    ]) {
      const style = getComputedStyle(target);
      await expect(style.outlineStyle).toBe('solid');
      await expect(style.outlineWidth).toBe('3px');
    }
    // The target keeps its own shape: the ring follows a round button.
    await expect(getComputedStyle(round).borderRadius).not.toBe(
      getComputedStyle(square).borderRadius,
    );
    await expect(getComputedStyle(square).outlineOffset).toBe('2px');
    const edge = getComputedStyle(canvas.getByRole('button', { name: 'At the screen edge' }));
    await expect(edge.outlineStyle).toBe('solid');
    await expect(edge.outlineOffset).toBe('-3px');
    const other = canvas.getByRole('button', { name: 'Not a target' });
    await expect(getComputedStyle(other).outlineStyle).toBe('none');
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
