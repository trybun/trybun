'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type UseInfiniteQueryResult, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  type InvitationTarget,
  type InvitationTargetType,
  invitationTargetTypeSchema,
} from '@trybun/contracts/invitations';
import { type ProjectMemberRole, projectMemberRoleSchema } from '@trybun/contracts/projects';
import { emailSchema, type UserKind } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from '@trybun/ui/components/combobox';
import { DialogClose, DialogFooter } from '@trybun/ui/components/dialog';
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
import { useTranslations } from 'next-intl';
import { useDeferredValue, useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { QueryErrorAlert } from '../../app-shell/components/query-error-alert.js';
import { organizationsQueryOptions } from '../../organizations/queries.js';
import { projectsQueryOptions } from '../../projects/queries.js';
import { useCreateInvitation } from '../mutations.js';
import { invitationPreviewQueryOptions } from '../queries.js';
import { InvitationPreviewLine } from './invitation-preview-line.js';

/**
 * An address with a target: the type, and the project with a role or the organization it names.
 * The project and the organization are empty until one is picked.
 */
const invitationFormSchema = z.object({
  email: emailSchema,
  type: invitationTargetTypeSchema,
  projectId: z.string(),
  role: projectMemberRoleSchema,
  organizationId: z.string(),
});
type InvitationFormValues = z.input<typeof invitationFormSchema>;

/** A new invitation whose link is shown once (§7.4). */
export type IssuedInvitation = { email: string; link: string; expiresAt: string };

/** The project roles of an account kind: `end_user` for end users, the team roles for the team. */
const ROLES_OF_KIND: Record<UserKind, readonly ProjectMemberRole[]> = {
  end_user: ['end_user'],
  team: ['developer', 'project_manager'],
};

/**
 * The targets of an account kind (§7.4): organizations take end users, the Administrator role
 * team members.
 */
const TARGETS_OF_KIND: Record<UserKind, readonly InvitationTargetType[]> = {
  end_user: ['project', 'organization'],
  team: ['project', 'administrator'],
};

/** The target of the form, or `null` while its project or organization is not picked. */
function targetOf(values: InvitationFormValues): InvitationTarget | null {
  switch (values.type) {
    case 'project':
      return values.projectId === ''
        ? null
        : { type: 'project', projectId: values.projectId, role: values.role };
    case 'organization':
      return values.organizationId === ''
        ? null
        : { type: 'organization', organizationId: values.organizationId };
    case 'administrator':
      return { type: 'administrator' };
  }
}

/**
 * An e-mail address with a target (§7.4): in the Members tab the role in its project, on the
 * Accounts page a project with a role, an organization or the Administrator role – only those of
 * the account's kind when the account exists. The preview of the API says what sending will do; a
 * refusal (e.g. an account of the other kind) disables sending. Without a fixed project the
 * projects and organizations are picked from the active ones.
 */
export function InvitationForm({
  projectId,
  kind,
  defaultEmail = '',
  onGranted,
  onInvited,
}: {
  /** The project of the Members tab: only the role is chosen. */
  projectId?: string;
  /** The kind of an existing account: only its targets and roles are offered. */
  kind?: UserKind;
  defaultEmail?: string;
  /** The access was granted to an active account directly: its display name or address. */
  onGranted: (name: string) => void;
  onInvited: (invitation: IssuedInvitation) => void;
}) {
  const t = useTranslations('invitations.form');
  const errorMessage = useErrorMessage();
  const createInvitation = useCreateInvitation();
  const roles = kind === undefined ? projectMemberRoleSchema.options : ROLES_OF_KIND[kind];
  const targetTypes =
    kind === undefined ? invitationTargetTypeSchema.options : TARGETS_OF_KIND[kind];
  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema, FORM_ERROR_MAP),
    defaultValues: {
      email: defaultEmail,
      type: 'project',
      projectId: projectId ?? '',
      role: kind === 'team' ? 'developer' : 'end_user',
      organizationId: '',
    },
  });
  const values = useWatch({ control: form.control }) as InvitationFormValues;
  const target = targetOf(values);
  const deferredEmail = useDeferredValue(values.email);
  const parsedEmail = emailSchema.safeParse(deferredEmail);
  const preview = useQuery({
    ...invitationPreviewQueryOptions(browserApiClient, {
      email: parsedEmail.data ?? '',
      target: target ?? { type: 'administrator' },
    }),
    enabled: parsedEmail.success && target !== null,
  });
  const isGrant = preview.data?.outcome === 'grant';

  const submit = form.handleSubmit((input) => {
    const chosen = targetOf(input);
    if (chosen === null) {
      return;
    }
    return createInvitation
      .mutateAsync({ email: input.email, target: chosen })
      .then((created) => {
        if (created.outcome === 'access_granted') {
          onGranted(created.user.displayName ?? input.email);
          return;
        }
        onInvited({
          email: created.invitation.user.email ?? input.email,
          link: created.link,
          expiresAt: created.invitation.expiresAt,
        });
      })
      .catch((error: unknown) => {
        // The messages of the form hold error codes, translated where they are shown.
        const fieldErrors = (error instanceof ApiError ? fieldErrorsOf(error) : []).filter(
          ({ field }) => field === 'email',
        );
        for (const { code } of fieldErrors) {
          form.setError('email', { message: code });
        }
        if (fieldErrors.length === 0) {
          form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
        }
      });
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <FieldGroup>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('email')}</FieldLabel>
              <Input {...field} type="email" autoComplete="off" />
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
        {projectId === undefined && (
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <FieldSet>
                <FieldLegend variant="label">{t('target')}</FieldLegend>
                <RadioGroup
                  inputRef={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={(value) => field.onChange(invitationTargetTypeSchema.parse(value))}
                >
                  {targetTypes.map((value) => (
                    // A 44 px touch target below the desktop with a precise pointer (§2.9).
                    <FieldLabel
                      key={value}
                      className="min-h-11 justify-center xl:pointer-fine:min-h-0"
                    >
                      <Field orientation="horizontal">
                        <RadioGroupItem value={value} />
                        <FieldTitle>{t(`targetTypes.${value}`)}</FieldTitle>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>
            )}
          />
        )}
        {projectId === undefined && values.type === 'project' && (
          <Controller
            control={form.control}
            name="projectId"
            render={({ field }) => <ProjectPicker value={field.value} onChange={field.onChange} />}
          />
        )}
        {values.type === 'project' && (
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <RoleSelect
                label={t('role')}
                roles={roles}
                value={field.value}
                onChange={(value) => field.onChange(projectMemberRoleSchema.parse(value))}
              />
            )}
          />
        )}
        {values.type === 'organization' && (
          <Controller
            control={form.control}
            name="organizationId"
            render={({ field }) => (
              <OrganizationPicker value={field.value} onChange={field.onChange} />
            )}
          />
        )}
        {parsedEmail.success && target !== null && (
          <InvitationPreviewLine
            preview={preview.data}
            error={preview.error}
            isChecking={preview.isFetching}
          />
        )}
      </FieldGroup>
      <FormFooter
        rootError={form.formState.errors.root}
        cancelLabel={t('cancel')}
        // An invalid address can be sent, so that the form says what is wrong with it.
        isDisabled={
          form.formState.isSubmitting ||
          target === null ||
          (parsedEmail.success && (!preview.isSuccess || preview.isFetching))
        }
        label={
          form.formState.isSubmitting
            ? isGrant
              ? t('granting')
              : t('inviting')
            : isGrant
              ? t('grant')
              : t('invite')
        }
      />
    </form>
  );
}

