import type { ProductTour } from '../product-tour.js';
import { FIRST_LOGIN_TOUR } from './first-login.js';
import { ORGANIZATION_DETAIL_TOUR } from './organization-detail.js';

/**
 * Every product tour (§2.4): the single source of the automatic start, the help menu and the E2E
 * check of the `data-tour` targets. A new tour is added here and to `productTourIdSchema`.
 */
export const PRODUCT_TOURS: readonly ProductTour[] = [FIRST_LOGIN_TOUR, ORGANIZATION_DETAIL_TOUR];
