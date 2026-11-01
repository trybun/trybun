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

// The computed `rgb()` value of a colour token, for comparing with computed styles.
function tokenColor(token: string) {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

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

// A focused valid field never looks invalid: the ring is the interactive blue, neither a red close to
// the danger colour nor the near-black Ink; the border plus a 1 px ring make the 2 px indicator (#177).
// Without the colour transition, so the computed border is the final one.
export const Focused: Story = {
  args: { className: 'transition-none' },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Title' });
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(input).borderColor).toBe(tokenColor('--ring'));
    await expect(getComputedStyle(input).boxShadow).toContain(
      `${tokenColor('--ring')} 0px 0px 0px 1px`,
    );
    await expect(tokenColor('--ring')).toBe(tokenColor('--link'));
    await expect(tokenColor('--ring')).not.toBe(tokenColor('--destructive'));
    await expect(tokenColor('--ring')).not.toBe(tokenColor('--primary'));
  },
};

// An invalid field shows only its thin danger border at rest; on focus the border plus a 1 px ring
// in the danger colour make the 2 px indicator, so the focused one stands out among invalid fields.
export const FocusedInvalid: Story = {
  ...Invalid,
  args: { ...Invalid.args, className: 'transition-none' },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Title' });
    const danger = tokenColor('--destructive');
    await expect(getComputedStyle(input).borderColor).toBe(danger);
    // No ring of any colour or opacity at rest – every shadow layer is zero-width.
    await expect(getComputedStyle(input).boxShadow).not.toMatch(/0px 0px 0px [1-9]/);
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(input).borderColor).toBe(danger);
    await expect(getComputedStyle(input).boxShadow).toContain(`${danger} 0px 0px 0px 1px`);
  },
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
