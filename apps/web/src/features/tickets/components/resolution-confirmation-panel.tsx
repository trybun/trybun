'use client';

import type { ResolutionAnswer } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useConfirmResolution } from '../mutations.js';

/**
 * "Is your problem solved?" (§4.3, §4.4): the requester's two answers, each one press, full width
 * on phones. A late answer – the team or the timer answered first – shows the `409` message, and
 * the ticket is read again.
 */
export function ResolutionConfirmationPanel({ ticketId }: { ticketId: string }) {
  const t = useTranslations('tickets.resolutionConfirmation');
  const tPortal = useTranslations('portal.ticket');
  const errorMessage = useErrorMessage();
  const confirmResolution = useConfirmResolution();
  function answer(value: ResolutionAnswer) {
    confirmResolution.mutate(
      { ticketId, answer: value },
      {
        onSuccess: () => toast.add({ title: tPortal(`answered.${value}`), type: 'success' }),
        onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
      },
    );
  }
  return (
    <section
      aria-labelledby="resolution-question"
      className="flex flex-col gap-3 rounded-lg border-l-4 border-warning bg-card p-4"
    >
      <h2 id="resolution-question" className="text-lg font-semibold">
        {t('question')}
      </h2>
      <div className="flex flex-col gap-3 md:flex-row">
        <Button
          className="w-full md:w-fit"
          disabled={confirmResolution.isPending}
          onClick={() => answer('solved')}
        >
          {t('answers.solved')}
        </Button>
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={confirmResolution.isPending}
          onClick={() => answer('not_solved')}
        >
          {t('answers.not_solved')}
        </Button>
      </div>
    </section>
  );
}
