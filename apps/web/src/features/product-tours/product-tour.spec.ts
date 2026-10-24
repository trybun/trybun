import type { ProductTourProgress } from '@trybun/contracts/product-tours';
import { describe, expect, it } from 'vitest';
import { isTourDue, type ProductTour, visibleSteps } from './product-tour.js';

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

describe('visibleSteps', () => {
  it.each([
    ['shows an optional step whose target is rendered', () => true, 3],
    ['leaves out an optional step whose target is missing', () => false, 2],
  ])('%s', (_case, isRendered, count) => {
    expect(visibleSteps(TOUR, isRendered)).toHaveLength(count);
  });
});
