'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { LOCALES } from '@trybun/i18n/catalogues';
import { type Language, languageSchema, timeZoneSchema } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@trybun/ui/components/combobox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@trybun/ui/components/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { toast } from '@trybun/ui/components/toast';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useSyncExternalStore, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { changeLanguage } from '../../../lib/i18n/change-language.js';
import { changeTimeZone } from '../../../lib/i18n/change-time-zone.js';
import { useUpdateCurrentUser } from '../mutations.js';
import { currentUserQueryOptions } from '../queries.js';

const settingsSchema = z.object({
  language: languageSchema,
  timeZone: timeZoneSchema.nullable(),
});
type SettingsValues = z.infer<typeof settingsSchema>;

/** The IANA time zones of the browser, with `UTC`, which some runtimes leave out. */
function timeZonesOfRuntime(): string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes('UTC') ? zones : [...zones, 'UTC'].sort();
}

/** The time zone of the device does not change while the page is open. */
function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * The time zone of this device; `null` while rendering on the server, whose time zone is not the
 * device's, so the page hydrates without a mismatch.
 */
function useDeviceTimeZone(): string | null {
  return useSyncExternalStore(
    subscribeToNothing,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/**
 * The Account settings form (§13.1): the language and a searchable list of IANA time zones with
 * "Use this device's time zone". Saving writes the account and, for a new language, switches the
 * language of the web application, so the page renders in it at once (§18.5).
 */
export function AccountSettingsForm({ systemTimeZone }: { systemTimeZone: string }) {
  const t = useTranslations('users.settings');
  const tLanguages = useTranslations('languages');
  const errorMessage = useErrorMessage();
  const locale = useLocale();
  const { data: user } = useQuery(currentUserQueryOptions(browserApiClient));
  const updateCurrentUser = useUpdateCurrentUser();
  const [, startTransition] = useTransition();
  // The list renders only in the open popup, so the server's list never reaches the HTML.
  const [timeZones] = useState(timeZonesOfRuntime);
  const deviceTimeZone = useDeviceTimeZone();
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema, FORM_ERROR_MAP),
    defaultValues: {
      language: user?.language ?? languageSchema.parse(locale),
      timeZone: user?.timeZone ?? null,
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const previousTimeZone = user?.timeZone ?? null;
    try {
      await updateCurrentUser.mutateAsync(values);
      toast.add({ title: t('saved'), type: 'success' });
      if (values.language !== locale) {
        startTransition(() => changeLanguage(values.language));
      }
      if (values.timeZone !== previousTimeZone) {
        startTransition(() => changeTimeZone(values.timeZone));
      }
    } catch (error) {
      // The messages of the form hold error codes, translated where they are shown.
      const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
      for (const { field, code } of fieldErrors) {
        if (field === 'language' || field === 'timeZone') {
          form.setError(field, { message: code });
        }
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
      className="flex max-w-md flex-col gap-6"
    >
      <Controller
        control={form.control}
        name="language"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <FieldLabel>{t('language')}</FieldLabel>
            <Select
              value={field.value}
              onValueChange={(value) => field.onChange(languageSchema.parse(value))}
            >
              <SelectTrigger className="w-full" onBlur={field.onBlur}>
                <SelectValue>{(value: Language) => tLanguages(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((language) => (
                  <SelectItem key={language} value={language} lang={language}>
                    {tLanguages(language)}
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
      <Controller
        control={form.control}
        name="timeZone"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <FieldLabel>{t('timeZone')}</FieldLabel>
            <Combobox
              items={timeZones}
              value={field.value}
              onValueChange={(value: string | null) => field.onChange(value)}
            >
              <ComboboxInput
                placeholder={t('timeZonePlaceholder', { timeZone: systemTimeZone })}
                onBlur={field.onBlur}
              />
              <ComboboxContent>
                <ComboboxEmpty>{t('noTimeZone')}</ComboboxEmpty>
                <ComboboxList aria-label={t('timeZones')}>
                  {(timeZone: string) => (
                    <ComboboxItem key={timeZone} value={timeZone}>
                      {timeZone}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <FieldDescription>{t('timeZoneDescription')}</FieldDescription>
            <FieldError
              errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
            />
            {deviceTimeZone !== null && field.value !== deviceTimeZone && (
              <Button
                type="button"
                variant="outline"
                className="w-full md:w-fit"
                onClick={() => field.onChange(deviceTimeZone)}
              >
                {t('useDeviceTimeZone', { timeZone: deviceTimeZone })}
              </Button>
            )}
          </Field>
        )}
      />
      <Button type="submit" className="w-full md:w-fit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t('saving') : t('save')}
      </Button>
      {form.formState.errors.root !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(form.formState.errors.root.message)}
        </p>
      )}
    </form>
  );
}
