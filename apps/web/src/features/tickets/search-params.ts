import { z } from 'zod';

/** The URL state of "My tickets" (§18.5): the project filter; an unknown value means none. */
export const myTicketsSearchParamsSchema = z.object({
  projectId: z.uuid().optional().catch(undefined),
});
export type MyTicketsSearchParams = z.infer<typeof myTicketsSearchParamsSchema>;
