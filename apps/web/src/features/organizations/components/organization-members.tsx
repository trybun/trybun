'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  addOrganizationMemberSchema,
  type Organization,
  type OrganizationMember,
} from '@trybun/contracts/organizations';
import { Badge } from '@trybun/ui/components/badge';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { toast } from '@trybun/ui/components/toast';
import { UserPlusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { useAddOrganizationMember, useRemoveOrganizationMember } from '../mutations.js';
import { organizationMembersQueryOptions } from '../queries.js';
import { OrganizationSection } from './organization-section.js';

const addMemberSchema = addOrganizationMemberSchema.pick({ email: true });
type AddMemberValues = z.infer<typeof addMemberSchema>;

/** Whether an error says the person belongs to another organization (§7.3). */
function isOfOtherOrganization(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'organization.member_of_other_organization';
}

/**
 * The members of an organization (§7.3): display name, e-mail address, account state and the date
 * they joined, page by page; with `manage_members` also adding an end user by e-mail address and
 * Remove with Undo instead of a confirmation (Rule 2). A person of another organization is moved
 * only after the confirmation of the move – Undo of a removal never moves anyone.
 */
export function OrganizationMembers({ organization }: { organization: Organization }) {
  const t = useTranslations('organizations.members');
  const tList = useTranslations('organizations.list');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const canManage = organization.allowedActions.includes('manage_members');
  const members = useInfiniteQuery(
    organizationMembersQueryOptions(browserApiClient, organization.id),
  );
  const addMember = useAddOrganizationMember(organization.id);
  const removeMember = useRemoveOrganizationMember(organization.id);
  const [pendingMove, setPendingMove] = useState<string | null>(null);
  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema, FORM_ERROR_MAP),
    defaultValues: { email: '' },
  });
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });

  const items = members.data?.pages.flatMap((page) => page.items) ?? [];
  const nameOf = (member: OrganizationMember) =>
    member.user.displayName ?? member.user.email ?? t('noName');

  const add = async (email: string, move: boolean) => {
    const isAlreadyMember = items.some(
      (member) => member.user.email?.toLowerCase() === email.toLowerCase(),
    );
    const added = await addMember.mutateAsync({ email, move });
    toast.add({
      title: isAlreadyMember
        ? t('alreadyMember', { name: nameOf(added) })
        : t('added', { name: nameOf(added) }),
      type: 'success',
    });
    form.reset();
  };

  const submit = form.handleSubmit(async ({ email }) => {
    try {
      await add(email, false);
    } catch (error) {
      if (isOfOtherOrganization(error)) {
        setPendingMove(email);
        return;
      }
      // The messages of the form hold error codes, translated where they are shown.
      const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
      for (const { code } of fieldErrors) {
        form.setError('email', { message: code });
      }
      if (fieldErrors.length === 0) {
        form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
      }
    }
  });

  const remove = (member: OrganizationMember) =>
    removeMember.mutate(member.user.id, {
      onSuccess: () => {
        const { email } = member.user;
        toast.add({
          title: t('removed', { name: nameOf(member) }),
          type: 'success',
          // Undo adds the person again, without a move: if another Administrator has added them
          // to a different organization meanwhile, the error is shown instead (§7.3).
          ...(email === null
            ? {}
            : {
                actionProps: {
                  children: t('undo'),
                  onClick: () => addMember.mutate({ email }, { onError: showError }),
                },
              }),
        });
      },
      onError: showError,
    });

  return (
    <OrganizationSection
      id="organization-members-title"
      title={t('title')}
      description={t('description')}
    >
      {canManage && (
        <form
          noValidate
          data-tour="organization-detail-add-member"
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-3 md:flex-row md:items-start"
        >
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field invalid={fieldState.invalid} className="md:flex-1">
                <FieldLabel>{t('email')}</FieldLabel>
                <Input {...field} type="email" autoComplete="off" spellCheck={false} />
                <FieldError
                  errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
                />
              </Field>
            )}
          />
          <Button
            type="submit"
            className="w-full md:mt-6 md:w-fit"
            disabled={form.formState.isSubmitting || addMember.isPending}
          >
            <UserPlusIcon aria-hidden />
            {form.formState.isSubmitting ? t('adding') : t('add')}
          </Button>
          {form.formState.errors.root !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(form.formState.errors.root.message)}
            </p>
          )}
        </form>
      )}
      {members.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(members.error)}
        </p>
      ) : (
        members.isSuccess &&
        items.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((member) => (
          <li
            key={member.user.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground md:flex-row md:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{nameOf(member)}</span>
                {member.user.state !== 'active' && (
                  <Badge variant="outline">{t(`states.${member.user.state}`)}</Badge>
                )}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {member.user.email ?? t('noEmail')}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('joined', {
                  date: format.dateTime(new Date(member.createdAt), { dateStyle: 'medium' }),
                })}
              </span>
            </div>
            {canManage && (
              <Button
                variant="outline"
                aria-label={t('removeOf', { name: nameOf(member) })}
                disabled={removeMember.isPending}
                onClick={() => remove(member)}
              >
                {t('remove')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {members.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={members.isFetchingNextPage}
          onClick={() => void members.fetchNextPage()}
        >
          {members.isFetchingNextPage ? tList('loadingMore') : tList('loadMore')}
        </Button>
      )}
      {pendingMove !== null && (
        <LazyConfirmDialog
          title={t('moveTitle', { email: pendingMove })}
          description={t('moveDescription')}
          confirmLabel={t('moveConfirm')}
          cancelLabel={t('cancel')}
          isPending={addMember.isPending}
          onConfirm={() =>
            void add(pendingMove, true)
              .catch(showError)
              .finally(() => setPendingMove(null))
          }
          onClose={() => setPendingMove(null)}
        />
      )}
    </OrganizationSection>
  );
}
