import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { ActivityEventsService } from '../activity-events/activity-events.service.js';
import { unassignOpenTickets } from './tickets.sql.js';

/** The tickets unassigned in one transaction. */
const BATCH_SIZE = 100;

/**
 * Unassigns the open tickets of a team member who was deactivated or lost their role in a project
 * (§7.4), the Worker's side of both changes, with an automatic event of the system for each
 * ticket. It acts as the system and re-reads the current state, so it is idempotent: a person
 * reactivated or re-added meanwhile keeps their tickets, and a repeated delivery finds nothing
 * left. Tickets of archived projects are unassigned too: a consequence of the Administrator's
 * change, not a change of a person (§7.3).
 */
@Injectable()
export class TicketUnassignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEvents: ActivityEventsService,
    @InjectPinoLogger(TicketUnassignmentService.name) private readonly logger: PinoLogger,
  ) {}

  /** The open tickets of a deactivated account, in every project. */
  async unassignDeactivatedUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { state: true },
    });
    if (user === null || user.state === 'active' || user.state === 'invited') {
      return;
    }
    await this.unassign(userId, null);
  }

  /** The open tickets of a person in a project they no longer have a team role in. */
  async unassignRemovedMember(projectId: string, userId: string): Promise<void> {
    const membership = await this.prisma.projectMember.count({
      where: { projectId, userId, role: { in: teamRolesFrom('developer') } },
    });
    if (membership > 0) {
      return;
    }
    await this.unassign(userId, projectId);
  }

  /** Batches of one transaction each, until no open ticket of the person is left. */
  private async unassign(userId: string, projectId: string | null): Promise<void> {
    let total = 0;
    for (;;) {
      const count = await this.prisma.$transaction(async (tx) => {
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
