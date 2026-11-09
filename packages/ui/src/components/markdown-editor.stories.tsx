import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, waitFor, within } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Field, FieldDescription, FieldError, FieldLabel } from './field.js';
import { Input } from './input.js';
import { type AddedFile, MarkdownEditor, type MentionCandidate } from './markdown-editor.js';

const IMAGE_ID = '0b9c3f6e-2d1a-4e8b-9c7d-5a6f1e2d3c4b';

const meta = {
  title: 'Components/MarkdownEditor',
  component: MarkdownEditor,
  args: { placeholder: 'Describe the problem', onValueChange: fn() },
  render: (args) => (
    <Field className="max-w-2xl" invalid={args.invalid}>
      <FieldLabel>Description</FieldLabel>
      <MarkdownEditor {...args} />
      <FieldDescription>Markdown is supported.</FieldDescription>
      {args.invalid === true && <FieldError>Describe the problem.</FieldError>}
    </Field>
  ),
} satisfies Meta<typeof MarkdownEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Description' });
    await expect(textarea).toHaveAccessibleDescription('Markdown is supported.');
    await expect(canvas.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
    await expect(canvas.getByRole('tab', { name: 'Write' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};

export const Filled: Story = {
  args: {
    defaultValue:
      '## Steps\n\n1. Open **Invoices**\n2. Click _Export_\n\n- [ ] Check the log\n\n```ts\nexport const answer = 42;\n```',
  },
};

/** The preview renders the text with the rules of every view (§6.2). */
export const Preview: Story = {
  args: { defaultValue: Filled.args?.defaultValue },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
    await expect(await canvas.findByRole('heading', { name: 'Steps' })).toBeInTheDocument();
    await expect(canvas.queryByRole('toolbar')).toBeNull();
    await expect(canvas.getByRole('checkbox', { name: 'Check the log' })).toBeDisabled();
  },
};

export const EmptyPreview: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
    await expect(await canvas.findByText('Nothing to preview')).toBeInTheDocument();
  },
};

/** A script and a `javascript:` link appear in neither the text's preview nor the page (§13.5). */
export const PreviewSanitized: Story = {
  args: { defaultValue: 'Hi <script>alert(1)</script> [click](javascript:alert(1))' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
    const panel = await canvas.findByRole('tabpanel');
    await expect(panel.querySelector('script')).toBeNull();
    await expect(canvas.queryByRole('link', { name: 'click' })).toBeNull();
    await expect(panel.innerHTML).not.toContain('javascript:');
  },
};

/** Only the allowed attachment is an image; the external image is a link (§6.2). */
export const PreviewWithImage: Story = {
  args: {
    attachmentImageIds: [IMAGE_ID],
    defaultValue: `![Screenshot](/api/v1/attachments/${IMAGE_ID}/content)\n\n![Logo](https://example.com/logo.png)`,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
    await expect(await canvas.findByRole('img', { name: 'Screenshot' })).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Logo' })).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Read only' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'Description' })).toBeDisabled();
    const toolbar = canvas.getByRole('toolbar', { name: 'Formatting' });
    // Disabled toolbar buttons stay focusable (`aria-disabled`), as the toolbar pattern asks.
    for (const button of within(toolbar).getAllByRole('button')) {
      await expect(button).toHaveAttribute('aria-disabled', 'true');
    }
  },
};

export const Invalid: Story = {
  args: { invalid: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'Description' })).toBeInvalid();
  },
};

/** Ctrl+K inserts a link and never reaches the command palette; Ctrl+Z undoes it (§6.2, §8.4). */
export const Shortcuts: Story = {
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    const onDocumentKeyDown = fn();
    document.addEventListener('keydown', onDocumentKeyDown);
    try {
      await userEvent.click(textarea);
      await userEvent.keyboard('docs');
      textarea.setSelectionRange(0, 4);
      await userEvent.keyboard('{Control>}k{/Control}');
      await expect(textarea).toHaveValue('[docs](url)');
      await expect(onDocumentKeyDown).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'k' }),
      );
      // The URL placeholder is selected, so typing replaces it. user-event types into its own copy
      // of the value, so the typing is the browser's `insertText`.
      await expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe(
        'url',
      );
      document.execCommand('insertText', false, 'https://example.com');
      await expect(textarea).toHaveValue('[docs](https://example.com)');
      textarea.select();
      await userEvent.keyboard('{Control>}b{/Control}');
      await expect(textarea).toHaveValue('**[docs](https://example.com)**');
      // Ctrl+Z of the browser: the edit is in the native undo history.
      document.execCommand('undo');
      await expect(textarea).toHaveValue('[docs](https://example.com)');
    } finally {
      document.removeEventListener('keydown', onDocumentKeyDown);
    }
  },
};

