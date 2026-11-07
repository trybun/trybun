import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, waitFor, within } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Field, FieldDescription, FieldError, FieldLabel } from './field.js';
import { Input } from './input.js';
import { type AddedFile, MarkdownEditor } from './markdown-editor.js';

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

/** "More formatting" shows its name on hover, and a click still opens its menu. */
export const MoreFormattingTooltip: Story = {
  globals: viewport('phone'),
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'More formatting' });
    await userEvent.hover(button);
    await waitFor(async () => expect(await findTooltip('More formatting')).toBeVisible());
    await userEvent.click(button);
    await expect(await screen.findByRole('menuitem', { name: /Heading/ })).toBeInTheDocument();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
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
