// The options of the visibility controls (S1-11): from the API's actions only (§14.4).
import { describe, expect, it } from 'vitest';
import {
  creationVisibilityOptions,
  shownVisibility,
  ticketVisibilityOptions,
} from './visibility.js';

describe('creationVisibilityOptions', () => {
  it.each([
    [['read', 'create_ticket'], ['only_me']],
    [
      ['read', 'create_ticket', 'create_ticket_all_customers'],
      ['only_me', 'all_customers'],
    ],
    [
      ['read', 'create_ticket', 'create_ticket_my_organization', 'create_ticket_all_customers'],
      ['only_me', 'my_organization', 'all_customers'],
    ],
  ] as const)('offers for %o the options %o', (actions, options) => {
    expect(creationVisibilityOptions(actions)).toEqual(options);
  });
});

describe('ticketVisibilityOptions', () => {
  it('shows a pending request as All customers with the withdrawals', () => {
    const ticket = {
      visibility: 'my_organization',
      sharingRequest: 'pending',
      allowedActions: ['read', 'set_visibility_only_me', 'set_visibility_my_organization'],
    } as const;

    expect(shownVisibility(ticket)).toBe('all_customers');
    expect(ticketVisibilityOptions(ticket)).toEqual([
      'only_me',
      'my_organization',
      'all_customers',
    ]);
  });

  it('offers only the current value without an action', () => {
    expect(
      ticketVisibilityOptions({
        visibility: 'all_customers',
        sharingRequest: 'none',
        allowedActions: ['read', 'update'],
      }),
    ).toEqual(['all_customers']);
  });
});
