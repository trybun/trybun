'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import type { ProjectAction } from '@trybun/contracts/projects';
import {
  type CreateTicketDto,
  createTicketSchema,
  TICKET_TYPE_DEFAULT_PRIORITY,
  type TicketType,
  ticketPrioritySchema,
  ticketTypeSchema,
} from '@trybun/contracts/tickets';
import { Button, buttonVariants } from '@trybun/ui/components/button';
import { Checkbox } from '@trybun/ui/components/checkbox';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { RadioGroup, RadioGroupItem } from '@trybun/ui/components/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { toast } from '@trybun/ui/components/toast';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, type UseFormReturn, useForm, useWatch } from 'react-hook-form';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { LazyAttachmentDrafts } from '../../attachments/components/lazy-attachment-drafts.js';
import { useAttachmentDrafts } from '../../attachments/use-attachment-drafts.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { ticketHref } from '../hrefs.js';
import { useCreateTicket } from '../mutations.js';
import {
  isUntouchedDescription,
  nextDescription,
  nextPriority,
  type TicketTemplates,
} from '../ticket-form-templates.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { AssigneePicker } from './assignee-control.js';
import { LazyMarkdownEditor } from './lazy-markdown-editor.js';

/** The default type of the full form (§3.3). */
const DEFAULT_TYPE: TicketType = 'task';

/** A project the person can create tickets in, with its actions (§18.3). */
export interface CreatableProject {
  id: string;
  name: string;
  allowedActions: readonly ProjectAction[];
}

/**
 * The project the form starts with (S1-10 Q6): the one it was opened from, else the only one, else
 * none – the person chooses.
 */
function defaultProjectId(projects: readonly CreatableProject[], requested: string | undefined) {
  if (projects.some((project) => project.id === requested)) {
    return requested ?? '';
  }
  return projects.length === 1 ? (projects[0]?.id ?? '') : '';
}

/**
 * The full ticket form of the team (§3.3, change specification of S1-10): project, type, title,
 * the description with the template of the type and its attachments, the priority and the
 * assignee. A type change replaces an empty or unchanged description and a default priority, never
 * the person's text or choice (§3.4, Q3); the templates are those of the language the page
 * inserted, so a language switch changes neither (Q4). The assignee control follows the actions of
 * the chosen project – never the roles (Q15). **Create ticket** stays disabled while the request
 * is pending and while a file is uploading, so a double press creates one ticket; the new ticket
 * then opens with a toast. Leaving with a typed title or description asks first (Q10).
 */
