import { z } from 'zod';

/** An account was deactivated (§7.4); S1-05, S1-15 and S6-02 add their consumers. */
export const USER_DEACTIVATED = 'user.deactivated';

/** An account was reactivated (§7.4). */
export const USER_REACTIVATED = 'user.reactivated';

/** The payload of `user.deactivated` and `user.reactivated`: the account, nothing personal. */
export const userEventPayloadSchema = z.object({ userId: z.uuid() });
export type UserEventPayload = z.infer<typeof userEventPayloadSchema>;
