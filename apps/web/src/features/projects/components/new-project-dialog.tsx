'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CreateProjectDto, createProjectSchema } from '@trybun/contracts/projects';
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
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { normalizeKeyInput, suggestKey } from '../key-suggestion.js';
import { useCreateProject } from '../mutations.js';
import { projectSettingsHref } from '../search-params.js';

/**
 * Creating a project (§3.1): a dialog – a bottom sheet on phones – with the name and the key,
 * which is suggested from the name until the person edits it (Rule 2). After creation the project
 * settings open on the Members tab, because adding people is the next step.
 */
export function NewProjectDialog() {
  const t = useTranslations('projects.create');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const createProject = useCreateProject();
  const [isOpen, setIsOpen] = useState(false);
  const [isKeyEdited, setIsKeyEdited] = useState(false);
  const form = useForm<CreateProjectDto>({
    resolver: zodResolver(createProjectSchema, FORM_ERROR_MAP),
    defaultValues: { name: '', key: '' },
  });

  const submit = form.handleSubmit((input) =>
    createProject
      .mutateAsync(input)
      .then((project) => {
        router.push(projectSettingsHref(project.id, 'members'));
      })
      .catch((error: unknown) => {
        // The messages of the form hold error codes, translated where they are shown.
        const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
        for (const { field, code } of fieldErrors) {
          form.setError(field as keyof CreateProjectDto, { message: code });
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
          setIsKeyEdited(false);
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
                  <Input
                    {...field}
                    autoComplete="off"
                    onChange={(event) => {
                      field.onChange(event);
                      if (!isKeyEdited) {
                        form.setValue('key', suggestKey(event.target.value));
                      }
                    }}
                  />
                  <FieldError
                    errors={[
                      fieldState.error && { message: errorMessage(fieldState.error.message) },
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
                  <FieldLabel>{t('key')}</FieldLabel>
                  <Input
                    {...field}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={10}
                    className="font-mono"
                    onChange={(event) => {
                      setIsKeyEdited(true);
                      field.onChange(normalizeKeyInput(event.target.value));
                    }}
                  />
                  <FieldDescription>{t('keyDescription')}</FieldDescription>
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
