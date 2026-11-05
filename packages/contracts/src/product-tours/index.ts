import { z } from 'zod';
import { pageSchema } from '../pagination/index.js';

/**
 * `product_tour` (Rule 4, §2.4): the closed list of product tours. The web application defines
 * the steps of each tour; the API only records the progress of its identifier.
 */
export const productTourIdSchema = z.enum(['first_login', 'organization_detail']);
export type ProductTourId = z.infer<typeof productTourIdSchema>;

/** `product_tour_progress.status` (§2.4): how a person ended a version of a tour. */
export const productTourStatusSchema = z.enum(['completed', 'skipped']);
export type ProductTourStatus = z.infer<typeof productTourStatusSchema>;

/** `product_tour.version`: increased when the steps of a tour change materially (§2.4). */
export const productTourVersionSchema = z.int().min(1).max(1000);

/** The path parameters of the progress of one tour. */
export const productTourParamsSchema = z.object({ tourId: productTourIdSchema });
export type ProductTourParams = z.infer<typeof productTourParamsSchema>;

/**
 * Records how the person ended a tour (`PUT /api/v1/users/me/product-tours/{tourId}`); a later
 * record of the same tour replaces it.
 */
export const recordProductTourProgressSchema = z.object({
  tourVersion: productTourVersionSchema,
  status: productTourStatusSchema,
});
export type RecordProductTourProgressDto = z.infer<typeof recordProductTourProgressSchema>;

/** `product_tour_progress` (§2.4): the version of a tour the person completed or skipped. */
export const productTourProgressSchema = z.object({
  tourId: productTourIdSchema,
  tourVersion: productTourVersionSchema,
  status: productTourStatusSchema,
  updatedAt: z.iso.datetime(),
});
export type ProductTourProgress = z.infer<typeof productTourProgressSchema>;

/** The progress of the person for all tours (`GET /api/v1/users/me/product-tours`), one page. */
export const productTourProgressPageSchema = pageSchema(productTourProgressSchema);
export type ProductTourProgressPage = z.infer<typeof productTourProgressPageSchema>;
