import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from './field.js';
import { RadioGroup, RadioGroupItem } from './radio-group.js';

const PEOPLE = [
  { value: 'anna', name: 'Anna Nowak', login: '@anowak' },
  { value: 'jan', name: 'Jan Kowalski', login: '@jkowalski' },
];

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  args: { onValueChange: fn() },
  render: (args) => (
    <FieldSet>
      <FieldLegend variant="label">Notify</FieldLegend>
      <RadioGroup {...args}>
        {['Everyone', 'Only me'].map((label) => (
          <Field key={label} orientation="horizontal">
            <RadioGroupItem value={label} />
            <FieldLabel>{label}</FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  ),
} satisfies Meta<typeof RadioGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const option = canvas.getByRole('radio', { name: 'Only me' });
    await expect(option).not.toBeChecked();
    await userEvent.click(canvas.getByText('Only me'));
    await expect(args.onValueChange).toHaveBeenCalledWith('Only me', expect.anything());
    await expect(option).toBeChecked();
  },
};

export const Checked: Story = {
  args: { defaultValue: 'Everyone' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('radio', { name: 'Everyone' })).toBeChecked();
  },
};

export const Keyboard: Story = {
  args: { defaultValue: 'Everyone' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('radio', { name: 'Only me' })).toBeChecked();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    for (const option of canvas.getAllByRole('radio')) {
      await expect(option).toHaveAttribute('aria-disabled', 'true');
    }
  },
};

export const Invalid: Story = {
  render: (args) => (
    <FieldSet>
      <FieldLegend variant="label">Notify</FieldLegend>
      <RadioGroup {...args}>
        {['Everyone', 'Only me'].map((label) => (
          <Field key={label} orientation="horizontal" invalid>
            <RadioGroupItem value={label} aria-invalid />
            <FieldLabel>{label}</FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  ),
  play: async ({ canvas }) => {
    for (const option of canvas.getAllByRole('radio')) {
      await expect(option).toHaveAttribute('aria-invalid', 'true');
    }
  },
};

/** Choice cards: the whole card is the label and the hit area. */
export const ChoiceCards: Story = {
  render: (args) => (
    <FieldSet>
      <FieldLegend variant="label">Person</FieldLegend>
      <RadioGroup {...args}>
        {PEOPLE.map((person) => (
          <FieldLabel key={person.value}>
            <Field orientation="horizontal">
              <RadioGroupItem value={person.value} />
              <FieldContent>
                <FieldTitle>{person.name}</FieldTitle>
                <FieldDescription>{person.login}</FieldDescription>
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('@jkowalski'));
    await expect(args.onValueChange).toHaveBeenCalledWith('jan', expect.anything());
    await expect(canvas.getByRole('radio', { name: /Jan Kowalski/ })).toBeChecked();
  },
};

// The hit area is at least 44 px on phones and tablets (§2.9).
async function expectHitArea(radio: HTMLElement) {
  const hit = getComputedStyle(radio, '::after');
  await expect(parseFloat(hit.height)).toBeGreaterThanOrEqual(44);
  await expect(parseFloat(hit.width)).toBeGreaterThanOrEqual(44);
}

export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas }) => {
    await expectHitArea(canvas.getByRole('radio', { name: 'Everyone' }));
  },
};

export const Tablet: Story = {
  globals: viewport('tablet'),
  play: Phone.play,
};

export const Desktop: Story = {
  globals: viewport('desktop'),
};
