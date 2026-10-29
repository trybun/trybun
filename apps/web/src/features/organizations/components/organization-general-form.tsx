'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Organization, organizationNameSchema } from '@trybun/contracts/organizations';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { useUpdateOrganization } from '../mutations.js';

const generalSchema = z.object({ name: organizationNameSchema });
type GeneralValues = z.infer<typeof generalSchema>;

/** The name of an organization, changed with `update`, read-only otherwise (e.g. archived). */
export function OrganizationGeneralForm({ organization }: { organization: Organization }) {
  const t = useTranslations('organizations.general');
  const errorMessage = useErrorMessage();
  const updateOrganization = useUpdateOrganization();
  const canUpdate = organization.allowedActions.includes('update');
  const form = useForm<GeneralValues>({
    resolver: zodResolver(generalSchema, FORM_ERROR_MAP),
    defaultValues: { name: organization.name },
  });

  const submit = form.handleSubmit(async ({ name }) => {
    if (name === organization.name) {
      return;
    }
    try {
      await updateOrganization.mutateAsync({ organization, input: { name } });
      toast.add({ title: t('saved'), type: 'success' });
    } catch (error) {
      // The messages of the form hold error codes, translated where they are shown.
      const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
      for (const { code } of fieldErrors) {
        form.setError('name', { message: code });
      }
      if (fieldErrors.length === 0) {
        form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
      }
    }
  });

  return (
    <form
      noValidate
      aria-label={t('title')}
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3 md:flex-row md:items-start"
    >
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid} className="md:flex-1">
            <FieldLabel>{t('name')}</FieldLabel>
            <Input {...field} readOnly={!canUpdate} autoComplete="organization" />
            <FieldError
              errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
            />
          </Field>
        )}
      />
      {canUpdate && (
        <Button
          type="submit"
          variant="outline"
          className="w-full md:mt-6 md:w-fit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? t('saving') : t('save')}
        </Button>
      )}
      {form.formState.errors.root !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(form.formState.errors.root.message)}
        </p>
      )}
    </form>
  );
}
