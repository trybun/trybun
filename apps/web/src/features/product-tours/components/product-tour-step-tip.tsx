'use client';

import {
  TourTip,
  TourTipDescription,
  TourTipFooter,
  TourTipTitle,
} from '@trybun/ui/components/tour-tip';
import { useTranslations } from 'next-intl';
import {
  findTourTarget,
  type ProductTourStep,
  scrollMarginOf,
  tourSheetSide,
} from '../product-tour.js';

/**
 * The phone sheet's edge for a step: away from where the tour scrolls its target (#209). Read
 * when the tip renders, as the anchor is; the prediction gives the same side before and after
 * the scroll.
 */
function sheetSideOf(target: string | undefined): 'top' | 'bottom' {
  const element = target === undefined ? null : findTourTarget(target);
  if (element === null) {
    return 'bottom';
  }
  return tourSheetSide(
    element.getBoundingClientRect(),
    { height: window.innerHeight },
    scrollMarginOf(element),
  );
}

/**
 * The tip of the running step (§2.4). Loaded only when a tour starts, so the popover and the
 * sheet are not part of the code every page of the shell loads first (§2.9).
 */
export function ProductTourStepTip({
  step,
  stepNumber,
  stepCount,
  onBack,
  onNext,
  onSkip,
}: {
  step: ProductTourStep;
  stepNumber: number;
  stepCount: number;
  onBack: () => void;
  onNext: () => void;
  /** Skip, Esc, the close button or a swipe. */
  onSkip: () => void;
}) {
  const t = useTranslations('productTours');
  const { target } = step;
  return (
    <TourTip
      open
      onOpenChange={(open) => {
        if (!open) {
          onSkip();
        }
      }}
      anchor={target === undefined ? null : () => findTourTarget(target)}
      sheetSide={sheetSideOf(target)}
      step={stepNumber}
      stepCount={stepCount}
    >
      <TourTipTitle>{t(step.titleKey)}</TourTipTitle>
      <TourTipDescription>{t(step.descriptionKey)}</TourTipDescription>
      <TourTipFooter onBack={onBack} onNext={onNext} onSkip={onSkip} />
    </TourTip>
  );
}
