// Every Prisma enum has the values of its contract enum (§18.4).
import { productTourStatusSchema } from '@trybun/contracts/product-tours';
import { userKindSchema, userStateSchema } from '@trybun/contracts/users';
import { describe, expect, it } from 'vitest';
import { ProductTourStatus, UserKind, UserState } from '../../generated/prisma/enums.js';

describe('Prisma enums', () => {
  it.each([
    ['UserKind', UserKind, userKindSchema.options],
    ['UserState', UserState, userStateSchema.options],
    ['ProductTourStatus', ProductTourStatus, productTourStatusSchema.options],
  ])('%s matches its contract enum', (_name, prismaEnum, contractValues) => {
    expect(Object.values(prismaEnum)).toEqual(contractValues);
  });
});
