import { describe, expect, it } from 'vitest';
import { findPrismaMajorProblems, findSchemaProblems, toSnakeCase } from './check-prisma.js';

const SCHEMA = 'apps/server/prisma/schema.prisma';

const VALID = `
enum TicketStatus {
  in_progress
  waiting_for_requester

  @@map("ticket_status")
}

/// A ticket (§3.2).
model Ticket {
  id          String       @id @default(uuid(7)) @db.Uuid
  title       String
  status      TicketStatus
  requesterId String       @map("requester_id") @db.Uuid
  requester   User         @relation(fields: [requesterId], references: [id])
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([requesterId])
  @@map("tickets")
}

model User {
  id      String   @id @db.Uuid
  tickets Ticket[]

  @@map("users")
}
`;

describe('toSnakeCase', () => {
  it.each([
    ['ActivityEvent', 'activity_event'],
    ['requesterId', 'requester_id'],
    ['title', 'title'],
    ['keycloakUserId', 'keycloak_user_id'],
  ])('%s → %s', (name, snake) => {
    expect(toSnakeCase(name)).toBe(snake);
  });
});

describe('findSchemaProblems', () => {
  it('accepts mapped models, fields and enums; relation fields need no mapping', () => {
    expect(findSchemaProblems(SCHEMA, VALID)).toEqual([]);
  });

  it.each([
    [
      'a model without @@map',
      VALID.replace('  @@map("users")\n', ''),
      `${SCHEMA}:22: model User has no @@map("<plural_snake_case>")`,
    ],
    [
      'a model mapped to a singular table',
      VALID.replace('@@map("users")', '@@map("user")'),
      `${SCHEMA}:22: model User maps to "user", not a plural snake_case table`,
    ],
    [
      'a model mapped to a table in another case',
      VALID.replace('@@map("tickets")', '@@map("Tickets")'),
      `${SCHEMA}:10: model Ticket maps to "Tickets", not a plural snake_case table`,
    ],
    [
      'a multi-word field without @map',
      VALID.replace('@default(now()) @map("created_at")', '@default(now())'),
      `${SCHEMA}:16: field Ticket.createdAt needs @map("created_at")`,
    ],
    [
      'a multi-word field with a wrong @map',
      VALID.replace('@map("requester_id")', '@map("requester")'),
      `${SCHEMA}:14: field Ticket.requesterId needs @map("requester_id")`,
    ],
    [
      'a multi-word enum without @@map',
      VALID.replace('  @@map("ticket_status")\n', ''),
      `${SCHEMA}:2: enum TicketStatus needs @@map("ticket_status")`,
    ],
    [
      'an enum value outside snake_case',
      VALID.replace('  in_progress\n', '  inProgress\n'),
      `${SCHEMA}:3: value TicketStatus.inProgress is not snake_case`,
    ],
    ['a schema without models', '// empty\n', `${SCHEMA}: no model found`],
  ])('reports %s', (_case, schema, problem) => {
    expect(findSchemaProblems(SCHEMA, schema)).toEqual([problem]);
  });
});

describe('findPrismaMajorProblems', () => {
  const LOCKFILE = `
packages:

  '@prisma/client@7.10.1':
    resolution: {integrity: sha512-x}

  '@prisma/engines-version@8.1.0-1.d1b3f377ca835d73fd50954a5e22128b9ebdd6b8':
    resolution: {integrity: sha512-x}

  '@prisma/studio-core@0.33.0':
    resolution: {integrity: sha512-x}

  prisma@7.10.1:
    resolution: {integrity: sha512-x}

snapshots:

  prisma@7.10.1(typescript@6.0.3): {}
`;

  it('accepts Prisma ORM 7 and the engine build identifier', () => {
    expect(findPrismaMajorProblems('pnpm-lock.yaml', LOCKFILE)).toEqual([]);
  });

  it.each([
    ['prisma', LOCKFILE.replaceAll('prisma@7.10.1', 'prisma@8.0.0-rc.27'), 'prisma@8'],
    [
      'a Prisma ORM 8 package',
      `${LOCKFILE}\n  '@prisma/orm-postgres@8.0.0':\n    resolution: {integrity: sha512-x}\n`,
      '@prisma/orm-postgres@8',
    ],
  ])('reports %s', (_case, lockfile, found) => {
    expect(findPrismaMajorProblems('pnpm-lock.yaml', lockfile)).toEqual([
      `pnpm-lock.yaml: ${found} is a Prisma ORM 8 package; use 7.x (§14.2)`,
    ]);
  });
});
