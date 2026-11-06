'use client';

import { useQuery } from '@tanstack/react-query';
import { type Attachment, MAX_FILES_PER_UPLOAD } from '@trybun/contracts/attachments';
import type { AttachmentState } from '@trybun/ui/components/attachment-list';
import type { AddedFile } from '@trybun/ui/components/markdown-editor';
import { toast } from '@trybun/ui/components/toast';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useState } from 'react';
import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';
import { useErrorMessage } from '../../lib/errors/error-message.js';
import { attachmentStateOf } from './attachment-state.js';
import { withoutAttachmentReferences } from './markdown-references.js';
import { useDeleteAttachment, useUploadAttachment } from './mutations.js';
import { attachmentsQueryOptions } from './queries.js';

const BYTES_PER_MB = 1024 * 1024;

/** A file the person added to the form: uploading until it has the ID of its draft. */
interface AddedDraft {
  key: string;
  file: File;
  id?: string;
}

/** A draft attachment of a form as its list shows it (`AttachmentDrafts`). */
export interface AttachmentDraft {
  key: string;
  /** The ID of the draft; absent while the file is uploading. */
  id?: string;
  fileName: string;
  size: number;
  contentType: string;
  isImage: boolean;
  state: AttachmentState;
}

export interface UseAttachmentDraftsOptions<Values extends FieldValues> {
  /** The form; its field `attachmentIds` receives the IDs of the drafts. */
  form: UseFormReturn<Values>;
  /** The Markdown field the editor writes, whose references to a removed draft are removed. */
  textField: Path<Values>;
  /** `TRYBUN_ATTACHMENT_MAX_SIZE_MB` (§13.3), passed from the server page. */
  maxSizeMb: number;
  /** The available images of the ticket the form belongs to, for the preview. */
  ticketImageIds?: readonly string[];
}

/**
 * The attachments of a form with the GFM editor (§13.3, S1-08 Q18): the editor props to spread on
 * `LazyMarkdownEditor`, the drafts for `AttachmentDrafts`, and their removal. Every file is
 * uploaded on its own (Q6), at most 10 per drop, paste or selection; a file over the size limit is
 * refused before it is sent (Q2), and every rejection is an error toast naming the file. The drafts
 * are polled with one request while one of them is being checked (Q7). The form's `attachmentIds`
 * holds the IDs of the uploaded drafts. Removing a draft deletes it at once and removes its
 * references from the text. A draft the list no longer returns – purged after 24 hours or deleted
 * elsewhere – leaves the form the same way, with a toast naming the file. The preview shows the form's available image drafts (attachment
 * serving item 5) and the images of the ticket.
 */
