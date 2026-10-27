'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  type AddProjectMemberDto,
  addProjectMemberSchema,
  projectRoleSchema,
} from '@trybun/contracts/projects';
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
import { Controller, useForm, useWatch } from 'react-hook-form';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { useAddProjectMember } from '../mutations.js';
import { memberCandidatesQueryOptions } from '../queries.js';

/**
 * Adding a member (§7.4): a search of the active team accounts that are not members – by name or
 * GitHub login, never e-mail – a choice of one of them and of the role. The search text stays in
 * the component, never in the URL (§18.5).
 */
export function AddMemberDialog({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const errorMessage = useErrorMessage();
  const addMember = useAddProjectMember(projectId);
  const [isOpen, setIsOpen] = useState(false);
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

  const close = () => {
    setIsOpen(false);
    setSearch('');
    form.reset();
  };

  const submit = form.handleSubmit((input) => {
    const chosen = items.find((candidate) => candidate.id === input.userId);
    const name = chosen?.displayName ?? chosen?.githubLogin ?? t('members.noName');
    return addMember
      .mutateAsync(input)
      .then(() => {
        toast.add({ title: t('members.added', { name }), type: 'success' });
        close();
      })
      .catch((error: unknown) => {
        // The messages of the form hold error codes, translated where they are shown.
        const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
        for (const { field, code } of fieldErrors) {
          form.setError(field as keyof AddProjectMemberDto, { message: code });
        }
        if (fieldErrors.length === 0) {
          form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
        }
      });
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
      <DialogTrigger render={<Button className="w-full md:w-fit" />}>
        <UserPlusIcon aria-hidden />
        {t('members.add')}
      </DialogTrigger>
      <DialogContent>
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('members.addTitle')}</DialogTitle>
            <DialogDescription>{t('members.addDescription')}</DialogDescription>
          </DialogHeader>
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
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      className="max-h-64 overflow-y-auto"
                    >
                      {items.map((candidate) => (
                        <FieldLabel key={candidate.id}>
                          <Field orientation="horizontal" invalid={fieldState.invalid}>
                            <RadioGroupItem value={candidate.id} />
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
                    errors={[
                      fieldState.error && { message: errorMessage(fieldState.error.message) },
                    ]}
                  />
                </FieldSet>
              )}
            />
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t('members.role')}</FieldLabel>
                  <Select
                    items={projectRoleSchema.options.map((value) => ({
                      value,
                      label: t(`roles.${value}`),
                    }))}
                    value={field.value}
                    onValueChange={(value) => field.onChange(projectRoleSchema.parse(value))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectRoleSchema.options.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`roles.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </FieldGroup>
          {form.formState.errors.root !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(form.formState.errors.root.message)}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t('members.cancel')}
            </DialogClose>
            <Button type="submit" disabled={userId === '' || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('members.adding') : t('members.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
