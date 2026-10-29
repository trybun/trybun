'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  type AddProjectMemberDto,
  addProjectMemberSchema,
  type ProjectMemberRole,
  projectMemberRoleSchema,
  projectRoleSchema,
} from '@trybun/contracts/projects';
import { emailSchema } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@trybun/ui/components/dialog';
import {
  Field,
  FieldContent,
  FieldDescription,
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
import { UserPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import {
  Controller,
  type FieldValues,
  type UseFormReturn,
  useForm,
  useWatch,
} from 'react-hook-form';
import { z } from 'zod';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { InvitationLink } from '../../invitations/components/invitation-link.js';
import { InvitationPreviewLine } from '../../invitations/components/invitation-preview-line.js';
import { useCreateInvitation } from '../../invitations/mutations.js';
import { invitationPreviewQueryOptions } from '../../invitations/queries.js';
import { useAddProjectMember } from '../mutations.js';
import { memberCandidatesQueryOptions } from '../queries.js';

/** How a member is added (§7.4, spec Q3): a team account picked from the list or an address. */
const addModeSchema = z.enum(['account', 'email']);
type AddMode = z.infer<typeof addModeSchema>;

/** An address with a project role: `end_user` invites an end user, a team role a team member. */
const inviteMemberSchema = z.object({ email: emailSchema, role: projectMemberRoleSchema });
type InviteMemberDto = z.input<typeof inviteMemberSchema>;

/** A new invitation whose link the dialog shows once (§7.4). */
type IssuedInvitation = { email: string; link: string; expiresAt: string };

/** The errors of a failed request at their fields of the form, else under the form. */
function showRequestError<Values extends FieldValues>(
  form: UseFormReturn<Values>,
  error: unknown,
  fields: readonly string[],
) {
  // The messages of the form hold error codes, translated where they are shown.
  const fieldErrors = (error instanceof ApiError ? fieldErrorsOf(error) : []).filter(({ field }) =>
    fields.includes(field),
  );
  for (const { field, code } of fieldErrors) {
    form.setError(field as Parameters<typeof form.setError>[0], { message: code });
  }
  if (fieldErrors.length === 0) {
    form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
  }
}

/**
 * Adding a member (§7.4): an active team account picked from the list, or an e-mail address with
 * a role – then the dialog shows, before sending, what will happen (an invitation, perhaps joining
 * an organization, or the access granted directly), and after an invitation its link with Copy
 * link. The search text stays in the component, never in the URL (§18.5).
 */
export function AddMemberDialog({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>('account');
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  // A new key per opening resets the forms.
  const [opening, setOpening] = useState(0);

  const close = () => {
    setIsOpen(false);
    setIssued(null);
    setMode('account');
    setOpening((value) => value + 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
      <DialogTrigger render={<Button className="w-full md:w-fit" />}>
        <UserPlusIcon aria-hidden />
        {t('members.add')}
      </DialogTrigger>
      <DialogContent>
        {issued === null ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('members.addTitle')}</DialogTitle>
              <DialogDescription>{t('members.addDescription')}</DialogDescription>
            </DialogHeader>
            <FieldSet>
              <FieldLegend variant="label">{t('members.addBy')}</FieldLegend>
              <RadioGroup
                value={mode}
                onValueChange={(value) => setMode(addModeSchema.parse(value))}
                className="grid-cols-2"
              >
                {addModeSchema.options.map((value) => (
                  <FieldLabel key={value}>
                    <Field orientation="horizontal">
                      <RadioGroupItem value={value} />
                      <FieldTitle>
                        {value === 'account' ? t('members.addByAccount') : t('members.addByEmail')}
                      </FieldTitle>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
            {mode === 'account' ? (
              <AccountForm key={opening} projectId={projectId} isOpen={isOpen} onDone={close} />
            ) : (
              <InvitationForm
                key={opening}
                projectId={projectId}
                onGranted={close}
                onInvited={setIssued}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('members.invitedTitle')}</DialogTitle>
              <DialogDescription>
                {t('members.invitedDescription', { email: issued.email })}
              </DialogDescription>
            </DialogHeader>
            <InvitationLink link={issued.link} expiresAt={issued.expiresAt} />
            <DialogFooter>
              <DialogClose render={<Button type="button" />}>{t('members.done')}</DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * A search of the active team accounts that are not members – by name or GitHub login, never
 * e-mail – a choice of one of them and of the team role.
 */
function AccountForm({
  projectId,
  isOpen,
  onDone,
}: {
  projectId: string;
  isOpen: boolean;
  onDone: () => void;
}) {
  const t = useTranslations('projects');
  const errorMessage = useErrorMessage();
  const addMember = useAddProjectMember(projectId);
  const [search, setSearch] = useState('');
  const form = useForm<AddProjectMemberDto>({
    resolver: zodResolver(addProjectMemberSchema, FORM_ERROR_MAP),
    defaultValues: { userId: '', role: 'developer' },
  });
  const userId = useWatch({ control: form.control, name: 'userId' });
  const deferredSearch = useDeferredValue(search.trim());
  const candidates = useQuery({
    ...memberCandidatesQueryOptions(browserApiClient, projectId, deferredSearch),
    enabled: isOpen,
  });
  const items = candidates.data?.items ?? [];
  // A search that hides the chosen account also withdraws the choice from the submit.
  const isChosenShown = items.some((candidate) => candidate.id === userId);

  const submit = form.handleSubmit((input) => {
    const chosen = items.find((candidate) => candidate.id === input.userId);
    const name = chosen?.displayName ?? chosen?.githubLogin ?? t('members.noName');
    return addMember
      .mutateAsync(input)
      .then(() => {
        toast.add({ title: t('members.added', { name }), type: 'success' });
        onDone();
      })
      .catch((error: unknown) => showRequestError(form, error, ['userId', 'role']));
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel>{t('members.search')}</FieldLabel>
          <Input
            type="search"
            value={search}
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Controller
          control={form.control}
          name="userId"
          render={({ field, fieldState }) => (
            <FieldSet>
              <FieldLegend variant="label">{t('members.candidates')}</FieldLegend>
              {candidates.isSuccess && items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('members.noCandidates')}</p>
              ) : (
                <RadioGroup
                  inputRef={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  className="max-h-64 overflow-y-auto"
                >
                  {items.map((candidate) => (
                    <FieldLabel key={candidate.id}>
                      <Field orientation="horizontal" invalid={fieldState.invalid}>
                        <RadioGroupItem value={candidate.id} aria-invalid={fieldState.invalid} />
                        <FieldContent className="min-w-0">
                          <FieldTitle className="truncate">
                            {candidate.displayName ?? t('members.noName')}
                          </FieldTitle>
                          {candidate.githubLogin !== null && (
                            <FieldDescription className="truncate">
                              @{candidate.githubLogin}
                            </FieldDescription>
                          )}
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              )}
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </FieldSet>
          )}
        />
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <RoleSelect
              roles={projectRoleSchema.options}
              value={field.value}
              onChange={(value) => field.onChange(projectRoleSchema.parse(value))}
            />
          )}
        />
      </FieldGroup>
      <FormFooter
        rootError={form.formState.errors.root}
        isDisabled={!isChosenShown || form.formState.isSubmitting}
        label={form.formState.isSubmitting ? t('members.adding') : t('members.submit')}
      />
    </form>
  );
}

/**
 * An e-mail address with a project role. The preview of the API says what sending will do; a
 * refusal (e.g. an account of the other kind) disables sending.
 */
function InvitationForm({
  projectId,
  onGranted,
  onInvited,
}: {
  projectId: string;
  onGranted: () => void;
  onInvited: (invitation: IssuedInvitation) => void;
}) {
  const t = useTranslations('projects');
  const errorMessage = useErrorMessage();
  const createInvitation = useCreateInvitation();
  const form = useForm<InviteMemberDto>({
    resolver: zodResolver(inviteMemberSchema, FORM_ERROR_MAP),
    defaultValues: { email: '', role: 'end_user' },
  });
  const [email, role] = useWatch({ control: form.control, name: ['email', 'role'] });
  const deferredEmail = useDeferredValue(email);
  const parsedEmail = emailSchema.safeParse(deferredEmail);
  const preview = useQuery({
    ...invitationPreviewQueryOptions(browserApiClient, {
      email: parsedEmail.data ?? '',
      target: { type: 'project', projectId, role },
    }),
    enabled: parsedEmail.success,
  });
  const isGrant = preview.data?.outcome === 'grant';

  const submit = form.handleSubmit((input) =>
    createInvitation
      .mutateAsync({ email: input.email, target: { type: 'project', projectId, role: input.role } })
      .then((created) => {
        if (created.outcome === 'access_granted') {
          const name = created.user.displayName ?? input.email;
          toast.add({ title: t('members.added', { name }), type: 'success' });
          onGranted();
          return;
        }
        onInvited({
          email: created.invitation.user.email ?? input.email,
          link: created.link,
          expiresAt: created.invitation.expiresAt,
        });
      })
      .catch((error: unknown) => showRequestError(form, error, ['email'])),
  );

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <FieldGroup>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('members.email')}</FieldLabel>
              <Input {...field} type="email" autoComplete="off" />
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <RoleSelect
              roles={projectMemberRoleSchema.options}
              value={field.value}
              onChange={(value) => field.onChange(projectMemberRoleSchema.parse(value))}
            />
          )}
        />
        {parsedEmail.success && (
          <InvitationPreviewLine
            preview={preview.data}
            error={preview.error}
            isChecking={preview.isFetching}
          />
        )}
      </FieldGroup>
      <FormFooter
        rootError={form.formState.errors.root}
        // An invalid address can be sent, so that the form says what is wrong with it.
        isDisabled={
          form.formState.isSubmitting ||
          (parsedEmail.success && (!preview.isSuccess || preview.isFetching))
        }
        label={
          form.formState.isSubmitting
            ? isGrant
              ? t('members.adding')
              : t('members.inviting')
            : isGrant
              ? t('members.submit')
              : t('members.invite')
        }
      />
    </form>
  );
}

/** The role of the new member, with the labels of the glossary. */
function RoleSelect({
  roles,
  value,
  onChange,
}: {
  roles: readonly ProjectMemberRole[];
  value: ProjectMemberRole;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('projects');
  return (
    <Field>
      <FieldLabel>{t('members.role')}</FieldLabel>
      <Select
        items={roles.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
        value={value}
        onValueChange={onChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {t(`roles.${role}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** The error of the whole form, Cancel and the submit button. */
function FormFooter({
  rootError,
  isDisabled,
  label,
}: {
  rootError: { message?: string } | undefined;
  isDisabled: boolean;
  label: string;
}) {
  const t = useTranslations('projects');
  const errorMessage = useErrorMessage();
  return (
    <>
      {rootError !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rootError.message)}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>
          {t('members.cancel')}
        </DialogClose>
        <Button type="submit" disabled={isDisabled}>
          {label}
        </Button>
      </DialogFooter>
    </>
  );
}
