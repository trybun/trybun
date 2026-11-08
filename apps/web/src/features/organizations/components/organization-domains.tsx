'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ORGANIZATION_MAX_DOMAINS,
  type Organization,
  organizationDomainInputSchema,
} from '@trybun/contracts/organizations';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { toast } from '@trybun/ui/components/toast';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { useUpdateOrganization } from '../mutations.js';
import { OrganizationSection } from './organization-section.js';

const addDomainSchema = z.object({ domain: organizationDomainInputSchema });
type AddDomainValues = z.infer<typeof addDomainSchema>;

/**
 * The e-mail domains of an organization (§7.3): each with Remove, and a field to add one, both
 * with `update`. The whole set is sent; the error of the new domain – e.g. `gmail.com` – is shown
 * at the field.
 */
export function OrganizationDomains({ organization }: { organization: Organization }) {
  const t = useTranslations('organizations.domains');
  const errorMessage = useErrorMessage();
  const updateOrganization = useUpdateOrganization();
  const canUpdate = organization.allowedActions.includes('update');
  const form = useForm<AddDomainValues>({
    resolver: zodResolver(addDomainSchema, FORM_ERROR_MAP),
    defaultValues: { domain: '' },
  });
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });

  const submit = form.handleSubmit(async ({ domain }) => {
    try {
      await updateOrganization.mutateAsync({
        organization,
        input: { domains: [...organization.domains, domain] },
      });
      toast.add({ title: t('added', { domain }), type: 'success' });
      form.reset();
    } catch (error) {
      // The messages of the form hold error codes, translated where they are shown.
      const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
      for (const { code } of fieldErrors) {
        form.setError('domain', { message: code });
      }
      if (fieldErrors.length === 0) {
        form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
      }
    }
  });

  const remove = (domain: string) =>
    updateOrganization.mutate(
      {
        organization,
        input: { domains: organization.domains.filter((value) => value !== domain) },
      },
      {
        onSuccess: () => toast.add({ title: t('removed', { domain }), type: 'success' }),
        onError: showError,
      },
    );

  return (
    <OrganizationSection
      id="organization-domains-title"
      title={t('title')}
      description={t('description')}
      tourTarget="organization-detail-domains"
    >
      {organization.domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {organization.domains.map((domain) => (
            <li
              key={domain}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 text-card-foreground"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{domain}</span>
              {canUpdate && (
                <Button
                  variant="outline"
                  aria-label={t('removeOf', { domain })}
                  disabled={updateOrganization.isPending}
                  onClick={() => remove(domain)}
                >
                  {t('remove')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpdate && organization.domains.length < ORGANIZATION_MAX_DOMAINS && (
        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-3 md:flex-row md:items-start"
        >
          <Controller
            control={form.control}
            name="domain"
            render={({ field, fieldState }) => (
              <Field invalid={fieldState.invalid} className="md:flex-1">
                <FieldLabel>{t('domain')}</FieldLabel>
                <Input
                  {...field}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="url"
                />
                <FieldError
                  errors={[
                    fieldState.error && {
                      message: errorMessage(fieldState.error.message, {
                        'string.empty': t('domainRequired'),
                      }),
                    },
                  ]}
                />
              </Field>
            )}
          />
          <Button
            type="submit"
            className="w-full md:mt-6 md:w-fit"
            disabled={form.formState.isSubmitting}
          >
            <PlusIcon aria-hidden />
            {form.formState.isSubmitting ? t('adding') : t('add')}
          </Button>
          {form.formState.errors.root !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(form.formState.errors.root.message)}
            </p>
          )}
        </form>
      )}
    </OrganizationSection>
  );
}
