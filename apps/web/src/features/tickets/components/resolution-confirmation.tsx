'use client';

import { useQuery } from '@tanstack/react-query';
import type { ResolutionAnswer } from '@trybun/contracts/tickets';
import { Button, buttonVariants } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { portalTicketHref, resolutionConfirmationHref } from '../../portal/hrefs.js';
import { useConfirmResolution } from '../mutations.js';
import { ticketQueryOptions } from '../queries.js';

/**
 * The confirmation page that the signed links of the e-mail open (§4.3, Q14): the question with the
 * chosen answer as one large button and the other answer as a link. Opening the page changes
 * nothing – only the press sends the answer – so link scanners of mail systems cannot answer. After
 * the answer, or when the ticket no longer waits for it, the page says so and links to the ticket.
 */
export function ResolutionConfirmation({
  identifier,
  answer,
}: {
  identifier: string;
  answer: ResolutionAnswer;
}) {
  const t = useTranslations('portal.confirmation');
  const tTicket = useTranslations('portal.ticket');
  const tQuestion = useTranslations('tickets.resolutionConfirmation');
  const errorMessage = useErrorMessage();
  const ticket = useQuery(ticketQueryOptions(browserApiClient, identifier));
  const confirmResolution = useConfirmResolution();
  if (ticket.data === undefined) {
    return null;
  }
  const isPending = ticket.data.allowedActions.includes('confirm_resolution');
  const other: ResolutionAnswer = answer === 'solved' ? 'not_solved' : 'solved';
  // The outcome of the press decides the message; the ticket read again after it no longer waits.
  const message = confirmResolution.isSuccess
    ? tTicket(`answered.${answer}`)
    : confirmResolution.isError
      ? confirmResolution.error instanceof ApiError && confirmResolution.error.status === 409
        ? t('notPending')
        : errorMessage(confirmResolution.error)
      : isPending || confirmResolution.isPending
        ? undefined
        : t('notPending');
  return (
    <div className="flex max-w-prose flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-sm text-muted-foreground">{ticket.data.identifier}</p>
        <h1 className="text-2xl font-bold break-words">{ticket.data.title}</h1>
      </div>
      {message === undefined ? (
        <section aria-labelledby="confirmation-question" className="flex flex-col gap-4">
          <h2 id="confirmation-question" className="text-lg font-semibold">
            {tQuestion('question')}
          </h2>
          <Button
            size="lg"
            className="w-full md:w-fit"
            disabled={confirmResolution.isPending}
            onClick={() => confirmResolution.mutate({ ticketId: ticket.data.id, answer })}
          >
            {tQuestion(`answers.${answer}`)}
          </Button>
          <Link
            href={resolutionConfirmationHref(identifier, other)}
            replace
            className="flex min-h-11 w-fit items-center text-sm font-medium text-link underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-0"
          >
            {t('other', { answer: tQuestion(`answers.${other}`) })}
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          <p role="status">{message}</p>
          <Link
            href={portalTicketHref(identifier)}
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full md:w-fit')}
          >
            {t('openTicket')}
          </Link>
        </div>
      )}
    </div>
  );
}
