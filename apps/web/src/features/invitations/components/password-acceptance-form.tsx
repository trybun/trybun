'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { acceptInvitationSchema } from '@trybun/contracts/invitations';
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
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { signInWithKeycloak, signOutInPlace } from '../../sessions/keycloak-sign-in.js';
import { browserTimeZone } from '../acceptance-state.js';
import { useAcceptInvitation } from '../mutations.js';

/** The password form of the acceptance (ADR 0009): names and password of the new account. */
const passwordAcceptanceSchema = acceptInvitationSchema.options[0].pick({
  firstName: true,
  lastName: true,
  password: true,
});
type PasswordAcceptanceDto = z.input<typeof passwordAcceptanceSchema>;

type TextField = 'firstName' | 'lastName';

/**
 * An end user accepts with a password (ADR 0009, AQ1): the API creates the Keycloak user with the
 * invited address, the language of the page and the browser's time zone; then the sign-in starts
 * with the address pre-filled and returns to the landing path. A password Keycloak's policy
 * refuses is shown at its field.
 */
export function PasswordAcceptanceForm({
  token,
  email,
  language,
  onTokenRejected,
}: {
  token: string;
  email: string;
  language: Language;
  /** The link was used, revoked or expired meanwhile: the page shows its message instead. */
  onTokenRejected: () => void;
}) {
  const t = useTranslations('invitations.acceptance');
  const errorMessage = useErrorMessage();
  const accept = useAcceptInvitation();
  const form = useForm<PasswordAcceptanceDto>({
    resolver: zodResolver(passwordAcceptanceSchema, FORM_ERROR_MAP),
    defaultValues: { firstName: '', lastName: '', password: '' },
  });

  const submit = form.handleSubmit((input) =>
    accept
      .mutateAsync({ method: 'password', token, language, timeZone: browserTimeZone(), ...input })
      .then(async ({ landingPath }) => {
        // A session of another person in this browser would answer the sign-in.
        await signOutInPlace();
        await signInWithKeycloak(landingPath, { locale: language, loginHint: email });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'invitation.token_invalid') {
          onTokenRejected();
          return;
        }
        // The messages of the form hold error codes, translated where they are shown.
        const fieldErrors = (error instanceof ApiError ? fieldErrorsOf(error) : []).filter(
          ({ field }) => ['firstName', 'lastName', 'password'].includes(field),
        );
        for (const { field, code } of fieldErrors) {
          form.setError(field as keyof PasswordAcceptanceDto, { message: code });
        }
        if (fieldErrors.length === 0) {
          form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
        }
      }),
  );

  const textField = (name: TextField, autoComplete: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field invalid={fieldState.invalid}>
          <FieldLabel>{t(name)}</FieldLabel>
          <Input {...field} autoComplete={autoComplete} />
          <FieldError
            errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
          />
        </Field>
      )}
    />
  );

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{t('passwordTitle')}</h2>
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          {textField('firstName', 'given-name')}
          {textField('lastName', 'family-name')}
        </div>
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
      </FieldGroup>
      {form.formState.errors.root !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(form.formState.errors.root.message)}
        </p>
      )}
      <Button
        type="submit"
        className="w-full md:w-fit"
        disabled={form.formState.isSubmitting || accept.isSuccess}
      >
        {form.formState.isSubmitting || accept.isSuccess ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