/** The error of the read of a picker's list, with a way to read it again (#471). */
interface PickerReadError {
  error: Error;
  retry: () => void;
}

/**
 * All pages of a list the pickers search in the browser: the lists of the API have no search. A
 * failed page stops the reading and comes back as `readError`, so a failure never reads as fewer
 * items; **Try again** reads the loaded pages again, and the reading of the rest continues.
 */
function useAllPages<Item>(query: UseInfiniteQueryResult<{ pages: { items: Item[] }[] }>): {
  items: Item[];
  readError: PickerReadError | null;
} {
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage, refetch } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    readError: query.isError ? { error: query.error, retry: () => void refetch() } : null,
  };
}

/** A choice of the active projects, searched by name or key. */
function ProjectPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations('invitations.form');
  const projects = useAllPages(useInfiniteQuery(projectsQueryOptions(browserApiClient, 'active')));
  return (
    <Picker
      label={t('project')}
      listLabel={t('projects')}
      empty={t('noProject')}
      loadFailed={t('projectsLoadFailed')}
      readError={projects.readError}
      items={projects.items.map((project) => ({
        value: project.id,
        label: `${project.name} (${project.key})`,
      }))}
      value={value}
      onChange={onChange}
    />
  );
}

/** A choice of the active organizations, searched by name. */
function OrganizationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('invitations.form');
  const organizations = useAllPages(
    useInfiniteQuery(organizationsQueryOptions(browserApiClient, 'active')),
  );
  return (
    <Picker
      label={t('organization')}
      listLabel={t('organizations')}
      empty={t('noOrganization')}
      loadFailed={t('organizationsLoadFailed')}
      readError={organizations.readError}
      items={organizations.items.map((organization) => ({
        value: organization.id,
        label: organization.name,
      }))}
      value={value}
      onChange={onChange}
    />
  );
}

