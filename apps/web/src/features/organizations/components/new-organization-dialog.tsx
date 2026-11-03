'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { organizationNameSchema } from '@trybun/contracts/organizations';
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { splitDomains } from '../domains.js';
import { useCreateOrganization } from '../mutations.js';
import { organizationHref } from '../search-params.js';

/** The fields of the dialog: the domains as one text, separated by commas (Rule 2). */
const newOrganizationSchema = z.object({ name: organizationNameSchema, domains: z.string() });
type NewOrganizationValues = z.infer<typeof newOrganizationSchema>;

/**
 * Creating an organization (§7.3): a dialog – a bottom sheet on phones – with the name and the
 * optional e-mail domains. After creation the organization opens, because its projects and
 * members are the next steps.
 */
export function NewOrganizationDialog() {
  const t = useTranslations('organizations.create');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const createOrganization = useCreateOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<NewOrganizationValues>({
    resolver: zodResolver(newOrganizationSchema, FORM_ERROR_MAP),
    defaultValues: { name: '', domains: '' },
  });

  const submit = form.handleSubmit(({ name, domains }) =>
    createOrganization
      .mutateAsync({ name, domains: splitDomains(domains) })
      .then((organization) => {
        router.push(organizationHref(organization.id));
      })
      .catch((error: unknown) => {
        // The messages of the form hold error codes, translated where they are shown. An error of
        // one domain (`/domains/1`) is shown at the field of all domains.
        const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
        for (const { field, code } of fieldErrors) {
          form.setError(field.startsWith('domains') ? 'domains' : 'name', { message: code });
        }
        if (fieldErrors.length === 0) {
          form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
        }
      }),
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          form.reset();
        }
      }}
    >
      <DialogTrigger render={<Button className="w-full md:w-fit" />}>
        <PlusIcon aria-hidden />
        {t('open')}
      </DialogTrigger>
      <DialogContent>
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field invalid={fieldState.invalid}>
                  <FieldLabel>{t('name')}</FieldLabel>
                  <Input {...field} autoComplete="organization" />
                  <FieldError
                    errors={[
                      fieldState.error && {
                        message: errorMessage(fieldState.error.message, {
                          'string.empty': t('nameRequired'),
                        }),
                      },
                    ]}
                  />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="domains"
              render={({ field, fieldState }) => (
                <Field invalid={fieldState.invalid}>
                  <FieldLabel>{t('domains')}</FieldLabel>
                  <Input
                    {...field}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="url"
                  />
                  <FieldDescription>{t('domainsDescription')}</FieldDescription>
                  <FieldError
                    errors={[
                      fieldState.error && { message: errorMessage(fieldState.error.message) },
                    ]}
                  />
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
              {t('cancel')}
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
