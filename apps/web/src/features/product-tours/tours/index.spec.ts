import { productTourIdSchema } from '@trybun/contracts/product-tours';
import { describe, expect, it } from 'vitest';
import { PRODUCT_TOURS } from './index.js';

// The rules of §2.4 every tour definition follows.
describe('PRODUCT_TOURS', () => {
  it('defines every tour of the contracts once', () => {
    expect(PRODUCT_TOURS.map((tour) => tour.id).sort()).toEqual(
      [...productTourIdSchema.options].sort(),
    );
  });

  it.each(PRODUCT_TOURS.map((tour) => [tour.id, tour] as const))('%s is short', (_id, tour) => {
    // At most a few steps (about 5); a longer process is split into separate tours.
    expect(tour.steps.length).toBeGreaterThan(0);
    expect(tour.steps.length).toBeLessThanOrEqual(5);
    expect(tour.version).toBeGreaterThanOrEqual(1);
  });

  it.each(PRODUCT_TOURS.map((tour) => [tour.id, tour] as const))(
    '%s starts with a step that is never left out',
    (_id, tour) => {
      expect(tour.steps[0]?.isOptional).not.toBe(true);
    },
  );

  it.each(
    PRODUCT_TOURS.flatMap((tour) => tour.steps.map((step) => [tour.id, step.target] as const)),
  )('%s targets "%s" as data-tour="<view>-<element>" (§17.1)', (_id, target) => {
    if (target !== undefined) {
      expect(target).toMatch(/^[a-z\d]+(-[a-z\d]+)+$/);
    }
  });
});
