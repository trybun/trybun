'use client';

import { useQuery } from '@tanstack/react-query';
import { type ProjectRole, projectRoleSchema } from '@trybun/contracts/projects';
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
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { toast } from '@trybun/ui/components/toast';
import { cn } from '@trybun/ui/lib/utils';
import { UserPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
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
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<ProjectRole>('developer');
  const deferredSearch = useDeferredValue(search.trim());
  const candidates = useQuery({
    ...memberCandidatesQueryOptions(browserApiClient, projectId, deferredSearch),
    enabled: isOpen,
  });
  const items = candidates.data?.items ?? [];
  const chosen = items.find((candidate) => candidate.id === userId);

  const close = () => {
    setIsOpen(false);
    setSearch('');
    setUserId(null);
    setRole('developer');
  };

  const submit = () => {
    if (chosen === undefined) {
      return;
    }
    addMember.mutate(
      { userId: chosen.id, role },
      {
        onSuccess: () => {
          toast.add({
            title: t('members.added', { name: chosen.displayName ?? chosen.githubLogin ?? '' }),
            type: 'success',
          });
          close();
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
      <DialogTrigger render={<Button className="w-full md:w-fit" />}>
        <UserPlusIcon aria-hidden />
        {t('members.add')}
      </DialogTrigger>
      <DialogContent>
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
          <FieldSet>
            <FieldLegend variant="label">{t('members.candidates')}</FieldLegend>
            {candidates.isSuccess && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('members.noCandidates')}</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {items.map((candidate) => (
                  <li key={candidate.id}>
                    <label
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring',
                      )}
                    >
                      <input
                        type="radio"
                        name="member-candidate"
                        className="size-4 accent-primary"
                        checked={candidate.id === userId}
                        onChange={() => setUserId(candidate.id)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {candidate.displayName ?? t('members.noName')}
                        </span>
                        {candidate.githubLogin !== null && (
                          <span className="truncate text-sm text-muted-foreground">
                            @{candidate.githubLogin}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </FieldSet>
          <Field>
            <FieldLabel>{t('members.role')}</FieldLabel>
            <Select
              items={projectRoleSchema.options.map((value) => ({
                value,
                label: t(`roles.${value}`),
              }))}
              value={role}
              onValueChange={(value) => setRole(projectRoleSchema.parse(value))}
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
        </FieldGroup>
        {addMember.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(addMember.error)}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('members.cancel')}</DialogClose>
          <Button disabled={chosen === undefined || addMember.isPending} onClick={submit}>
            {addMember.isPending ? t('members.adding') : t('members.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
