// Every Prisma enum has the values of its contract enum (§18.4).
import { userKindSchema, userStateSchema } from '@trybun/contracts/users';
import { describe, expect, it } from 'vitest';
import { UserKind, UserState } from '../../generated/prisma/enums.js';

describe('Prisma enums', () => {
  it.each([
    ['UserKind', UserKind, userKindSchema.options],
    ['UserState', UserState, userStateSchema.options],
  ])('%s matches its contract enum', (_name, prismaEnum, contractValues) => {
    expect(Object.values(prismaEnum)).toEqual(contractValues);
  });
});