export function useAttachmentDrafts<Values extends FieldValues & { attachmentIds?: string[] }>({
  form,
  textField,
  maxSizeMb,
  ticketImageIds = [],
}: UseAttachmentDraftsOptions<Values>) {
  const t = useTranslations('attachments');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const [added, setAdded] = useState<AddedDraft[]>([]);
  const ids = added.flatMap((draft) => (draft.id === undefined ? [] : [draft.id]));
  const attachments = useQuery(attachmentsQueryOptions(browserApiClient, ids));
  const byId = new Map<string, Attachment>(
    (attachments.data ?? []).map((attachment) => [attachment.id, attachment]),
  );

  // An answer for the current IDs (not the previous one kept while it loads) leaves out the drafts
  // that are gone: they leave the list while rendering, and the form in the effect below.
  const [answered, setAnswered] = useState<Attachment[]>();
  const [unavailable, setUnavailable] = useState<{ id: string; fileName: string }[]>([]);
  const answer = attachments.isPlaceholderData ? undefined : attachments.data;
  if (answer !== undefined && answer !== answered) {
    setAnswered(answer);
    const gone = added.flatMap(({ id, file }) =>
      id === undefined || byId.has(id) ? [] : [{ id, fileName: file.name }],
    );
    if (gone.length > 0) {
      const goneIds = new Set(gone.map(({ id }) => id));
      setAdded((previous) => previous.filter(({ id }) => id === undefined || !goneIds.has(id)));
      setUnavailable(gone);
    }
  }

  // `attachmentIds` is a field of the form's values; its path type cannot be checked generically.
  const idsField = 'attachmentIds' as Path<Values>;
  const attachmentIdsOfForm = (): string[] => {
    const value: unknown = form.getValues(idsField);
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  };
  const setAttachmentIds = (next: string[]) =>
    form.setValue(idsField, next as PathValue<Values, Path<Values>>, { shouldDirty: true });

  const reject = (fileName: string, reason: string) =>
    toast.add({ title: fileName, description: reason, type: 'error' });
  const tooLarge = () => t('tooLarge', { max: maxSizeMb });

  function upload(file: File): Promise<AddedFile> {
    if (file.size > maxSizeMb * BYTES_PER_MB) {
      reject(file.name, tooLarge());
      return Promise.reject(new Error('The file is larger than the size limit'));
    }
    const key = crypto.randomUUID();
    setAdded((previous) => [...previous, { key, file }]);
    return uploadAttachment.mutateAsync(file).then(
      (attachment) => {
        setAdded((previous) =>
          previous.map((draft) => (draft.key === key ? { ...draft, id: attachment.id } : draft)),
        );
        setAttachmentIds([...attachmentIdsOfForm(), attachment.id]);
        return { id: attachment.id, name: attachment.fileName, isImage: attachment.isImage };
      },
      (error: unknown) => {
        setAdded((previous) => previous.filter((draft) => draft.key !== key));
        // A file over the limit of the API (`413`) has the message of the browser's check.
        reject(
          file.name,
          error instanceof ApiError && error.code === 'request.too_large'
            ? tooLarge()
            : errorMessage(error),
        );
        throw error;
      },
    );
  }

  function onFilesAdd(files: File[]): Promise<AddedFile>[] {
    const excess = files.slice(MAX_FILES_PER_UPLOAD);
    if (excess.length > 0) {
      toast.add({
        title: t('tooManyFiles', { max: MAX_FILES_PER_UPLOAD }),
        description: format.list(excess.map((file) => file.name)),
        type: 'error',
      });
    }
    return [
      ...files.slice(0, MAX_FILES_PER_UPLOAD).map(upload),
      ...excess.map(() => Promise.reject(new Error('Too many files at once'))),
    ];
  }

  const drafts: AttachmentDraft[] = added.map(({ key, file, id }) => {
    const attachment = id === undefined ? undefined : byId.get(id);
    return {
      key,
      ...(id === undefined ? {} : { id }),
      fileName: attachment?.fileName ?? file.name,
      size: attachment?.size ?? file.size,
      contentType: attachment?.contentType ?? file.type,
      isImage: attachment?.isImage ?? false,
      // A draft not read yet has just been uploaded: it is in quarantine.
      state: id === undefined ? 'uploading' : attachmentStateOf(attachment?.status ?? 'quarantine'),
    };
  });

  /** Removes a draft from the form's `attachmentIds` and its references from the text. */
  function removeFromForm(id: string) {
    setAttachmentIds(attachmentIdsOfForm().filter((attachmentId) => attachmentId !== id));
    const text: unknown = form.getValues(textField);
    if (typeof text === 'string') {
      form.setValue(
        textField,
        withoutAttachmentReferences(text, id) as PathValue<Values, Path<Values>>,
        { shouldDirty: true },
      );
    }
  }

  const removeUnavailable = useEffectEvent(
    (drafts: readonly { id: string; fileName: string }[]) => {
      for (const { id, fileName } of drafts) {
        removeFromForm(id);
        toast.add({ title: t('unavailable', { name: fileName }), type: 'error' });
      }
    },
  );
  useEffect(() => removeUnavailable(unavailable), [unavailable]);

  /** Deletes an uploaded draft at once and removes its references from the text (Q18). */
  function removeDraft(draft: AttachmentDraft) {
    const { id } = draft;
    if (id === undefined) {
      return;
    }
    setAdded((previous) => previous.filter(({ key }) => key !== draft.key));
    removeFromForm(id);
    deleteAttachment.mutate(
      { id, ticketId: null },
      { onError: (error) => reject(draft.fileName, errorMessage(error)) },
    );
  }

  const attachmentImageIds = [
    ...ticketImageIds,
    ...drafts.flatMap((draft) =>
      draft.id !== undefined && draft.isImage && draft.state === 'available' ? [draft.id] : [],
    ),
  ];

  return {
    editorProps: { onFilesAdd, attachmentImageIds },
    drafts,
    removeDraft,
    /** Whether a file is still uploading: its reference is not in the text yet. */
    isUploading: drafts.some((draft) => draft.state === 'uploading'),
  };
}
