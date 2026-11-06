import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertTriangleIcon, InfoIcon, OctagonAlertIcon } from 'lucide-react';
import { expect } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Alert, AlertDescription, AlertTitle } from './alert.js';
import { Button } from './button.js';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  argTypes: {
    variant: { control: 'select', options: ['default', 'info', 'warning', 'destructive'] },
  },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Project archived</AlertTitle>
      <AlertDescription>Tickets of an archived project are read-only.</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('status');
    await expect(alert).toHaveTextContent('Project archived');
    await expect(alert).toHaveTextContent('read-only');
  },
};

export const Info: Story = { args: { variant: 'info' } };

export const Warning: Story = { args: { variant: 'warning' } };

export const Destructive: Story = {
  args: { variant: 'destructive', role: 'alert' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};

export const WithIcon: Story = {
  args: { variant: 'warning' },
  render: (args) => (
    <Alert {...args}>
      <AlertTriangleIcon aria-hidden />
      <AlertTitle>Unsaved changes</AlertTitle>
      <AlertDescription>Leaving the page discards them.</AlertDescription>
    </Alert>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status').querySelector('svg')).not.toBeNull();
  },
};

// An action on a coloured alert, e.g. Unarchive on a warning: an opaque secondary button keeps its
// contrast in both themes (an outline one is translucent in the dark theme).
export const WithAction: Story = {
  args: { variant: 'warning' },
  render: (args) => (
    <Alert {...args}>
      <AlertTriangleIcon aria-hidden />
      <AlertTitle>This organization is archived</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        It is read-only until it is unarchived.
        <Button variant="secondary" className="w-fit">
          Unarchive
        </Button>
      </AlertDescription>
    </Alert>
  ),
  play: async ({ canvas }) => {
    const style = getComputedStyle(canvas.getByRole('button', { name: 'Unarchive' }));
    await expect(style.color).not.toBe(style.backgroundColor);
  },
};

const overview = () => (
  <div className="flex flex-col gap-3">
    <Alert>
      <AlertTitle>Default</AlertTitle>
      <AlertDescription>A neutral note.</AlertDescription>
    </Alert>
    <Alert variant="info">
      <InfoIcon aria-hidden />
      <AlertTitle>Info</AlertTitle>
      <AlertDescription>Something worth knowing.</AlertDescription>
    </Alert>
    <Alert variant="warning">
      <AlertTriangleIcon aria-hidden />
      <AlertTitle>Warning</AlertTitle>
      <AlertDescription>Check before you continue.</AlertDescription>
    </Alert>
    <Alert variant="destructive">
      <OctagonAlertIcon aria-hidden />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>The project could not be saved.</AlertDescription>
    </Alert>
  </div>
);

export const Phone: Story = {
  render: overview,
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    for (const alert of canvas.getAllByRole('status')) {
      await expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
    }
  },
};

export const Tablet: Story = { render: overview, globals: viewport('tablet') };

export const Desktop: Story = { render: overview, globals: viewport('desktop') };
