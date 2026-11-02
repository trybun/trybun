import type { ProductTourId, ProductTourProgress } from '@trybun/contracts/product-tours';
import type { UserKind } from '@trybun/contracts/users';
import type { MessageKeys, NestedKeyOf } from 'next-intl';
import type { WebMessages } from '../../lib/i18n/messages.js';

type ProductTourMessages = WebMessages['productTours'];

/** A key of the `productTours` namespace: the texts of the tours (§13.1). */
export type ProductTourMessageKey = MessageKeys<
  ProductTourMessages,
  NestedKeyOf<ProductTourMessages>
>;

/** One step of a product tour (§2.4). */
export interface ProductTourStep {
  /**
   * The `data-tour` value of the element the step explains (`<view>-<element>`, §17.1); none for
   * a step about the whole view. Several elements may carry it – the visible one is used.
   */
  target?: string;
  titleKey: ProductTourMessageKey;
  descriptionKey: ProductTourMessageKey;
  /**
   * A step about an action the view shows only when the API allows it (`allowedActions`): left
   * out when its target is not rendered. The first step is never optional.
   */
  isOptional?: boolean;
  /** The phone sheet opens at the top edge: for a target at the bottom edge of phones. */
  phoneSheetSide?: 'top';
}

/** A product tour (Rule 4, §2.4): a few steps on one view, for one account kind. */
export interface ProductTour {
  id: ProductTourId;
  /** Increased only when the steps change materially: the tour starts once more for everyone. */
  version: number;
  /** The route of the view, as in the help routes (`/tickets/[key]`). */
  view: string;
  /** The account kind whose views show the tour: the portal or the team views (§18.5). */
  audience: UserKind;
  nameKey: ProductTourMessageKey;
  steps: readonly ProductTourStep[];
}

/**
 * Whether a tour starts automatically for a person: they have not completed or skipped its
 * current version (§2.4). Unknown progress (the API did not answer) never starts a tour.
 */
export function isTourDue(
  tour: ProductTour,
  progress: readonly ProductTourProgress[] | undefined,
): boolean {
  if (progress === undefined) {
    return false;
  }
  const record = progress.find((item) => item.tourId === tour.id);
  return record === undefined || record.tourVersion < tour.version;
}

/**
 * The visible element of a `data-tour` target: the side and the bottom navigation share one, and
 * only one of them is shown for a viewport.
 */
export function findTourTarget(target: string): Element | null {
  return (
    Array.from(document.querySelectorAll(`[data-tour="${CSS.escape(target)}"]`)).find(
      (element) => element.getClientRects().length > 0,
    ) ?? null
  );
}

/** How far the ring of a tour target reaches outside it: a 2 px offset and a 3 px outline. */
const RING_EXTENT_PX = 5;

/**
 * Whether the ring of a tour target would reach past the edge of the viewport, where the screen
 * cuts it off – the bottom navigation of phones, the side navigation, a target scrolled flush to
 * an edge (#196). Such a target gets the ring inside its border instead.
 */
export function isNearViewportEdge(
  rect: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>,
  viewport: { width: number; height: number },
): boolean {
  return (
    rect.top < RING_EXTENT_PX ||
    rect.left < RING_EXTENT_PX ||
    rect.bottom > viewport.height - RING_EXTENT_PX ||
    rect.right > viewport.width - RING_EXTENT_PX
  );
}

/**
 * The steps a tour shows now: its optional steps only when their target is rendered (§2.4).
 * @param isRendered whether a `data-tour` target is on the page
 */
export function visibleSteps(
  tour: ProductTour,
  isRendered: (target: string) => boolean,
): readonly ProductTourStep[] {
  return tour.steps.filter(
    (step) => step.isOptional !== true || (step.target !== undefined && isRendered(step.target)),
  );
}
