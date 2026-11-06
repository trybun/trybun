// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MarkdownEditor } from '@trybun/ui/components/markdown-editor';
import { useForm, useWatch } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachmentResponse } from '../../../test/factories/attachment.factory.js';
import { createFakeApiClient } from '../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));

// The editor adapts its toolbar to the width (jsdom has no `matchMedia`): a phone.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

// jsdom has no `execCommand`: the editor replaces its placeholders without an undo entry.
Object.defineProperty(document, 'execCommand', { value: () => false });

const { useAttachmentDrafts } = await import('./use-attachment-drafts.js');
const { AttachmentDrafts } = await import('./components/attachment-drafts.js');

const fake = createFakeApiClient();
api.current = fake.client;

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
});

interface Values {
  description: string;
  attachmentIds?: string[];
}

/** A form with the editor and its drafts, as a ticket form composes them (Q18). */
function DraftsForm({ maxSizeMb = 25 }: { maxSizeMb?: number }) {
  const form = useForm<Values>({ defaultValues: { description: '' } });
  const { editorProps, drafts, removeDraft } = useAttachmentDrafts({
    form,
    textField: 'description',
    maxSizeMb,
  });
  const description = useWatch({ control: form.control, name: 'description' });
  const attachmentIds = useWatch({ control: form.control, name: 'attachmentIds' });
  return (
    <>
      <MarkdownEditor
        aria-label="Description"
        value={description}
        onValueChange={(value) => form.setValue('description', value)}
        {...editorProps}
      />
      <AttachmentDrafts drafts={drafts} onRemove={removeDraft} />
      <output aria-label="Attachment IDs">{(attachmentIds ?? []).join(',')}</output>
    </>
  );
}

function idOf(number: number): string {
  return `0199a3f0-0000-7000-8000-0000000001${String(number).padStart(2, '0')}`;
}

/** The file of an upload request, as the serializer of the mutation sends it. */
function uploadedFile(init: unknown): File {
  const { bodySerializer } = init as { bodySerializer: () => FormData };
  const file = bodySerializer().get('files');
  if (!(file instanceof File)) {
    throw new Error('The upload sent no file');
  }
  return file;
}

/** Every upload answers a new draft in quarantine; the list answers the drafts it is asked for. */
function answerUploads(status: 'quarantine' | 'available' = 'quarantine') {
  let uploads = 0;
  const names = new Map<string, string>();
  fake.on('POST /api/v1/attachments', (init) => {
    uploads += 1;
    const file = uploadedFile(init);
    names.set(idOf(uploads), file.name);
    return {
      status: 201,
      data: {
        items: [
          attachmentResponse({
            id: idOf(uploads),
            fileName: file.name,
            size: file.size,
            contentType: file.type,
            isImage: file.type.startsWith('image/'),
          }),
        ],
      },
    };
  });
  fake.on('GET /api/v1/attachments', (init) => {
    const { id } = (init as { params: { query: { id: string[] } } }).params.query;
    return {
      data: {
        items: id.map((attachmentId) =>
          attachmentResponse({ id: attachmentId, fileName: names.get(attachmentId), status }),
        ),
        nextCursor: null,
      },
    };
  });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) {
    throw new Error('The editor has no file input');
  }
  return input;
}

function textFile(name: string, size = 16): File {
  return new File(['x'.repeat(size)], name, { type: 'text/plain' });
}