/** The toolbar is one Tab stop with arrow-key navigation, and every button works by keyboard. */
export const ToolbarKeyboard: Story = {
  args: { defaultValue: 'word' },
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    textarea.setSelectionRange(0, 4);
    await userEvent.click(canvas.getByRole('tab', { name: 'Write' }));
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Heading' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Bold' })).toHaveFocus();
    await expect(canvas.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Control+B',
    );
    await userEvent.keyboard('{Enter}');
    await expect(textarea).toHaveValue('**word**');
    // A second press removes the formatting.
    await userEvent.click(canvas.getByRole('button', { name: 'Bold' }));
    await expect(textarea).toHaveValue('word');
    // The action returns the focus to the text.
    await expect(textarea).toHaveFocus();
  },
};

function upload(files: File[]): Promise<AddedFile>[] {
  return files.map((file, index) =>
    file.name.startsWith('broken')
      ? Promise.reject(new Error('Upload failed'))
      : Promise.resolve({
          id: index === 0 ? IMAGE_ID : '7e1d2c3b-4a5f-4e6d-8c9b-0a1f2e3d4c5b',
          name: file.name,
          isImage: file.type.startsWith('image/'),
        }),
  );
}

/** Files chosen with "Attach files" are linked in the text once uploaded; a failed one is removed. */
export const WithFiles: Story = {
  args: { onFilesAdd: upload },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await expect(canvas.getByRole('button', { name: 'Attach files' })).toBeInTheDocument();
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, [
      new File(['png'], 'screenshot.png', { type: 'image/png' }),
      new File(['log'], 'export.log', { type: 'text/plain' }),
      new File(['x'], 'broken.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() =>
      expect(textarea).toHaveValue(
        `![screenshot\\.png](/api/v1/attachments/${IMAGE_ID}/content)\n[export\\.log](/api/v1/attachments/7e1d2c3b-4a5f-4e6d-8c9b-0a1f2e3d4c5b/content)\n`,
      ),
    );
  },
};

/**
 * An upload that finishes while the writer is in another field links the file in the text without
 * moving the focus or typing into that field.
 */
export const UploadWhileElsewhere: Story = {
  args: {
    onFilesAdd: (files) =>
      files.map(
        (file) =>
          new Promise<AddedFile>((resolve) => {
            setTimeout(() => resolve({ id: IMAGE_ID, name: file.name, isImage: false }), 300);
          }),
      ),
  },
  render: (args) => (
    <div className="flex max-w-2xl flex-col gap-4">
      <Field>
        <FieldLabel>Title</FieldLabel>
        <Input />
      </Field>
      <Field>
        <FieldLabel>Description</FieldLabel>
        <MarkdownEditor {...args} />
      </Field>
    </div>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    const title = canvas.getByRole('textbox', { name: 'Title' });
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, new File(['log'], 'export.log', { type: 'text/plain' }));
    await expect(textarea).toHaveValue('[Uploading export\\.log…]()');
    await userEvent.click(title);
    await waitFor(() =>
      expect(textarea).toHaveValue(`[export\\.log](/api/v1/attachments/${IMAGE_ID}/content)`),
    );
    await expect(title).toHaveFocus();
    await expect(title).toHaveValue('');
  },
};

function pasteEvent(data: DataTransfer) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  return event;
}

/** A copied Office range carries its text and an image of it: the text is pasted, not uploaded. */
export const PasteTextWithImage: Story = {
  args: { onFilesAdd: fn(upload) },
  play: async ({ args, canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Description' });
    const data = new DataTransfer();
    data.setData('text/plain', 'a\tb');
    data.items.add(new File(['png'], 'image.png', { type: 'image/png' }));
    const event = pasteEvent(data);
    textarea.dispatchEvent(event);
    await expect(event.defaultPrevented).toBe(false);
    await expect(args.onFilesAdd).not.toHaveBeenCalled();
  },
};

/** Without `onFilesAdd`, a pasted file is ignored and the paste goes on as usual. */
export const PasteWithoutUploads: Story = {
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Description' });
    const data = new DataTransfer();
    data.items.add(new File(['png'], 'image.png', { type: 'image/png' }));
    const event = pasteEvent(data);
    textarea.dispatchEvent(event);
    await expect(event.defaultPrevented).toBe(false);
  },
};

