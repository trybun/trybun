import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Field, FieldError, FieldLabel } from './field.js';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './combobox.js';

const TIME_ZONES = [
  'America/New_York',
  'Asia/Tokyo',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Warsaw',
  'UTC',
];

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
  args: { items: TIME_ZONES },
  render: (args: ComponentProps<typeof Combobox>) => (
    <div className="w-72">
      <Combobox {...args}>
        <ComboboxInput aria-label="Time zone" placeholder="Search time zones" />
        <ComboboxContent>
          <ComboboxEmpty>No time zone found.</ComboboxEmpty>
          <ComboboxList aria-label="Time zones">
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('combobox', { name: 'Time zone' });
    await userEvent.type(input, 'war');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await userEvent.click(screen.getByRole('option', { name: 'Europe/Warsaw' }));
    await expect(input).toHaveValue('Europe/Warsaw');
  },
};

export const WithValue: Story = { args: { defaultValue: 'Europe/Warsaw' } };

export const Disabled: Story = { args: { defaultValue: 'UTC', disabled: true } };

// In a form the field is marked invalid by `Field`, e.g. from `fieldState` of React Hook Form.
export const Invalid: Story = {
  args: { defaultInputValue: 'Atlantis' },
  render: (args: ComponentProps<typeof Combobox>) => (
    <Field invalid className="w-72">
      <FieldLabel>Time zone</FieldLabel>
      <Combobox {...args}>
        <ComboboxInput placeholder="Search time zones" />
        <ComboboxContent>
          <ComboboxEmpty>No time zone found.</ComboboxEmpty>
          <ComboboxList aria-label="Time zones">
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldError errors={[{ message: 'Choose a time zone from the list.' }]} />
    </Field>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole('combobox', { name: 'Time zone' });
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Choose a time zone from the list.');
    await expect(canvas.getByRole('alert')).toHaveTextContent('Choose a time zone from the list.');
  },
};

export const Open: Story = { args: { defaultOpen: true } };

export const Empty: Story = {
  args: { defaultOpen: true, defaultInputValue: 'Atlantis' },
  play: async () => {
    await expect(await screen.findByText('No time zone found.')).toBeVisible();
  },
};

// The input, its button and the options are 44 px high on phones and tablets (§2.9).
export const Phone: Story = {
  args: Open.args,
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByLabelText('Time zone').getBoundingClientRect().height,
    ).toBeGreaterThanOrEqual(44);
    // The open list hides the rest of the page from assistive technology, so by its text.
    const trigger = canvas.getByText('Show options').closest('button');
    await expect(trigger?.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    await expect(trigger?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    const options = await screen.findAllByRole('option');
    await waitFor(async () => {
      for (const option of options) {
        await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    });
  },
};

export const Tablet: Story = { args: Open.args, globals: viewport('tablet'), play: Phone.play };

export const Desktop: Story = { args: Open.args, globals: viewport('desktop') };
