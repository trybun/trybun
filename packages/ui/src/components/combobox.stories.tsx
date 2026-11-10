import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps, ReactNode } from 'react';
import { expect, fn, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import { Field, FieldError, FieldLabel } from './field.js';
import {
  Combobox,
  ComboboxCheckboxItem,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopupInput,
  ComboboxTrigger,
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

// A picker of several values: a button opens the popup with the search input on top and a
// checkbox list (`multiple`) – the filter of the ticket list (§8.1).
const PROJECTS = [
  'API · Public API',
  'DOC · Documentation',
  'MOB · Mobile app',
  'QM150 · Quality management',
  'WEB · Web app',
];

function ProjectPicker({
  status,
  ...args
}: ComponentProps<typeof Combobox> & {
  /** Shown above the list instead of the empty message: loading or an error. */
  status?: ReactNode;
}) {
  return (
    <Combobox multiple {...args}>
      <ComboboxTrigger render={<Button variant="outline" />} aria-label="Project">
        Project
      </ComboboxTrigger>
      <ComboboxContent className="w-72">
        <ComboboxPopupInput aria-label="Search projects" placeholder="Search projects…" />
        {status ?? <ComboboxEmpty>No projects match.</ComboboxEmpty>}
        <ComboboxList aria-label="Projects">
          {(item: string) => (
            <ComboboxCheckboxItem key={item} value={item}>
              {item}
            </ComboboxCheckboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const highlighted = (input: HTMLElement) =>
  document.getElementById(input.getAttribute('aria-activedescendant') ?? '');

export const Picker: Story = {
  args: { items: PROJECTS, onValueChange: fn() },
  render: (args: ComponentProps<typeof Combobox>) => <ProjectPicker {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Project' });
    await userEvent.click(trigger);
    const input = await screen.findByRole('combobox', { name: 'Search projects' });
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, 'qm');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await userEvent.click(screen.getByRole('option', { name: 'QM150 · Quality management' }));
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      ['QM150 · Quality management'],
      expect.anything(),
    );
    // A click toggles the value and keeps the popup open for further choices.
    await expect(screen.getByRole('listbox', { name: 'Projects' })).toBeVisible();
  },
};

// ↓/↑ move, Home/End jump, Enter toggles and keeps the popup open, Esc closes and returns the
// focus to the trigger; the list is multi-selectable and every option says whether it is chosen.
export const PickerKeyboard: Story = {
  args: { items: PROJECTS, defaultValue: ['DOC · Documentation'], onValueChange: fn() },
  render: Picker.render,
  play: async ({ args, canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Project' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const input = await screen.findByRole('combobox', { name: 'Search projects' });
    await waitFor(() => expect(input).toHaveFocus());
    const listbox = screen.getByRole('listbox', { name: 'Projects' });
    await expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
    const option = (name: string) => screen.getByRole('option', { name });
    await expect(option('DOC · Documentation')).toHaveAttribute('aria-selected', 'true');
    await expect(option('API · Public API')).toHaveAttribute('aria-selected', 'false');
    // The box of a chosen option is filled, not only ticked (story `PickerOpen` in both themes).
    const box = (name: string) =>
      option(name).querySelector('[data-slot="combobox-checkbox-item-box"]') as HTMLElement;
    await expect(getComputedStyle(box('DOC · Documentation')).backgroundColor).not.toBe(
      getComputedStyle(box('API · Public API')).backgroundColor,
    );

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted(input)).toBe(option('MOB · Mobile app')));
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(highlighted(input)).toBe(option('DOC · Documentation')));
    await userEvent.keyboard('{End}');
    await waitFor(() => expect(highlighted(input)).toBe(option('WEB · Web app')));
    await userEvent.keyboard('{Home}');
    await waitFor(() => expect(highlighted(input)).toBe(option('API · Public API')));

    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(option('API · Public API')).toHaveAttribute('aria-selected', 'true'),
    );
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      ['DOC · Documentation', 'API · Public API'],
      expect.anything(),
    );
    await expect(listbox).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(option('API · Public API')).toHaveAttribute('aria-selected', 'false'),
    );
    await expect(args.onValueChange).toHaveBeenLastCalledWith(
      ['DOC · Documentation'],
      expect.anything(),
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const PickerOpen: Story = {
  args: {
    items: PROJECTS,
    defaultOpen: true,
    defaultValue: ['DOC · Documentation', 'QM150 · Quality management'],
  },
  render: Picker.render,
};

// The first page of a search is on its way; the chosen values could stay above it.
export const PickerLoading: Story = {
  args: { items: [], defaultOpen: true },
  render: (args: ComponentProps<typeof Combobox>) => (
    <ProjectPicker
      {...args}
      status={
        <div role="status" className="px-2 py-3 text-center text-sm text-muted-foreground">
          Loading projects…
        </div>
      }
    />
  ),
  play: async () => {
    await expect(await screen.findByRole('status')).toHaveTextContent('Loading projects…');
    await expect(screen.queryByText('No projects match.')).not.toBeInTheDocument();
  },
};

export const PickerEmpty: Story = {
  args: { items: PROJECTS, defaultOpen: true, defaultInputValue: 'xyz' },
  render: Picker.render,
  play: async () => {
    await expect(await screen.findByText('No projects match.')).toBeVisible();
    await expect(screen.queryAllByRole('option')).toHaveLength(0);
  },
};

export const PickerError: Story = {
  args: { items: [], defaultOpen: true },
  render: (args: ComponentProps<typeof Combobox>) => (
    <ProjectPicker
      {...args}
      status={
        <div role="alert" className="flex flex-col items-center gap-2 px-2 py-3 text-sm">
          <p>The projects could not be loaded.</p>
          <Button variant="outline" size="sm">
            Try again
          </Button>
        </div>
      }
    />
  ),
  play: async () => {
    await expect(await screen.findByRole('alert')).toHaveTextContent(
      'The projects could not be loaded.',
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible());
  },
};

// The trigger, the search input and the options are 44 px high on phones and tablets (§2.9);
// the input keeps 16 px text, so iOS does not zoom in.
export const PickerPhone: Story = {
  args: PickerOpen.args,
  render: Picker.render,
  globals: viewport('phone'),
  play: async () => {
    const input = await screen.findByRole('combobox', { name: 'Search projects' });
    await expect(getComputedStyle(input).fontSize).toBe('16px');
    // The open popup hides the rest of the page from assistive technology, so by its text.
    const trigger = screen.getByText('Project', { selector: 'button' });
    await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // The popup zooms in when it opens, so the sizes are final only after its motion.
    const options = screen.getAllByRole('option');
    await waitFor(async () => {
      await expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      for (const option of options) {
        await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    });
  },
};

export const PickerTablet: Story = {
  args: PickerOpen.args,
  render: Picker.render,
  globals: viewport('tablet'),
  play: PickerPhone.play,
};

export const PickerDesktop: Story = {
  args: PickerOpen.args,
  render: Picker.render,
  globals: viewport('desktop'),
};