/** A read-only editor cannot be changed by the toolbar or its shortcuts. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: 'word' },
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    textarea.focus();
    textarea.setSelectionRange(0, 4);
    await userEvent.keyboard('{Control>}b{/Control}');
    await expect(textarea).toHaveValue('word');
    await expect(canvas.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

function findTooltip(name: string) {
  return screen.findByText(name, { selector: '[data-slot=tooltip-content]' }, { timeout: 2000 });
}

/** "Attach files" shows its name on hover, like the formatting buttons, and keeps it (§18.6). */
export const AttachFilesTooltip: Story = {
  args: { onFilesAdd: upload },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Attach files' });
    await userEvent.hover(button);
    await waitFor(async () => expect(await findTooltip('Attach files')).toBeVisible());
    await expect(button).not.toHaveAttribute('aria-describedby');
    await userEvent.unhover(button);
    await waitFor(() =>
      expect(
        screen.queryByText('Attach files', { selector: '[data-slot=tooltip-content]' }),
      ).not.toBeInTheDocument(),
    );
  },
};

/** In Polish, the tooltip of "Attach files" is translated; keyboard focus shows it too. */
export const AttachFilesTooltipPolish: Story = {
  args: { onFilesAdd: upload },
  globals: { locale: 'pl' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Dołącz pliki' });
    button.focus();
    await expect(await findTooltip('Dołącz pliki')).toBeInTheDocument();
  },
};

/** "More formatting" shows its name on hover; a click opens its menu and hides the tooltip. */
export const MoreFormattingTooltip: Story = {
  globals: viewport('phone'),
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'More formatting' });
    await userEvent.hover(button);
    const tooltip = await findTooltip('More formatting');
    await waitFor(() => expect(tooltip).toBeVisible());
    await userEvent.click(button);
    await expect(await screen.findByRole('menuitem', { name: /Heading/ })).toBeInTheDocument();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(tooltip).not.toBeInTheDocument());
  },
};

export const WithoutFiles: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Attach files' })).toBeNull();
  },
};

// Phones: the less used buttons are in the "More formatting" menu; every target is 44 px (Rule 9).
export const Phone: Story = {
  globals: viewport('phone'),
  args: { onFilesAdd: upload, defaultValue: 'Title' },
  play: async ({ canvas, userEvent }) => {
    const toolbar = canvas.getByRole('toolbar', { name: 'Formatting' });
    for (const button of [...toolbar.querySelectorAll('button')]) {
      const { width, height } = button.getBoundingClientRect();
      await expect(Math.min(width, height)).toBeGreaterThanOrEqual(44);
    }
    await expect(canvas.queryByRole('button', { name: 'Heading' })).toBeNull();
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await expect(getComputedStyle(textarea).fontSize).toBe('16px');
    textarea.setSelectionRange(0, 0);
    await userEvent.click(canvas.getByRole('button', { name: 'More formatting' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Heading/ }));
    await expect(textarea).toHaveValue('### Title');
  },
};

export const Tablet: Story = {
  globals: viewport('tablet'),
  args: { onFilesAdd: upload },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Heading' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'More formatting' })).toBeNull();
  },
};

export const Desktop: Story = { globals: viewport('desktop'), args: { onFilesAdd: upload } };

const ANNA_ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const ADAM_ID = '5c4b3a29-1807-4f6e-9d5c-4b3a29180716';
const EWA_ID = '8e7d6c5b-4a39-4281-9706-f5e4d3c2b1a0';

