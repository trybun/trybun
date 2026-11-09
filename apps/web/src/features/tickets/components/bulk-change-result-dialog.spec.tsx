// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../../../test/dom/render.js';
import { BulkChangeResultDialog, type UnchangedTicket } from './bulk-change-result-dialog.js';

// A tablet: the dialog instead of the bottom sheet (jsdom has no `matchMedia`).
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const CONFLICT: UnchangedTicket = {
  ticket: { id: '0199a3f0-0000-7000-8000-000000000101', identifier: 'ERP-1', title: 'Ticket 1' },
  result: {
    id: '0199a3f0-0000-7000-8000-000000000101',
    status: 412,
    code: 'request.precondition_failed',
  },
};

afterEach(cleanup);

describe('BulkChangeResultDialog', () => {
  it('lists each unchanged ticket with its reason and retries them (§8.1)', async () => {
    const onRetry = vi.fn();
    renderInApp(
      <BulkChangeResultDialog
        changed={1}
        total={2}
        unchanged={[CONFLICT]}
        left={0}
        isRetrying={false}
        onRetry={onRetry}
        onClose={() => undefined}
      />,
    );

    const dialog = await screen.findByRole('dialog', { name: '1 of 2 tickets updated' });
    expect(dialog.textContent).toContain('ERP-1');
    expect(dialog.textContent).toContain('Changed by someone else');
    await userEvent.click(screen.getByRole('button', { name: 'Reload and retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers no retry once every unchanged ticket left the list (S1-13 Q17)', async () => {
    renderInApp(
      <BulkChangeResultDialog
        changed={0}
        total={0}
        unchanged={[]}
        left={1}
        isRetrying={false}
        onRetry={() => undefined}
        onClose={() => undefined}
      />,
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('1 ticket no longer matches the list');
    expect(screen.queryByRole('button', { name: 'Reload and retry' })).toBeNull();
  });
});