export function TeamTicketForm({
  projects,
  requestedProjectId,
  templates: insertedTemplates,
  attachmentMaxSizeMb,
}: {
  /** The active projects whose `allowedActions` contain `create_ticket`; at least one. */
  projects: readonly CreatableProject[];
  /** `?projectId=` of the address, when valid. */
  requestedProjectId?: string;
  /** The templates in the account language, else the request language (Q4). */
  templates: TicketTemplates;
  /** `TRYBUN_ATTACHMENT_MAX_SIZE_MB` of the web server (§13.3). */
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const createTicket = useCreateTicket();
  // A language switch renders the page again with the other language's templates; the form keeps
  // comparing with the ones it inserted (Q4).
  const [templates] = useState(insertedTemplates);
  const form = useForm<CreateTicketDto>({
    resolver: zodResolver(createTicketSchema, FORM_ERROR_MAP),
    defaultValues: {
      projectId: defaultProjectId(projects, requestedProjectId),
      type: DEFAULT_TYPE,
      title: '',
      description: templates[DEFAULT_TYPE],
      priority: TICKET_TYPE_DEFAULT_PRIORITY[DEFAULT_TYPE],
      assigneeId: null,
      attachmentIds: [],
    },
  });
  const attachments = useAttachmentDrafts({
    form,
    textField: 'description',
    maxSizeMb: attachmentMaxSizeMb,
  });
  const [projectId, type = DEFAULT_TYPE, title, description = ''] = useWatch({
    control: form.control,
    name: ['projectId', 'type', 'title', 'description'],
  });
  const project = projects.find((candidate) => candidate.id === projectId);
  const hasChanges = title.trim() !== '' || !isUntouchedDescription(description, type, templates);
  const leaving = useUnsavedChanges(hasChanges && !createTicket.isSuccess);

  const changeType = (next: TicketType) => {
    const values = form.getValues();
    const previous = values.type ?? DEFAULT_TYPE;
    form.setValue('type', next);
    form.setValue(
      'description',
      nextDescription(values.description ?? '', previous, next, templates),
    );
    form.setValue(
      'priority',
      nextPriority(values.priority ?? TICKET_TYPE_DEFAULT_PRIORITY[previous], previous, next),
    );
  };

  const submit = form.handleSubmit((input) =>
    createTicket
      .mutateAsync(input)
      .then((ticket) => {
        toast.add({
          title: t('form.created', { identifier: ticket.identifier }),
          type: 'success',
        });
        router.push(ticketHref(ticket.identifier));
      })
      .catch((error: unknown) => {
        // The messages of the form hold error codes, translated where they are shown.
        const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
        for (const { field, code } of fieldErrors) {
          form.setError(field as keyof CreateTicketDto, { message: code });
        }
        if (fieldErrors.length === 0) {
          form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
        }
      }),
  );
  const rootError = form.formState.errors.root;

  return (
    <form
      noValidate
      aria-label={t('form.heading')}
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <Controller
          control={form.control}
          name="projectId"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('form.project')}</FieldLabel>
              <Select
                items={projects.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                }))}
                value={field.value === '' ? null : field.value}
                onValueChange={(value) => {
                  field.onChange(value ?? '');
                  // Who can be assigned depends on the project.
                  form.setValue('assigneeId', null);
                }}
              >
                <SelectTrigger className="w-full" onBlur={field.onBlur}>
                  <SelectValue placeholder={t('form.projectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                errors={[
                  fieldState.error && {
                    // A project not chosen is an empty ID, which is no UUID.
                    message: errorMessage(fieldState.error.message, {
                      'string.invalid_format': t('form.projectRequired'),
                    }),
                  },
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend variant="label">{t('form.type')}</FieldLegend>
              <RadioGroup
                inputRef={field.ref}
                name={field.name}
                value={field.value}
                onValueChange={(value) => changeType(ticketTypeSchema.parse(value))}
                className="grid-cols-2 md:grid-cols-4"
              >
                {ticketTypeSchema.options.map((value) => (
                  // A 44 px touch target below the desktop with a precise pointer (§2.9).
                  <FieldLabel
                    key={value}
                    className="min-h-11 justify-center xl:pointer-fine:min-h-0"
                  >
                    <Field orientation="horizontal">
                      <RadioGroupItem value={value} />
                      <FieldTitle>{t(`types.${value}`)}</FieldTitle>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          )}
        />
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('form.title')}</FieldLabel>
              <Input {...field} autoComplete="off" />
              <FieldError
                errors={[
                  fieldState.error && {
                    message: errorMessage(fieldState.error.message, {
                      'string.empty': t('form.titleRequired'),
                    }),
                  },
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('form.description')}</FieldLabel>
              <LazyMarkdownEditor
                name={field.name}
                value={field.value ?? ''}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={fieldState.invalid}
                {...attachments.editorProps}
              />
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
        <LazyAttachmentDrafts drafts={attachments.drafts} onRemove={attachments.removeDraft} />
        <Controller
          control={form.control}
          name="priority"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('form.priority')}</FieldLabel>
              <Select
                items={ticketPrioritySchema.options.map((value) => ({
                  value,
                  label: t(`priorities.${value}`),
                }))}
                value={field.value}
                onValueChange={(value) => field.onChange(ticketPrioritySchema.parse(value))}
              >
                <SelectTrigger className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ticketPrioritySchema.options.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`priorities.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
        {project !== undefined && <AssigneeField form={form} project={project} />}
      </FieldGroup>
      {rootError !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rootError.message)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 pb-safe-offset-0 md:flex-row md:justify-end">
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'w-full md:w-fit')}>
          {t('form.cancel')}
        </Link>
        <Button
          type="submit"
          className="w-full md:w-fit"
          disabled={
            form.formState.isSubmitting || createTicket.isSuccess || attachments.isUploading
          }
        >
          {t('form.submit')}
        </Button>
      </div>
      {leaving.pendingHref !== null && (
        <LazyConfirmDialog
          title={t('view.discard.title')}
          description={t('view.discard.description')}
          confirmLabel={t('view.discard.confirm')}
          cancelLabel={t('view.discard.cancel')}
          isDestructive
          onConfirm={leaving.leave}
          onClose={leaving.stay}
        />
      )}
    </form>
  );
}

/**
 * The assignee of the new ticket, by the actions of the chosen project (S1-10 Q15): the picker
 * with `assign_tickets`, an **Assign to me** checkbox with only `assign_tickets_self`, nothing
 * otherwise. The server still checks the assignee on creation.
 */
function AssigneeField({
  form,
  project,
}: {
  form: UseFormReturn<CreateTicketDto>;
  project: CreatableProject;
}) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const user = useQuery(currentUserQueryOptions(browserApiClient));
  const me = user.data?.id;
  // The name of the person chosen in the picker; the form holds only the ID.
  const [chosenName, setChosenName] = useState('');
  const canAssign = project.allowedActions.includes('assign_tickets');
  if (!canAssign && (!project.allowedActions.includes('assign_tickets_self') || me === undefined)) {
    return null;
  }
  return (
    <Controller
      control={form.control}
      name="assigneeId"
      render={({ field, fieldState }) => {
        const assigneeId = field.value ?? null;
        const error = (
          <FieldError
            errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
          />
        );
        if (!canAssign) {
          return (
            <Field orientation="horizontal" invalid={fieldState.invalid}>
              <Checkbox
                inputRef={field.ref}
                name={field.name}
                checked={assigneeId !== null && assigneeId === me}
                onCheckedChange={(checked) => field.onChange(checked ? me : null)}
              />
              <FieldLabel>{t('form.assignToMe')}</FieldLabel>
              {error}
            </Field>
          );
        }
        const label =
          assigneeId === null
            ? t('view.unassigned')
            : assigneeId === me
              ? (user.data?.displayName ?? chosenName)
              : chosenName;
        return (
          <Field invalid={fieldState.invalid}>
            <FieldLabel>{t('form.assignee')}</FieldLabel>
            <AssigneePicker
              projectId={project.id}
              me={me}
              selected={{ value: assigneeId, label }}
              disabled={false}
              onAssign={(id, name) => {
                setChosenName(name);
                field.onChange(id);
              }}
            />
            {error}
          </Field>
        );
      }}
    />
  );
}
