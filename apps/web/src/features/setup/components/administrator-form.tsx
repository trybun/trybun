'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateAdministratorDto,
  createAdministratorSchema,
  type Setup,
} from '@trybun/contracts/setup';
import { type Language, PASSWORD_MIN_LENGTH } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { PasswordInput } from '@trybun/ui/components/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { useCreateAdministrator } from '../mutations.js';
import { timeZones } from '../setup-link.js';
import { SetupMessage } from './setup-message.js';

const LANGUAGES: readonly Language[] = ['en', 'pl'];

type TextField = 'firstName' | 'lastName' | 'email';

/**
 * The one step of the first-run wizard (§15.6): the first Administrator with their own language
 * and time zone, prefilled with the system defaults of `.env`, which the form shows read-only.
 */
export function AdministratorForm({
  token,
  setup,
  onTokenRejected,
}: {
  token: string;
  setup: Setup;
  /** The token was used or expired meanwhile: the wizard shows its message instead. */
  onTokenRejected: () => void;
}) {
  const t = useTranslations('setup');
  const tLanguages = useTranslations('languages');
  const errorMessage = useErrorMessage();
  const createAdministrator = useCreateAdministrator();
  const form = useForm<CreateAdministratorDto>({
    resolver: zodResolver(createAdministratorSchema, FORM_ERROR_MAP),
    defaultValues: {
      token,
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      language: setup.defaultLanguage,
      timeZone: setup.defaultTimeZone,
    },
  });
  const zones = timeZones();

  if (createAdministrator.isSuccess) {
    return (
      <SetupMessage title={t('doneTitle')} signIn>
        {t('doneText')}
      </SetupMessage>
    );
  }

  const submit = form.handleSubmit((input) =>
    createAdministrator.mutateAsync(input).catch((error: unknown) => {
      if (
        error instanceof ApiError &&
        ['setup.token_invalid', 'setup.completed'].includes(error.code)
      ) {
        onTokenRejected();
        return;
      }
      // The messages of the form hold error codes, translated where they are shown.
      const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
      for (const { field, code } of fieldErrors) {
        form.setError(field as keyof CreateAdministratorDto, { message: code });
      }
      if (fieldErrors.length === 0) {
        form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
      }
    }),
  );

  const textField = (name: TextField, autoComplete: string, type = 'text') => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field invalid={fieldState.invalid}>
          <FieldLabel>{t(name)}</FieldLabel>
          <Input {...field} type={type} autoComplete={autoComplete} />
          <FieldError
            errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
          />
        </Field>
      )}
    />
  );

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      <p className="text-muted-foreground">{t('intro')}</p>
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          {textField('firstName', 'given-name')}
          {textField('lastName', 'family-name')}
        </div>
        {textField('email', 'email', 'email')}
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('password')}</FieldLabel>
              <PasswordInput {...field} autoComplete="new-password" />
              <FieldDescription>
                {t('passwordDescription', { min: PASSWORD_MIN_LENGTH })}
              </FieldDescription>
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="language"
            render={({ field }) => (
              <Field>
                <FieldLabel>{t('language')}</FieldLabel>
                <Select
                  items={LANGUAGES.map((language) => ({
                    value: language,
                    label: tLanguages(language),
                  }))}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((language) => (
                      <SelectItem key={language} value={language} lang={language}>
                        {tLanguages(language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="timeZone"
            render={({ field }) => (
              <Field>
                <FieldLabel>{t('timeZone')}</FieldLabel>
                <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {t.rich('systemDefaults', {
            language: tLanguages(setup.defaultLanguage),
            timeZone: setup.defaultTimeZone,
            file: (chunks) => <code className="font-mono text-foreground">{chunks}</code>,
            command: (chunks) => <code className="font-mono text-foreground">{chunks}</code>,
          })}
        </p>
      </FieldGroup>
      {form.formState.errors.root !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(form.formState.errors.root.message)}
        </p>
      )}
      <Button type="submit" className="w-full md:w-fit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
