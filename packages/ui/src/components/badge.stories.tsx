import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleCheckIcon, ClockIcon, TriangleAlertIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { viewport } from '../../.storybook/viewports.js';
import { Badge } from './badge.js';

const VARIANTS = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'success',
  'warning',
  'info',
  'link',
] as const;

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'New' },
  argTypes: { variant: { control: 'select', options: VARIANTS } },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = ComponentProps<typeof Badge>;

const variants = (args: Args) => (
  <div className="flex flex-wrap gap-2">
    {VARIANTS.map((variant) => (
      <Badge {...args} key={variant} variant={variant}>
        {variant}
      </Badge>
    ))}
  </div>
);

// A state is never shown by colour alone (§13.4): icon and text name it.
const withIcons = (args: Args) => (
  <div className="flex flex-wrap gap-2">
    <Badge {...args} variant="success">
      <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
      Within SLA
    </Badge>
    <Badge {...args} variant="warning">
      <ClockIcon data-icon="inline-start" aria-hidden="true" />
      SLA at risk
    </Badge>
    <Badge {...args} variant="destructive">
      <TriangleAlertIcon data-icon="inline-start" aria-hidden="true" />
      SLA breached
    </Badge>
  </div>
);

const overview = (args: Args) => (
  <div className="flex flex-col gap-4">
    {variants(args)}
    {withIcons(args)}
  </div>
);

export const Default: Story = {};

export const Variants: Story = { render: variants };

export const WithIcon: Story = { render: withIcons };

export const AsLink: Story = {
  args: { render: <a href="#tickets" />, children: '12 open tickets', variant: 'outline' },
};

export const Phone: Story = { render: overview, globals: viewport('phone') };

export const Tablet: Story = { render: overview, globals: viewport('tablet') };

export const Desktop: Story = { render: overview, globals: viewport('desktop') };