describe('useAttachmentDrafts', () => {
  it('uploads every file in a request of its own and links it in the text (Q6)', async () => {
    const events = userEvent.setup();
    answerUploads();
    renderInApp(<DraftsForm />);

    await events.upload(fileInput(), [textFile('first.log'), textFile('second.log')]);

    await waitFor(() =>
      expect(screen.getByLabelText('Attachment IDs').textContent).toBe(`${idOf(1)},${idOf(2)}`),
    );
    const uploads = fake.callsTo('POST /api/v1/attachments');
    expect(uploads.map(({ init }) => uploadedFile(init).name)).toEqual(['first.log', 'second.log']);
    const text = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' }).value;
    expect(text).toContain(`[first\\.log](/api/v1/attachments/${idOf(1)}/content)`);
    expect(text).toContain(`[second\\.log](/api/v1/attachments/${idOf(2)}/content)`);
    // One request reads the states of all drafts (Q7).
    await waitFor(() =>
      expect(fake.callsTo('GET /api/v1/attachments').at(-1)?.init).toMatchObject({
        params: { query: { id: [idOf(1), idOf(2)] } },
      }),
    );
    expect(await screen.findAllByText('Checking…')).toHaveLength(2);
  });

  it('rejects the files beyond 10 of one drop by their own promises, with a toast (Q6)', async () => {
    const events = userEvent.setup();
    answerUploads();
    renderInApp(<DraftsForm />);
    const files = Array.from({ length: 11 }, (_, index) => textFile(`file-${index + 1}.log`));

    await events.upload(fileInput(), files);

    await waitFor(() =>
      expect(screen.getByLabelText('Attachment IDs').textContent?.split(',')).toHaveLength(10),
    );
    expect(fake.callsTo('POST /api/v1/attachments')).toHaveLength(10);
    expect(toastAdd).toHaveBeenCalledWith({
      title: 'At most 10 files can be added at once',
      description: 'file-11.log',
      type: 'error',
    });
    // The editor removes the placeholder of the rejected file.
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' }).value,
      ).not.toContain('Uploading'),
    );
  });

  it('refuses a file over the size limit before sending it (Q2)', async () => {
    const events = userEvent.setup();
    answerUploads();
    renderInApp(<DraftsForm maxSizeMb={1} />);

    await events.upload(fileInput(), [textFile('large.log', 1024 * 1024 + 1)]);

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'large.log',
        description: 'The file is larger than 1 MB',
        type: 'error',
      }),
    );
    expect(fake.callsTo('POST /api/v1/attachments')).toHaveLength(0);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('names the file and the reason of a rejection by the API in a toast', async () => {
    const events = userEvent.setup();
    fake.on('POST /api/v1/attachments', {
      status: 422,
      error: {
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        code: 'attachment.type_not_allowed',
        errors: [{ pointer: '/files/0', code: 'field.invalid', detail: 'Not allowed' }],
      },
    });
    renderInApp(<DraftsForm />);

    await events.upload(fileInput(), [new File(['<html>'], 'page.png', { type: 'image/png' })]);

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'page.png',
        description: 'Files of this type are not allowed.',
        type: 'error',
      }),
    );
    // A rejected file is no item of the list, and its placeholder leaves the text.
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' }).value).toBe(
      '',
    );
  });

  it('deletes a removed draft at once and removes its reference from the text (Q18)', async () => {
    const events = userEvent.setup();
    answerUploads('available');
    fake.on('DELETE /api/v1/attachments/{attachmentId}', { status: 204 });
    renderInApp(<DraftsForm />);
    const textbox = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
    await events.type(textbox, 'Since Monday{Enter}');
    await events.upload(fileInput(), [textFile('first.log'), textFile('second.log')]);
    await waitFor(() => expect(textbox.value).toContain(idOf(2)));

    await events.click(await screen.findByRole('button', { name: 'Delete first.log' }));

    expect(fake.callsTo('DELETE /api/v1/attachments/{attachmentId}')[0]?.init).toMatchObject({
      params: { path: { attachmentId: idOf(1) } },
    });
    expect(textbox.value).toBe(
      `Since Monday\n[second\\.log](/api/v1/attachments/${idOf(2)}/content)`,
    );
    expect(screen.getByLabelText('Attachment IDs').textContent).toBe(idOf(2));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    // No confirmation: the draft is the person's own and nobody has seen it.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drops a draft the list no longer returns from the form, with a toast', async () => {
    const events = userEvent.setup();
    answerUploads('available');
    // The second draft is gone: purged after 24 hours or deleted in another tab.
    fake.on('GET /api/v1/attachments', (init) => {
      const { id } = (init as { params: { query: { id: string[] } } }).params.query;
      return {
        data: {
          items: id
            .filter((attachmentId) => attachmentId !== idOf(2))
            .map((attachmentId) =>
              attachmentResponse({ id: attachmentId, fileName: 'first.log', status: 'available' }),
            ),
          nextCursor: null,
        },
      };
    });
    renderInApp(<DraftsForm />);
    const textbox = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });

    await events.upload(fileInput(), [textFile('first.log'), textFile('second.log')]);

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'File second.log is no longer available',
        type: 'error',
      }),
    );
    expect(toastAdd).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Attachment IDs').textContent).toBe(idOf(1));
    expect(textbox.value).toContain(`[first\\.log](/api/v1/attachments/${idOf(1)}/content)`);
    expect(textbox.value).not.toContain(idOf(2));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    // The draft is gone already: nothing to delete.
    expect(fake.callsTo('DELETE /api/v1/attachments/{attachmentId}')).toHaveLength(0);
  });
});
