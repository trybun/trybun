// @vitest-environment jsdom
import type { UserKind } from '@trybun/contracts/users';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';

vi.mock('client-only', () => ({}));
vi.mock('next/navigation.js', () => ({ usePathname: () => '/' }));

// The tour of the view is completed, so the provider only offers it and starts none.
const progress = [
  {
    tourId: 'first_login',
    tourVersion: 1,
    status: 'completed',
    updatedAt: '2026-11-03T09:15:00.000Z',
  },
];
const get = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  browserApiClient: { GET: get, POST: vi.fn() },
}));

const { ProductTourProvider, useProductTours } = await import('./product-tour-provider.js');

function TourIds() {
  const { tours } = useProductTours();
  return <output aria-label="Tours">{tours.map(({ id }) => id).join(',')}</output>;
}

function renderProvider(audience: UserKind | undefined) {
  return renderInApp(
    <ProductTourProvider audience={audience}>
      <TourIds />
    </ProductTourProvider>,
  );
}

afterEach(() => {
  cleanup();
  get.mockReset();
});

describe('ProductTourProvider', () => {
  it.each([
    ['team', 'first_login'],
    ['end_user', ''],
    [undefined, ''],
  ] as const)(
    'offers the tours of the view for the account kind %s from the layout',
    async (audience, tourIds) => {
      get.mockResolvedValue({
        data: { items: progress, nextCursor: null },
        response: new Response(),
      });

      renderProvider(audience);

      await waitFor(() => {
        expect(get).toHaveBeenCalledWith('/api/v1/users/me/product-tours', expect.anything());
      });
      expect(screen.getByRole('status', { name: 'Tours' }).textContent).toBe(tourIds);
    },
  );

  // #372: the account kind comes from the layout, so the provider – part of the first load of
  // the shell – needs no query of the users feature, whose module brings the Accounts page along.
  it('reads only the tour progress from the API, not the account', async () => {
    get.mockResolvedValue({
      data: { items: progress, nextCursor: null },
      response: new Response(),
    });

    renderProvider('team');

    await waitFor(() => {
      expect(get).toHaveBeenCalledOnce();
    });
    expect(get).toHaveBeenCalledWith('/api/v1/users/me/product-tours', expect.anything());
    expect(get).not.toHaveBeenCalledWith('/api/v1/users/me', expect.anything());
  });
});
