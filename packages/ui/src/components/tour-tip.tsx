'use client';

import { cn } from 'cn';
import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, use, useRef, type ReactNode, type RefObject } from 'react';

import { Button } from '@trybun/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@trybun/ui/components/drawer';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
} from '@trybun/ui/components/popover';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '@trybun/ui/hooks/use-media-query';

type TourTipContextProps = {
  isSheet: boolean;
  step: number;
  stepCount: number;
  primaryActionRef: RefObject<HTMLButtonElement | null>;
};

const TourTipContext = createContext<TourTipContextProps | null>(null);

function useTourTip() {
  const context = use(TourTipContext);

  if (!context) {
    throw new Error('useTourTip must be used within a TourTip.');
  }

  return context;
}

// Only an explicit request closes a tip: a tour never blocks work, so pressing or focusing
// another element of the page leaves it open (§2.4).
const CLOSE_REASONS: ReadonlySet<string> = new Set([
  'escape-key',
  'close-press',
  'close-watcher',
  'swipe',
]);

// The anchor of a tip without a target element: the upper middle of the viewport.
const VIEWPORT_ANCHOR = {
  getBoundingClientRect: () =>
    DOMRect.fromRect({ x: window.innerWidth / 2, y: window.innerHeight / 3, width: 0, height: 0 }),
};

type TourTipAnchor = Element | (() => Element | null) | null;

/** The anchor of the popover: the element, or the viewport when there is none (yet). */
function positionerAnchor(anchor: TourTipAnchor | undefined) {
  if (typeof anchor === 'function') {
    return () => anchor() ?? VIEWPORT_ANCHOR;
  }
  return anchor ?? VIEWPORT_ANCHOR;
}

/**
 * One step of a product tour (Rule 4, §2.4): a non-modal tip next to `anchor` on tablets and
 * desktops – centred without one – and a bottom sheet on phones (§2.9). It never dims or blocks
 * the page. Focus moves to the primary action when it opens and returns to the element that had
 * it when it closes; Esc, the close button and a swipe call `onOpenChange(false)`. A new step keeps
 * the tip open and announces its title and text.
 */
function TourTip({
  open,
  onOpenChange,
  anchor,
  sheetSide = 'bottom',
  step,
  stepCount,
  finalFocus,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The element the step explains, or a function that finds it when the tip is positioned;
   * `null` or missing for a step about the whole view.
   */
  anchor?: TourTipAnchor;
  /** The edge of the phone screen the sheet opens at: `top` for a target at the bottom edge. */
  sheetSide?: 'bottom' | 'top';
  /** The number of the step, from 1. */
  step: number;
  stepCount: number;
  /** The element focused when the tip closes; by default the one focused before it opened. */
  finalFocus?: RefObject<HTMLElement | null> | boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations('ui');
  const isSheet = !useMediaQuery(TABLET_MEDIA_QUERY);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const handleOpenChange = (nextOpen: boolean, { reason }: { reason: string }) => {
    if (nextOpen || CLOSE_REASONS.has(reason)) {
      onOpenChange(nextOpen);
    }
  };
  const context = { isSheet, step, stepCount, primaryActionRef };

  if (isSheet) {
    return (
      <TourTipContext value={context}>
        <Drawer
          open={open}
          onOpenChange={handleOpenChange}
          modal={false}
          swipeDirection={sheetSide === 'top' ? 'up' : 'down'}
        >
          <DrawerContent
            data-slot="tour-tip"
            initialFocus={primaryActionRef}
            finalFocus={finalFocus}
            className={cn('gap-3 p-4 pt-0', className)}
          >
            {children}
            <DrawerClose
              render={<Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" />}
              aria-label={t('close')}
            >
              <XIcon aria-hidden />
            </DrawerClose>
          </DrawerContent>
        </Drawer>
      </TourTipContext>
    );
  }

  return (
    <TourTipContext value={context}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverContent
          data-slot="tour-tip"
          anchor={positionerAnchor(anchor)}
          sideOffset={8}
          initialFocus={primaryActionRef}
          finalFocus={finalFocus}
          className={cn('relative w-80 gap-3 p-4', className)}
        >
          {children}
          <PopoverClose
            render={<Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" />}
            aria-label={t('close')}
          >
            <XIcon aria-hidden />
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </TourTipContext>
  );
}

// The step counter is part of the title, so screen readers announce it with the step.
function TourTipTitle({ className, children }: { className?: string; children: ReactNode }) {
  const t = useTranslations('ui.tourTip');
  const { isSheet, step, stepCount } = useTourTip();
  const Title = isSheet ? DrawerTitle : PopoverTitle;
  return (
    <Title
      data-slot="tour-tip-title"
      aria-live="polite"
      className={cn('flex flex-col gap-1 pr-10 font-heading text-base font-medium', className)}
    >
      <span className="text-xs font-normal text-muted-foreground">
        {t('progress', { step, count: stepCount })}
      </span>
      {children}
    </Title>
  );
}

function TourTipDescription({ className, children }: { className?: string; children: ReactNode }) {
  const { isSheet } = useTourTip();
  const Description = isSheet ? DrawerDescription : PopoverDescription;
  return (
    <Description
      data-slot="tour-tip-description"
      aria-live="polite"
      className={cn('text-sm text-pretty text-muted-foreground', className)}
    >
      {children}
    </Description>
  );
}

/** The actions of a step: skip the tour, go back, and go on (or finish on the last step). */
function TourTipFooter({
  onBack,
  onNext,
  onSkip,
  className,
}: {
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
  className?: string;
}) {
  const t = useTranslations('ui.tourTip');
  const { step, stepCount, primaryActionRef } = useTourTip();
  const isLast = step === stepCount;
  return (
    <div data-slot="tour-tip-footer" className={cn('flex flex-wrap items-center gap-2', className)}>
      {!isLast && (
        <Button variant="ghost" className="-ml-2" onClick={onSkip}>
          {t('skip')}
        </Button>
      )}
      <div className="ml-auto flex gap-2">
        {step > 1 && onBack !== undefined && (
          <Button variant="outline" onClick={onBack}>
            {t('back')}
          </Button>
        )}
        <Button ref={primaryActionRef} onClick={onNext}>
          {isLast ? t('done') : t('next')}
        </Button>
      </div>
    </div>
  );
}

export { TourTip, TourTipDescription, TourTipFooter, TourTipTitle };
