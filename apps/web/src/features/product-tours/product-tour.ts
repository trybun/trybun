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
 * Whether the ring of a tour target sits inside it (#196), judged by where the target ends up
 * after the tour scrolls it into view. A target above or below the viewport that fits between its
 * scroll margins is scrolled clear of the top and bottom edges (#191), so only the left and right
 * edges can cut its ring off; any other target stays where it is.
 * @param rect the target's box before the scroll
 * @param scrollMargin the target's scroll margins, in pixels
 */
export function isRingInset(
  rect: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>,
  viewport: { width: number; height: number },
  scrollMargin: { top: number; bottom: number },
): boolean {
  const isOutsideVertically = rect.top < 0 || rect.bottom > viewport.height;
  const canFitBetweenMargins =
    rect.bottom - rect.top <= viewport.height - scrollMargin.top - scrollMargin.bottom;
  if (isOutsideVertically && canFitBetweenMargins) {
    return rect.left < RING_EXTENT_PX || rect.right > viewport.width - RING_EXTENT_PX;
  }
  return isNearViewportEdge(rect, viewport);
}

/** The scroll margins of a tour target, in pixels: they keep the scroll off the edges (#191). */
export function scrollMarginOf(element: Element): { top: number; bottom: number } {
  const style = getComputedStyle(element);
  return {
    top: parseFloat(style.scrollMarginTop) || 0,
    bottom: parseFloat(style.scrollMarginBottom) || 0,
  };
}

/**
 * The edge of the phone screen the sheet of a step opens at (§2.9): the top edge for a target in
 * the lower half of the screen, so the sheet never covers it (#209), the bottom edge otherwise.
 * Judged by where the target ends up after the tour scrolls it into view: one below the viewport
 * lands at the bottom margin, one above it at the top margin, any other stays where it is – the
 * bottom navigation of phones too. The landing box gives the same answer, so measuring during or
 * after the scroll does not change the side.
 * @param rect the target's box
 * @param scrollMargin the target's scroll margins, in pixels
 */
export function tourSheetSide(
  rect: Pick<DOMRect, 'top' | 'bottom'>,
  viewport: { height: number },
  scrollMargin: { top: number; bottom: number },
): 'top' | 'bottom' {
  const height = rect.bottom - rect.top;
  const canFitBetweenMargins = height <= viewport.height - scrollMargin.top - scrollMargin.bottom;
  let top = rect.top;
  if (canFitBetweenMargins && rect.bottom > viewport.height - scrollMargin.bottom) {
    top = viewport.height - scrollMargin.bottom - height;
  } else if (canFitBetweenMargins && rect.top < scrollMargin.top) {
    top = scrollMargin.top;
  }
  return top + height / 2 > viewport.height / 2 ? 'top' : 'bottom';
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