/**
 * A searchable choice of one item of a list (the Combobox of `@trybun/ui`). A failed read of the
 * list shows its error with **Try again** below the input, and the list says `loadFailed` below the
 * items found so far in place of `empty` (#471): the list of a combobox is no stop of Tab, which
 * closes it (WAI-ARIA APG), so **Try again** follows the input outside it.
 */
function Picker({
  label,
  listLabel,
  empty,
  loadFailed,
  readError,
  items,
  value,
  onChange,
}: {
  label: string;
  listLabel: string;
  empty: string;
  /** What the list says while its read failed. */
  loadFailed: string;
  readError: PickerReadError | null;
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('invitations.form');
  const errorMessage = useErrorMessage();
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Combobox
        items={items}
        value={items.find((item) => item.value === value) ?? null}
        onValueChange={(item: { value: string } | null) => onChange(item?.value ?? '')}
      >
        <ComboboxInput />
        <ComboboxContent>
          {/* Mounted in every state, so its text is announced; empty after an error (#303). */}
          <ComboboxEmpty>{readError === null ? empty : ''}</ComboboxEmpty>
          <ComboboxList aria-label={listLabel}>
            {(item: { value: string; label: string }) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
          {/* A polite live region, filled while the read failed: the rest of the dialog is hidden
              from assistive technologies while the list is open. */}
          <ComboboxStatus>{readError === null ? '' : loadFailed}</ComboboxStatus>
        </ComboboxContent>
      </Combobox>
      {readError !== null && (
        // A refusal says when to try again, `h3` under the `h2` title of the dialog; **Try again**
        // reads the list again, so it offers no **Reload page**, which would close the dialog
        // (§18.5).
        <div className="flex flex-col items-start gap-2 text-sm">
          <QueryErrorAlert
            error={readError.error}
            message={errorMessage(readError.error)}
            headingLevel={3}
            offersReload={false}
          />
          <Button type="button" variant="outline" onClick={readError.retry}>
            {t('retry')}
          </Button>
        </div>
      )}
    </Field>
  );
}

/** The project role of a new member or invitation, with the labels of the glossary. */
export function RoleSelect({
  label,
  roles,
  value,
  onChange,
}: {
  label: string;
  roles: readonly ProjectMemberRole[];
  value: ProjectMemberRole;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('invitations.roles');
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={roles.map((role) => ({ value: role, label: t(role) }))}
        value={value}
        onValueChange={onChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {t(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** The error of the whole form of a dialog, Cancel and the submit button. */
export function FormFooter({
  rootError,
  cancelLabel,
  isDisabled,
  label,
}: {
  rootError: { message?: string } | undefined;
  cancelLabel: string;
  isDisabled: boolean;
  label: string;
}) {
  const errorMessage = useErrorMessage();
  return (
    <>
      {rootError !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rootError.message)}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>{cancelLabel}</DialogClose>
        <Button type="submit" disabled={isDisabled}>
          {label}
        </Button>
      </DialogFooter>
    </>
  );
}
