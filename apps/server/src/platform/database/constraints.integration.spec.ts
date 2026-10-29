// The check constraints of the migrations that Prisma does not model (§17.2).
import { afterAll, describe, expect, it } from 'vitest';
import { createInvitation } from '../../../test/factories/invitation.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { PrismaService } from './prisma.service.js';

const prisma = new PrismaService(integrationConfig());

afterAll(async () => {
  await prisma.$disconnect();
});

describe('users.email', () => {
  it('holds only normalized addresses', async () => {
    await expect(createUser(prisma, { email: 'Anna@Firma.example' })).rejects.toThrow();
    await expect(createUser(prisma, { email: ' anna@firma.example' })).rejects.toThrow();
  });
});

describe('invitations', () => {
  it('keeps the columns consistent with the target', async () => {
    const user = await createUser(prisma, { state: 'invited' });
    const project = await createProject(prisma);

    await expect(createInvitation(prisma, { userId: user.id })).resolves.toMatchObject({
      target: 'administrator',
    });
    await expect(
      createInvitation(prisma, { userId: user.id, target: 'administrator', projectId: project.id }),
    ).rejects.toThrow();
    await expect(
      createInvitation(prisma, { userId: user.id, target: 'project', projectId: project.id }),
    ).rejects.toThrow();
    await expect(
      createInvitation(prisma, { userId: user.id, target: 'organization' }),
    ).rejects.toThrow();
  });
});