const PEOPLE: MentionCandidate[] = [
  { id: ANNA_ID, displayName: 'Anna Nowak', userKind: 'team' },
  { id: ADAM_ID, displayName: 'Adam Kowalski', userKind: 'team' },
  { id: EWA_ID, displayName: 'Ewa Wiśniewska', userKind: 'end_user' },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The people whose name contains the query, after a short delay like the API's. */
async function searchPeople(query: string): Promise<MentionCandidate[]> {
  await delay(50);
  return PEOPLE.filter(({ displayName }) =>
    displayName.toLowerCase().includes(query.toLowerCase()),
  );
}

/** Types like the browser: `insertText` at the caret, with an `input` event (see the memory). */
async function typeInto(textarea: HTMLTextAreaElement, text: string) {
  textarea.focus();
  document.execCommand('insertText', false, text);
  await delay(0);
}

function findSuggestions() {
  return screen.findByRole('listbox', { name: 'People to mention' });
}

function optionNames() {
  return screen
    .getAllByRole('option')
    .map((option) => option.querySelector('span')?.textContent ?? '');
}

/** Typing `@` opens the suggestions; the textarea keeps the focus and points to the active one. */
export const MentionSuggestions: Story = {
  args: { onMentionSearch: searchPeople },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await expect(textarea).toHaveAttribute('aria-autocomplete', 'list');
    await typeInto(textarea, 'Hi @');
    const list = await findSuggestions();
    await waitFor(() => expect(optionNames()).toEqual(PEOPLE.map((p) => p.displayName)));
    await expect(textarea).toHaveFocus();
    await expect(textarea).toHaveAttribute('aria-controls', list.id);
    const [first] = screen.getAllByRole('option');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(textarea).toHaveAttribute('aria-activedescendant', first!.id);
    await expect(within(first!).getByText('Team')).toBeInTheDocument();
    await expect(canvas.getByRole('status')).toHaveTextContent('3 people found');
  },
};

/** The text after `@` filters the people; a space after it closes the list. */
export const MentionFilter: Story = {
  args: { onMentionSearch: searchPeople },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await typeInto(textarea, '@an');
    await findSuggestions();
    await waitFor(() => expect(optionNames()).toEqual(['Anna Nowak']));
    await typeInto(textarea, ' ');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await expect(textarea).not.toHaveAttribute('aria-controls');
    // An e-mail address is no mention.
    await typeInto(textarea, 'mail@example');
    await delay(300);
    await expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  },
};

/** Arrow keys move through the list, Enter writes the token and Ctrl+Z undoes it (§6.2). */
export const MentionKeyboard: Story = {
  args: { onMentionSearch: searchPeople },
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await typeInto(textarea, 'Hi @a');
    await findSuggestions();
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    await userEvent.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    await expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await expect(textarea).toHaveAttribute('aria-activedescendant', options[1]!.id);
    // The list wraps around.
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await expect(options[2]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect(textarea).toHaveValue(`Hi @{${ADAM_ID}} `);
    await expect(textarea.selectionStart).toBe(textarea.value.length);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    document.execCommand('undo');
    await expect(textarea).toHaveValue('Hi @a');
  },
};

/** A tap or click on a person writes the token; the textarea keeps the focus (Rule 9). */
export const MentionPointer: Story = {
  args: { onMentionSearch: searchPeople, defaultValue: 'Thanks' },
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    textarea.focus();
    textarea.setSelectionRange(6, 6);
    await typeInto(textarea, ' @');
    await findSuggestions();
    await userEvent.click(await screen.findByRole('option', { name: /Ewa Wiśniewska/ }));
    await expect(textarea).toHaveValue(`Thanks @{${EWA_ID}} `);
    await expect(textarea).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  },
};

/** Escape closes the list and keeps it closed for this `@`; a dialog around it stays open. */
export const MentionEscape: Story = {
  args: { onMentionSearch: searchPeople },
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    const onDocumentKeyDown = fn();
    document.addEventListener('keydown', onDocumentKeyDown);
    try {
      await typeInto(textarea, '@');
      await findSuggestions();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
      await expect(onDocumentKeyDown).not.toHaveBeenCalled();
      await typeInto(textarea, 'an');
      await delay(300);
      await expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      // A new `@` opens it again.
      await typeInto(textarea, ' @');
      await findSuggestions();
    } finally {
      document.removeEventListener('keydown', onDocumentKeyDown);
    }
  },
};

/** Nobody matches: the list says so, and Enter writes a line break as usual. */
export const MentionEmpty: Story = {
  args: { onMentionSearch: searchPeople },
  play: async ({ canvas, userEvent }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await typeInto(textarea, '@zz');
    await expect(
      await screen.findByText('No people found', { selector: '[data-slot=mention-suggestions] p' }),
    ).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('No people found');
    await expect(textarea).not.toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{Enter}');
    await expect(textarea).toHaveValue('@zz\n');
  },
};

