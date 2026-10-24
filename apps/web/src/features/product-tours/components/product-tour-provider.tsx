'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProductTourId, ProductTourStatus } from '@trybun/contracts/product-tours';
import { usePathname } from 'next/navigation.js';
import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { matchesView } from '../../help/help-routes.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { useRecordProductTourProgress } from '../mutations.js';
import {
  findTourTarget,
  isTourDue,
  type ProductTour,
  type ProductTourStep,
  visibleSteps,
} from '../product-tour.js';
import { productTourProgressQueryOptions } from '../queries.js';
import { PRODUCT_TOURS } from '../tours/index.js';

interface ProductToursContextValue {
  /** The tours of the current view for the person's account kind, for the help menu. */
  tours: readonly ProductTour[];
  /** Starts a tour from its first step, whatever its recorded progress (§2.4). */
  start: (tour: ProductTour) => void;
}

const ProductToursContext = createContext<ProductToursContextValue>({
  tours: [],
  start: () => undefined,
});

/** The tours of the current view and how to start one (the help menu, §2.4). */
export function useProductTours(): ProductToursContextValue {
  return use(ProductToursContext);
}

interface RunningTour {
  tour: ProductTour;
  steps: readonly ProductTourStep[];
  stepIndex: number;
}

const subscribeToNothing = () => () => undefined;

// The tip is loaded only when a tour starts (Lighthouse budget of the shell, §2.9).
const ProductTourStepTip = lazy(() =>
  import('./product-tour-step-tip.js').then((module) => ({ default: module.ProductTourStepTip })),
);

function isRendered(target: string): boolean {
  return findTourTarget(target) !== null;
}

/**
 * Runs the product tours of the application shell (Rule 4, §2.4). A tour of the current view
 * starts once the view has rendered, when the person has not completed or skipped its current
 * version – on any device, because the progress is stored on the server. Done records
 * `completed`; Skip, Esc, the close button and leaving the view record `skipped`.
 */
export function ProductTourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Only in the browser, after hydration: the tip measures the page and the viewport.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const { data: user } = useQuery(currentUserQueryOptions(browserApiClient));
  const { data: progress } = useQuery(productTourProgressQueryOptions(browserApiClient));
  const { mutate: recordProgress } = useRecordProductTourProgress();
  const [started, setStarted] = useState<RunningTour | null>(null);
  // Tours ended on this page, so they do not start again before the progress is recorded.
  const [endedTourIds, setEndedTourIds] = useState<readonly ProductTourId[]>([]);
  const [leftTour, setLeftTour] = useState<{ tour: ProductTour } | null>(null);
  const [previousPathname, setPreviousPathname] = useState(pathname);

  const tours =
    user === undefined
      ? []
      : PRODUCT_TOURS.filter(
          (tour) => tour.audience === user.kind && matchesView(tour.view, pathname),
        );
  const dueTour = isHydrated
    ? tours.find((tour) => isTourDue(tour, progress) && !endedTourIds.includes(tour.id))
    : undefined;
  const running: RunningTour | null =
    started ??
    (dueTour === undefined ? null : { tour: dueTour, steps: dueTour.steps, stepIndex: 0 });

  // Leaving the view ends its tour as skipped, so it does not reappear on its own (Rule 2).
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    if (running !== null) {
      setStarted(null);
      setEndedTourIds((ids) => [...ids, running.tour.id]);
      setLeftTour({ tour: running.tour });
    }
  }
  useEffect(() => {
    if (leftTour !== null) {
      recordProgress({
        tourId: leftTour.tour.id,
        tourVersion: leftTour.tour.version,
        status: 'skipped',
      });
    }
  }, [leftTour, recordProgress]);

  const step = running?.steps[running.stepIndex];
  const target = step?.target;
  // The ring around the target, scrolled into view (instantly with reduced motion, §13.4).
  useEffect(() => {
    const element = target === undefined ? null : findTourTarget(target);
    if (element === null) {
      return undefined;
    }
    element.setAttribute('data-tour-highlighted', '');
    const isMotionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ block: 'nearest', behavior: isMotionReduced ? 'instant' : 'smooth' });
    return () => element.removeAttribute('data-tour-highlighted');
  }, [target, running?.tour.id]);

  const end = (status: ProductTourStatus) => {
    if (running === null) {
      return;
    }
    setStarted(null);
    setEndedTourIds((ids) => [...ids, running.tour.id]);
    recordProgress({ tourId: running.tour.id, tourVersion: running.tour.version, status });
  };

  // The steps are counted again on every move: an optional step appears only with its target.
  const move = (direction: 1 | -1) => {
    if (running === null || step === undefined) {
      return;
    }
    const steps = visibleSteps(running.tour, isRendered);
    const stepIndex = Math.max(steps.indexOf(step), 0) + direction;
    if (stepIndex >= steps.length) {
      end('completed');
    } else if (stepIndex >= 0) {
      setStarted({ tour: running.tour, steps, stepIndex });
    }
  };

  const start = (tour: ProductTour) => {
    setStarted({ tour, steps: visibleSteps(tour, isRendered), stepIndex: 0 });
  };

  return (
    <ProductToursContext value={{ tours, start }}>
      {children}
      {running !== null && step !== undefined && (
        <Suspense>
          <ProductTourStepTip
            step={step}
            stepNumber={running.stepIndex + 1}
            stepCount={running.steps.length}
            onBack={() => move(-1)}
            onNext={() => move(1)}
            onSkip={() => end('skipped')}
          />
        </Suspense>
      )}
    </ProductToursContext>
  );
}
