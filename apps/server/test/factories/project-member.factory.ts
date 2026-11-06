import type { ProjectMember } from '../../src/generated/prisma/client.js';
import type { ProjectRole } from '../../src/generated/prisma/enums.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

export function createProjectMember(
  db: Transaction,
  member: { projectId: string; userId: string; role?: ProjectRole },
): Promise<ProjectMember> {
  return db.projectMember.create({ data: { role: 'developer', ...member } });
}