/** While the search runs, the list shows that it is searching. */
export const MentionLoading: Story = {
  args: { onMentionSearch: () => new Promise<MentionCandidate[]>(() => undefined) },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await typeInto(textarea, '@');
    await expect(await screen.findByText('Searching people…', { selector: 'p' })).toBeVisible();
  },
};

/** A response that arrives after a newer one is ignored. */
export const MentionStaleResponse: Story = {
  args: {
    onMentionSearch: fn(async (query: string) => {
      // The search for everyone answers last.
      await delay(query === '' ? 600 : 50);
      return searchPeople(query);
    }),
  },
  play: async ({ args, canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await typeInto(textarea, '@');
    await waitFor(() => expect(args.onMentionSearch).toHaveBeenCalledWith(''));
    await typeInto(textarea, 'ad');
    await findSuggestions();
    await waitFor(() => expect(optionNames()).toEqual(['Adam Kowalski']));
    await delay(700);
    await expect(optionNames()).toEqual(['Adam Kowalski']);
  },
};

/** Without `onMentionSearch`, `@` is a character like any other. */
export const WithoutMentionSearch: Story = {
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await expect(textarea).not.toHaveAttribute('aria-autocomplete');
    await typeInto(textarea, '@');
    await delay(300);
    await expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  },
};

/** The preview shows the tokens of known people as their names; others stay as written. */
export const PreviewWithMentions: Story = {
  args: {
    mentions: [
      { id: ANNA_ID, displayName: 'Anna Nowak' },
      { id: 'customer', displayName: 'Customer' },
    ],
    defaultValue: `Thanks @{${ANNA_ID}}, please ask @{customer}. \`@{${ANNA_ID}}\` @{${EWA_ID}}`,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Preview' }));
    const panel = await canvas.findByRole('tabpanel');
    const mentions = [...panel.querySelectorAll('.mention')].map((node) => node.textContent);
    await expect(mentions).toEqual(['@Anna Nowak', '@Customer']);
    await expect(panel).toHaveTextContent(`@{${ANNA_ID}}`);
    await expect(panel).toHaveTextContent(`@{${EWA_ID}}`);
  },
};

export const MentionPolish: Story = {
  args: { onMentionSearch: searchPeople },
  globals: { locale: 'pl' },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await typeInto(textarea, '@a');
    await screen.findByRole('listbox', { name: 'Osoby do oznaczenia' });
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Znaleziono 3 osoby'));
    await expect(screen.getAllByText('Zespół')).toHaveLength(2);
    await expect(screen.getByText('Użytkownik')).toBeInTheDocument();
  },
};

/** Every row is a 44 px target (Rule 9); on phones the list opens above the line of the `@`. */
async function checkMentionTargets(textarea: HTMLTextAreaElement, side: 'top' | 'bottom') {
  await typeInto(textarea, 'Hi @');
  await findSuggestions();
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
  for (const option of screen.getAllByRole('option')) {
    await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  }
  const popup = document.querySelector<HTMLElement>('[data-slot=mention-suggestions]')!;
  await waitFor(() => expect(popup).toHaveAttribute('data-side', side));
  const popupBox = popup.getBoundingClientRect();
  const textareaBox = textarea.getBoundingClientRect();
  await expect(popupBox.right).toBeLessThanOrEqual(window.innerWidth);
  if (side === 'bottom') {
    await expect(popupBox.top).toBeGreaterThan(textareaBox.top);
  }
}

export const MentionPhone: Story = {
  globals: viewport('phone'),
  args: { onMentionSearch: searchPeople, defaultValue: 'First line\nSecond line\n' },
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await checkMentionTargets(textarea, 'top');
  },
};

export const MentionTablet: Story = {
  globals: viewport('tablet'),
  args: { onMentionSearch: searchPeople },
  play: async ({ canvas }) => {
    await checkMentionTargets(canvas.getByRole('textbox', { name: 'Description' }), 'bottom');
  },
};

export const MentionDesktop: Story = {
  globals: viewport('desktop'),
  args: { onMentionSearch: searchPeople },
  play: async ({ canvas }) => {
    await checkMentionTargets(canvas.getByRole('textbox', { name: 'Description' }), 'bottom');
  },
};
