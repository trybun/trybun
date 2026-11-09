// The check constraints of the migrations that Prisma does not model (§17.2).
import { afterAll, describe, expect, it } from 'vitest';
import { createInvitation } from '../../../test/factories/invitation.factory.js';
import { createOrganization } from '../../../test/factories/organization.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
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

describe('tickets.visibility and tickets.sharing_request', () => {
  async function setUp() {
    const project = await createProject(prisma);
    const requester = await createUser(prisma);
    const organization = await createOrganization(prisma);
    return { projectId: project.id, requesterId: requester.id, organizationId: organization.id };
  }

  it('accepts the combinations of §5.1', async () => {
    const base = { ...(await setUp()), source: 'user' as const, status: 'new' as const };

    await expect(createTicket(prisma, base)).resolves.toMatchObject({
      visibility: 'only_me',
      sharingRequest: 'none',
      sharingRefusalReason: null,
    });
    await expect(
      createTicket(prisma, { ...base, visibility: 'my_organization', sharingRequest: 'pending' }),
    ).resolves.toMatchObject({ sharingRequest: 'pending' });
    await expect(
      createTicket(prisma, { ...base, sharingRequest: 'rejected' }),
    ).resolves.toMatchObject({
      sharingRequest: 'rejected',
      sharingRefusalReason: expect.any(String) as string,
    });
    await expect(
      createTicket(prisma, { ...base, visibility: 'all_customers' }),
    ).resolves.toMatchObject({ visibility: 'all_customers' });
  });

  it.each([
    [
      'my_organization without an organization',
      { organizationId: null, visibility: 'my_organization' },
    ],
    ['a request on a shared ticket', { visibility: 'all_customers', sharingRequest: 'pending' }],
    ['a visibility of a team ticket', { source: 'developer', visibility: 'my_organization' }],
    ['a request on an integration ticket', { source: 'integration', sharingRequest: 'pending' }],
    ['a refusal without its reason', { sharingRequest: 'rejected', sharingRefusalReason: null }],
    ['a reason without a refusal', { sharingRefusalReason: 'No' }],
  ] as const)('refuses %s', async (_case, data) => {
    const base = { ...(await setUp()), source: 'user' as const, status: 'new' as const };

    await expect(createTicket(prisma, { ...base, ...data })).rejects.toThrow();
  });
});
