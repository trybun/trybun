import type { ProductTourProgress } from '@trybun/contracts/product-tours';
import { describe, expect, it } from 'vitest';
import {
  isNearViewportEdge,
  isRingInset,
  isTourDue,
  type ProductTour,
  visibleSteps,
} from './product-tour.js';

const TOUR: ProductTour = {
  id: 'first_login',
  version: 2,
  view: '/',
  audience: 'team',
  nameKey: 'tours.first_login.name',
  steps: [
    {
      titleKey: 'tours.first_login.steps.welcome.title',
      descriptionKey: 'tours.first_login.steps.welcome.description',
    },
    {
      target: 'app-header-help',
      titleKey: 'tours.first_login.steps.help.title',
      descriptionKey: 'tours.first_login.steps.help.description',
      isOptional: true,
    },
    {
      target: 'app-header-account-menu',
      titleKey: 'tours.first_login.steps.account.title',
      descriptionKey: 'tours.first_login.steps.account.description',
    },
  ],
};

function progressOf(tourVersion: number, status: 'completed' | 'skipped'): ProductTourProgress[] {
  return [{ tourId: 'first_login', tourVersion, status, updatedAt: '2026-11-03T09:15:00.000Z' }];
}

describe('isTourDue', () => {
  it.each([
    ['without a record', [], true],
    ['after the current version was completed', progressOf(2, 'completed'), false],
    ['after the current version was skipped', progressOf(2, 'skipped'), false],
    ['after an older version was completed', progressOf(1, 'completed'), true],
    ['while the progress is unknown', undefined, false],
  ])('%s: %s', (_case, progress, isDue) => {
    expect(isTourDue(TOUR, progress)).toBe(isDue);
  });
});

describe('isNearViewportEdge', () => {
  const VIEWPORT = { width: 360, height: 611 };

  it.each([
    ['the bottom navigation of phones', { top: 555, right: 360, bottom: 611, left: 0 }, true],
    ['a target 4 px above the bottom edge', { top: 500, right: 300, bottom: 607, left: 60 }, true],
    ['a target 4 px from the left edge', { top: 100, right: 300, bottom: 200, left: 4 }, true],
    ['a target at the top edge', { top: 0, right: 300, bottom: 56, left: 60 }, true],
    ['a target partly below the viewport', { top: 580, right: 300, bottom: 700, left: 60 }, true],
    ['a target 5 px inside every edge', { top: 5, right: 355, bottom: 606, left: 5 }, false],
    ['a header button', { top: 6, right: 350, bottom: 50, left: 306 }, false],
  ])('%s: %s', (_case, rect, isNear) => {
    expect(isNearViewportEdge(rect, VIEWPORT)).toBe(isNear);
  });
});

describe('isRingInset', () => {
  const VIEWPORT = { width: 360, height: 611 };
  const SCROLL_MARGIN = { top: 72, bottom: 76 };

  it.each([
    // Scrolled clear of the edge by the scroll margin, not flush with it (#191).
    ['a target below the viewport', { top: 700, right: 300, bottom: 760, left: 60 }, false],
    ['a target partly below the viewport', { top: 580, right: 300, bottom: 700, left: 60 }, false],
    ['a target above the viewport', { top: -200, right: 300, bottom: -100, left: 60 }, false],
    [
      'a target below the viewport at its left edge',
      { top: 700, right: 300, bottom: 760, left: 0 },
      true,
    ],
    // Taller than the room between the margins: the scroll still ends at an edge.
    ['a target taller than the viewport', { top: 56, right: 360, bottom: 1400, left: 0 }, true],
    [
      'a target below the viewport too tall for the margins',
      { top: 700, right: 300, bottom: 1200, left: 60 },
      true,
    ],
    // Fixed or already visible: it stays where it is (#196).
    ['the bottom navigation of phones', { top: 555, right: 360, bottom: 611, left: 0 }, true],
    ['a header button', { top: 6, right: 350, bottom: 50, left: 306 }, false],
  ])('%s: %s', (_case, rect, isInset) => {
    expect(isRingInset(rect, VIEWPORT, SCROLL_MARGIN)).toBe(isInset);
  });
});

describe('visibleSteps', () => {
  it.each([
    ['shows an optional step whose target is rendered', () => true, 3],
    ['leaves out an optional step whose target is missing', () => false, 2],
  ])('%s', (_case, isRendered, count) => {
    expect(visibleSteps(TOUR, isRendered)).toHaveLength(count);
  });
});
