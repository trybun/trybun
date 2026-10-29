'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { type User, userKindSchema, userStateSchema } from '@trybun/contracts/users';
import { Badge } from '@trybun/ui/components/badge';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { usersQueryOptions } from '../queries.js';
import { type AccountsSearchParams, accountsHref } from '../search-params.js';
import { AccountActions } from './account-actions.js';

/** The value of the "all" choice of a filter; the filters are URL state (§18.5). */
const ALL = 'all';

/** The badges of an account: its state – unless active – and the Administrator role. */
function AccountBadges({ user }: { user: User }) {
  const t = useTranslations('users.accounts');
  return (
    <span className="flex flex-wrap gap-1">
      {user.state !== 'active' && (
        <Badge variant={user.state === 'deactivated' ? 'destructive' : 'secondary'}>
          {t(`states.${user.state}`)}
        </Badge>
      )}
      {user.isAdmin && <Badge variant="outline">{t('administrator')}</Badge>}
    </span>
  );
}

/**
 * The accounts of the Accounts page (§7.4): display name, e-mail address, kind, state and the
 * Administrator role, filtered by kind and state and searched by name and address. A table on
 * tablets and desktops, cards on phones (Rule 9); the actions of each account follow its
 * `allowedActions`.
 */
export function AccountList({ kind, state }: AccountsSearchParams) {
  const t = useTranslations('users.accounts');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const accounts = useInfiniteQuery(usersQueryOptions(browserApiClient, { kind, state, query }));
  const items = accounts.data?.pages.flatMap((page) => page.items) ?? [];
  const nameOf = (user: User) => user.displayName ?? user.email ?? t('noName');
  const filter = (next: AccountsSearchParams) => router.replace(accountsHref(next));

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('filters')} className="flex flex-col gap-3 md:flex-row">
        <Field className="md:flex-1">
          <FieldLabel>{t('search')}</FieldLabel>
          <Input
            type="search"
            value={search}
            placeholder={t('searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field className="md:w-44">
          <FieldLabel>{t('kind')}</FieldLabel>
          <Select
            value={kind ?? ALL}
            onValueChange={(value) => filter({ kind: userKindSchema.safeParse(value).data, state })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string) =>
                  value === ALL ? t('allKinds') : t(`kinds.${userKindSchema.parse(value)}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('allKinds')}</SelectItem>
              {userKindSchema.options.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`kinds.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="md:w-44">
          <FieldLabel>{t('state')}</FieldLabel>
          <Select
            value={state ?? ALL}
            onValueChange={(value) =>
              filter({ kind, state: userStateSchema.safeParse(value).data })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string) =>
                  value === ALL ? t('allStates') : t(`states.${userStateSchema.parse(value)}`)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('allStates')}</SelectItem>
              {userStateSchema.options.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`states.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {accounts.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(accounts.error)}
        </p>
      ) : accounts.isSuccess && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <ul aria-label={t('title')} className="flex flex-col gap-2 md:hidden">
            {items.map((user) => (
              <li
                key={user.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">{nameOf(user)}</span>
                  {user.displayName !== null && user.email !== null && (
                    <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                  )}
                  <span className="text-sm text-muted-foreground">{t(`kinds.${user.kind}`)}</span>
                  <AccountBadges user={user} />
                </div>
                <AccountActions user={user} name={nameOf(user)} />
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-sm md:table">
            <caption className="sr-only">{t('title')}</caption>
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('name')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('email')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('kind')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('state')}
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id} className="border-b border-border">
                  <th scope="row" className="max-w-48 truncate py-2 pr-3 text-left font-medium">
                    {user.displayName ?? t('noName')}
                  </th>
                  <td className="max-w-64 truncate py-2 pr-3">{user.email ?? t('noEmail')}</td>
                  <td className="py-2 pr-3">{t(`kinds.${user.kind}`)}</td>
                  <td className="py-2 pr-3">
                    <span className="flex flex-wrap items-center gap-1">
                      {user.state === 'active' && t('states.active')}
                      <AccountBadges user={user} />
                    </span>
                  </td>
                  <td className="py-1 text-right">
                    <AccountActions user={user} name={nameOf(user)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {accounts.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={accounts.isFetchingNextPage}
          onClick={() => void accounts.fetchNextPage()}
        >
          {accounts.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </Button>
      )}
    </div>
  );
}
