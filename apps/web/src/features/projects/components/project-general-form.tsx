'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProjectSchema,
  type Project,
  type UpdateProjectDto,
} from '@trybun/contracts/projects';
import { Button } from '@trybun/ui/components/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { Switch } from '@trybun/ui/components/switch';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { normalizeKeyInput } from '../key-suggestion.js';
import { useUpdateProject } from '../mutations.js';

/** The fields of the General tab; only the changed ones are sent (§18.3). */
const generalSchema = createProjectSchema.extend({ confirmResolution: z.boolean() });
type GeneralValues = z.infer<typeof generalSchema>;

/**
 * The General tab of the project settings: name and key for the Administrator (`update`) and
 * resolution confirmation for Project managers and the Administrator (`update_settings`, §4.3).
 * Fields the person may not change are shown read-only, never hidden.
 */
export function ProjectGeneralForm({ project }: { project: Project }) {
  const t = useTranslations('projects');
  const errorMessage = useErrorMessage();
  const updateProject = useUpdateProject();
  const canUpdate = project.allowedActions.includes('update');
  const canUpdateSettings = project.allowedActions.includes('update_settings');
  const form = useForm<GeneralValues>({
    resolver: zodResolver(generalSchema, FORM_ERROR_MAP),
    defaultValues: {
      name: project.name,
      key: project.key,
      confirmResolution: project.confirmResolution,
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const input: UpdateProjectDto = {
      ...(canUpdate && values.name !== project.name ? { name: values.name } : {}),
      ...(canUpdate && values.key !== project.key ? { key: values.key } : {}),
      ...(canUpdateSettings && values.confirmResolution !== project.confirmResolution
        ? { confirmResolution: values.confirmResolution }
        : {}),
    };
    if (Object.keys(input).length === 0) {
      return;
    }
    try {
      await updateProject.mutateAsync({ project, input });
      toast.add({ title: t('general.saved'), type: 'success' });
    } catch (error) {
      // The messages of the form hold error codes, translated where they are shown.
      const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
      for (const { field, code } of fieldErrors) {
        form.setError(field as keyof GeneralValues, { message: code });
      }
      if (fieldErrors.length === 0) {
        form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
      }
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('create.name')}</FieldLabel>
              <Input {...field} readOnly={!canUpdate} autoComplete="off" />
              <FieldError
                errors={[
                  fieldState.error && {
                    message: errorMessage(fieldState.error.message, {
                      'string.empty': t('create.nameRequired'),
                    }),
                  },
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="key"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('create.key')}</FieldLabel>
              <Input
                {...field}
                readOnly={!canUpdate}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={10}
                className="font-mono"
                onChange={(event) => field.onChange(normalizeKeyInput(event.target.value))}
              />
              {(canUpdate || project.state === 'active') && (
                <FieldDescription>
                  {canUpdate ? t('create.keyDescription') : t('general.readOnly')}
                </FieldDescription>
              )}
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="confirmResolution"
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel>{t('general.confirmResolution')}</FieldLabel>
                <FieldDescription>{t('general.confirmResolutionDescription')}</FieldDescription>
              </FieldContent>
              <Switch
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
                disabled={!canUpdateSettings}
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
      {(canUpdate || canUpdateSettings) && (
        <Button type="submit" className="w-full md:w-fit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('general.saving') : t('general.save')}
        </Button>
      )}
    </form>
  );
}
