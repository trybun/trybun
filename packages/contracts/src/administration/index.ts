import { z } from 'zod';
import { pageSchema } from '../pagination/index.js';

/** Actions on the subject `Administration`, the Administrator panel (§15.6, §18.3). */
export const administrationActionSchema = z.enum(['read']);
export type AdministrationAction = z.infer<typeof administrationActionSchema>;

/**
 * `getting_started_item` (§15.6): the closed list of the getting-started checklist, in the order
 * it is shown. Each task that builds a feature with an item adds it here.
 */
export const gettingStartedItemIdSchema = z.enum(['configure_github_sign_in', 'configure_email']);
export type GettingStartedItemId = z.infer<typeof gettingStartedItemIdSchema>;

/** An item of the checklist; its state comes from the configuration, never from a record. */
export const gettingStartedItemSchema = z.object({
  id: gettingStartedItemIdSchema,
  isDone: z.boolean(),
  isOptional: z.boolean(),
});
export type GettingStartedItem = z.infer<typeof gettingStartedItemSchema>;

/** The checklist (`GET /api/v1/administration/getting-started`), one page (§18.4). */
export const gettingStartedPageSchema = pageSchema(gettingStartedItemSchema);
export type GettingStartedPage = z.infer<typeof gettingStartedPageSchema>;

/** The "About" page (`GET /api/v1/administration/about`, §15.4): the version of `/health`. */
export const aboutSchema = z.object({
  version: z.string(),
  license: z.literal('MIT'),
});
export type About = z.infer<typeof aboutSchema>;
