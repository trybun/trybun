import { Injectable } from '@nestjs/common';
import type {
  ContentRevisionPage,
  ListContentRevisionsQuery,
} from '@trybun/contracts/content-revisions';
import { z } from 'zod';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { decodeCursor, encodeCursor } from '../../platform/database/cursor.js';
import type { Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import { identitySelect, visiblePerson } from '../users/visible-person.js';

/** The text a revision belongs to: a ticket's description or a comment (S1-12). */
export type RevisedText = { ticketId: string } | { commentId: string };

/** An earlier version of a text: what it said, who wrote it and when (§6.1). */
export interface ReplacedVersion {
  body: string;
  authorId: string;
  writtenAt: Date;
}

/** Revisions are listed newest first by their time-ordered ID (UUIDv7). */
const revisionSortKeySchema = z.tuple([z.uuid()]);

/**
 * Content revisions (§6.1, S1-12): the earlier versions of descriptions and comments, written in
 * the transaction of the edit that replaced them and deleted by a redaction. The tickets and the
 * comments modules use it; it never reads or writes their records, so it depends on neither.
 * S1-16 uses it for anonymization.
 */
@Injectable()
export class ContentRevisionsService {
  /**
   * Keeps the version an edit replaces (§6.1), in the edit's transaction. An empty version – a
   * description that was never written – is not kept: it has nothing to show or to redact.
   */
  async record(tx: Transaction, text: RevisedText, version: ReplacedVersion): Promise<void> {
    if (version.body === '') {
      return;
    }
    await tx.contentRevision.create({ data: { ...text, ...version } });
  }

  /**
   * Deletes revisions of one text in a redaction's transaction (§6.1, S1-12 Q9). Every ID must be
   * a revision of that text, else `422 field.invalid` at its pointer – nothing is deleted then,
   * as the caller's transaction is rolled back.
   */
  async purge(tx: Transaction, text: RevisedText, revisionIds: readonly string[]): Promise<void> {
    const ids = [...new Set(revisionIds)];
    if (ids.length === 0) {
      return;
    }
    const found = await tx.contentRevision.findMany({
      where: { ...text, id: { in: ids } },
      select: { id: true },
    });
    const known = new Set(found.map(({ id }) => id));
    const unknown = revisionIds.findIndex((id) => !known.has(id));
    if (unknown !== -1) {
      throw new AppError('request.validation_failed', [
        { pointer: `/purgeRevisionIds/${unknown}`, code: 'field.invalid' },
      ]);
    }
    await tx.contentRevision.deleteMany({ where: { ...text, id: { in: ids } } });
  }

  /**
   * The earlier versions of a text, newest first (§6.1): the caller has checked that the principal
   * may read them. Their authors follow the identity rule (§5.4).
   */
  async list(
    db: Transaction,
    principal: UserPrincipal,
    text: RevisedText,
    query: ListContentRevisionsQuery,
  ): Promise<ContentRevisionPage> {
    const before = decodeCursor(query.cursor, revisionSortKeySchema);
    const rows = await db.contentRevision.findMany({
      where: { ...text, ...(before === null ? {} : { id: { lt: before[0] } }) },
      select: {
        id: true,
        body: true,
        writtenAt: true,
        author: { select: identitySelect(principal) },
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        body: row.body,
        author: visiblePerson(principal, row.author),
        writtenAt: row.writtenAt.toISOString(),
      })),
      nextCursor: rows.length > query.limit && last !== undefined ? encodeCursor([last.id]) : null,
    };
  }
}
