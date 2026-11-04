import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { ActivityEventsService } from '../activity-events/activity-events.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { UsersService } from '../users/users.service.js';
import { unassignOpenTickets } from './tickets.sql.js';

/** The tickets unassigned in one transaction. */
const BATCH_SIZE = 100;

/**
 * Whether the reason of the unassignment still holds, decided in a batch's transaction after the
 * share lock of the account or the membership (§18.3).
 */
type ReasonHolds = (tx: Transaction) => Promise<boolean>;

/**
 * Unassigns the open tickets of a team member who was deactivated or lost their role in a project
 * (§7.4), the Worker's side of both changes, with an automatic event of the system for each
 * ticket. It acts as the system and re-checks the reason in every batch under the share lock of
 * the account or the membership – as the assignment takes it – so a person reactivated or re-added
 * meanwhile keeps their tickets from the next batch on, a concurrent change waits for the batch,
 * and a repeated delivery finds nothing left. Tickets of archived projects are unassigned too: a
 * consequence of the Administrator's change, not a change of a person (§7.3).
 */
@Injectable()
export class TicketUnassignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEvents: ActivityEventsService,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
    @InjectPinoLogger(TicketUnassignmentService.name) private readonly logger: PinoLogger,
  ) {}

  /** The open tickets of a deactivated account, in every project. */
  unassignDeactivatedUser(userId: string): Promise<void> {
    return this.unassign(userId, null, async (tx) => {
      if (!(await this.users.lockForShare(tx, userId))) {
        return false;
      }
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { state: true },
      });
      return user.state !== 'active' && user.state !== 'invited';
    });
  }

  /** The open tickets of a person in a project they no longer have a team role in. */
  unassignRemovedMember(projectId: string, userId: string): Promise<void> {
    return this.unassign(userId, projectId, async (tx) => {
      if (!(await this.projects.lockMemberForShare(tx, projectId, userId))) {
        return true;
      }
      const membership = await tx.projectMember.count({
        where: { projectId, userId, role: { in: teamRolesFrom('developer') } },
      });
      return membership === 0;
    });
  }

  /**
   * Batches of one transaction each, until no open ticket of the person is left or the reason no
   * longer holds.
   */
  private async unassign(
    userId: string,
    projectId: string | null,
    reasonHolds: ReasonHolds,
  ): Promise<void> {
    let total = 0;
    for (;;) {
      const count = await this.prisma.$transaction(async (tx) => {
        if (!(await reasonHolds(tx))) {
          return 0;
        }
        const person = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, displayName: true },
        });
        const tickets = await unassignOpenTickets(tx, userId, projectId, BATCH_SIZE);
        for (const ticket of tickets) {
          const fields = {
            title: ticket.title,
            description: ticket.description,
            type: ticket.type,
            priority: ticket.priority,
          };
          await this.activityEvents.recordChanges(
            tx,
            { automaticSource: 'system' },
            ticket.id,
            { ...fields, assignee: person },
            { ...fields, assignee: null },
          );
        }
        return tickets.length;
      });
      total += count;
      if (count === 0) {
        break;
      }
    }
    this.logger.info({ userId, projectId, count: total }, 'Open tickets unassigned');
  }
}
