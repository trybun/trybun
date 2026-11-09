import { z } from 'zod';

/** The URL state of "My tickets" (§18.5): the project filter; an unknown value means none. */
export const myTicketsSearchParamsSchema = z.object({
  projectId: z.uuid().optional().catch(undefined),
});
export type MyTicketsSearchParams = z.infer<typeof myTicketsSearchParamsSchema>;

/**
 * The URL state of the full ticket form (S1-10 Q6): the project it was opened from, which the form
 * preselects; an unknown value means none.
 */
export const newTicketSearchParamsSchema = z.object({
  projectId: z.uuid().optional().catch(undefined),
});
export type NewTicketSearchParams = z.infer<typeof newTicketSearchParamsSchema>;
