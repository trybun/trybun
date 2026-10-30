import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { ScrollFade } from './scroll-fade.js';

const SECTIONS = ['Getting started', 'Accounts', 'Organizations', 'Projects', 'About'];

function Bar({ current, labels = SECTIONS }: { current?: string; labels?: readonly string[] }) {
  const [nav, setNav] = useState<HTMLElement | null>(null);
  return (
    <ScrollFade scroller={nav}>
      <nav ref={setNav} aria-label="Sections" className="overflow-x-auto">
        <ul className="flex gap-1 border-b border-border">
          {labels.map((label, index) => (
            // The same items keep their elements when their labels change.
            <li key={SECTIONS[index]}>
              <a
                href={`#${SECTIONS[index]}`}
                aria-current={label === current ? 'page' : undefined}
                className="flex min-h-11 items-center px-3 text-sm font-medium whitespace-nowrap"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </ScrollFade>
  );
}

const meta = {
  title: 'Components/ScrollFade',
  component: ScrollFade,
  args: { scroller: null },
  render: () => <Bar />,
} satisfies Meta<typeof ScrollFade>;

export default meta;

type Story = StoryObj<typeof meta>;

const fade = (canvasElement: HTMLElement, side: 'start' | 'end') =>
  canvasElement.querySelector(`[data-slot="overflow-${side}"]`);

// On a phone the bar scrolls sideways: the fade follows the side that hides more items (Rule 9).
export const Phone: Story = {
  globals: viewport('phone'),
  play: async ({ canvas, canvasElement }) => {
    const nav = canvas.getByRole('navigation');
    await waitFor(() => expect(fade(canvasElement, 'end')).not.toBeNull());
    await expect(fade(canvasElement, 'start')).toBeNull();
    // The fades replace the scroll bar, which would cover the mark of the current item.
    await expect(getComputedStyle(nav).scrollbarWidth).toBe('none');
    await expect(nav.offsetHeight).toBe(nav.clientHeight);

    nav.scrollTo({ left: nav.scrollWidth });
    await waitFor(() => expect(fade(canvasElement, 'start')).not.toBeNull());
    await expect(fade(canvasElement, 'end')).toBeNull();
  },
};

// The current item is scrolled into view; the bar scrolls, the page does not.
export const CurrentItemInView: Story = {
  globals: viewport('phone'),
  render: () => <Bar current="About" />,
  play: async ({ canvas, canvasElement }) => {
    const nav = canvas.getByRole('navigation');
    await waitFor(() => expect(nav.scrollLeft).toBeGreaterThan(0));
    await expect(
      canvas.getByRole('link', { name: 'About' }).getBoundingClientRect().right,
    ).toBeLessThanOrEqual(nav.getBoundingClientRect().right + 1);
    await waitFor(() => expect(fade(canvasElement, 'start')).not.toBeNull());
    await expect(window.scrollX).toBe(0);
  },
};

// A current item with more items after it stays clear of the fade that covers them.
export const CurrentItemBesideTheFade: Story = {
  globals: viewport('phone'),
  render: () => <Bar current="Projects" />,
  play: async ({ canvas, canvasElement }) => {
    const nav = canvas.getByRole('navigation');
    await waitFor(() => expect(fade(canvasElement, 'end')).not.toBeNull());
    await waitFor(() =>
      expect(
        canvas.getByRole('link', { name: 'Projects' }).getBoundingClientRect().right,
      ).toBeLessThanOrEqual(nav.getBoundingClientRect().right - 40 + 1),
    );
  },
};

function GrowingBar() {
  const [isLong, setIsLong] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Bar
        labels={
          isLong
            ? ['Pierwsze kroki w panelu administratora', 'Konta użytkowników', 'O programie']
            : ['Start', 'Accounts', 'About']
        }
      />
      <button type="button" onClick={() => setIsLong(true)}>
        Switch the language
      </button>
    </div>
  );
}

// Labels that grow (a language switch, a font loaded late) recompute the fade.
export const LabelsGrow: Story = {
  globals: viewport('phone'),
  render: () => <GrowingBar />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(fade(canvasElement, 'end')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Switch the language' }));
    await waitFor(() => expect(fade(canvasElement, 'end')).not.toBeNull());
  },
};

// Wide enough for every item: no fade.
export const Tablet: Story = {
  globals: viewport('tablet'),
  play: async ({ canvasElement }) => {
    await expect(fade(canvasElement, 'start')).toBeNull();
    await expect(fade(canvasElement, 'end')).toBeNull();
  },
};

export const Desktop: Story = {
  globals: viewport('desktop'),
  play: async ({ canvasElement }) => {
    await expect(fade(canvasElement, 'start')).toBeNull();
    await expect(fade(canvasElement, 'end')).toBeNull();
  },
};
