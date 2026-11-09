import { Injectable } from '@nestjs/common';
import {
  type BulkChangeFailureStatus,
  bulkChangeFailureStatusSchema,
  type BulkChangeResult,
  type BulkChangeTarget,
  type BulkChangeTicketsDto,
  type BulkChangeTicketsResponse,
  type BulkTicketChange,
  type TicketResponse,
} from '@trybun/contracts/tickets';
import type { ErrorCode } from '@trybun/contracts/errors';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { RecordAccess } from '../../platform/authorization/record-access.js';
import { AppError } from '../../platform/errors/app-error.js';
import { TICKET } from './tickets.abilities.js';
import { TicketsService } from './tickets.service.js';

/** The ticket action a single change of the field checks in its target record guard (§18.3). */
function actionOf(change: BulkTicketChange): 'change_status' | 'update' {
  return change.field === 'status' ? 'change_status' : 'update';
}

function failure(id: string, status: BulkChangeFailureStatus, code: ErrorCode): BulkChangeResult {
  return { id, status, code };
}

/**
 * Bulk changes of the ticket list (§8.1, §17.2, S1-13 Q1–Q3): one change for up to 100 tickets,
 * in request order, each ticket in its own transaction through the same use case as its single
 * change – with the same checks in the same order (§17.2 "Errors") and the same activity, outbox
 * events and comments. A ticket that is not changed reports the status and the code its single
 * change would have answered; an unexpected error of one ticket is logged and reported as `500`,
 * and the others are still processed.
 */
@Injectable()
export class TicketBulkChangesService {
  constructor(
    private readonly records: RecordAccess,
    private readonly tickets: TicketsService,
    @InjectPinoLogger(TicketBulkChangesService.name) private readonly logger: PinoLogger,
  ) {}

  async change(
    principal: UserPrincipal,
    input: BulkChangeTicketsDto,
  ): Promise<BulkChangeTicketsResponse> {
    const results: BulkChangeResult[] = [];
    for (const target of input.tickets) {
      results.push(await this.changeOne(principal, target, input.change));
    }
    // Only counts: never a ticket's content or identifier (§17.2).
    const totals: Record<number, number> = {};
    for (const result of results) {
      totals[result.status] = (totals[result.status] ?? 0) + 1;
    }
    this.logger.info(
      { field: input.change.field, count: results.length, totals },
      'Bulk change of tickets',
    );
    return { results };
  }

  private async changeOne(
    principal: UserPrincipal,
    target: BulkChangeTarget,
    change: BulkTicketChange,
  ): Promise<BulkChangeResult> {
    // The target record guard of the single change: `404` before `403` or a state rule (§17.2).
    const decision = await this.records.decide(principal, {
      subject: TICKET,
      id: target.id,
      action: actionOf(change),
    });
    if (decision.outcome === 'not_found') {
      return failure(target.id, 404, 'request.not_found');
    }
    if (decision.outcome === 'denied') {
      return this.failureOf(target.id, new AppError(decision.code));
    }
    try {
      return {
        id: target.id,
        status: 200,
        ticket: withoutDescription(await this.apply(principal, target, change)),
      };
    } catch (error) {
      return this.failureOf(target.id, error);
    }
  }

  private apply(
    principal: UserPrincipal,
    target: BulkChangeTarget,
    change: BulkTicketChange,
  ): Promise<TicketResponse> {
    switch (change.field) {
      case 'status':
        return this.tickets.changeStatus(
          principal,
          target,
          change.status === 'rejected'
            ? { status: 'rejected', rejectionReason: change.rejectionReason ?? '' }
            : { status: change.status },
        );
      case 'priority':
        return this.tickets.update(principal, target, { priority: change.priority });
      case 'assignee':
        return this.tickets.update(principal, target, { assigneeId: change.assigneeId });
    }
  }

  /** The result of an expected error of a ticket; any other error is the ticket's `500`. */
  private failureOf(id: string, error: unknown): BulkChangeResult {
    if (error instanceof AppError) {
      const status = bulkChangeFailureStatusSchema.safeParse(error.status);
      if (status.success) {
        return failure(id, status.data, error.code);
      }
    }
    this.logger.error({ err: error }, 'Unexpected error of one ticket of a bulk change');
    return failure(id, 500, 'server.internal_error');
  }
}

/** A changed ticket as the list shows it (S1-13 Q10): without the description. */
function withoutDescription(
  ticket: TicketResponse,
): Extract<BulkChangeResult, { status: 200 }>['ticket'] {
  const { description, ...item } = ticket;
  void description;
  return item;
}
