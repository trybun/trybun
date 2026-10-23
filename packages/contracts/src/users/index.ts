import { z } from 'zod';

/** `user.kind` (§7.1): mutually exclusive kind of an account. */
export const userKindSchema = z.enum(['team', 'end_user']);
export type UserKind = z.infer<typeof userKindSchema>;

/** `user.state` (§7.4): lifecycle of an account. */
export const userStateSchema = z.enum(['invited', 'active', 'deactivated', 'anonymized']);
export type UserState = z.infer<typeof userStateSchema>;
