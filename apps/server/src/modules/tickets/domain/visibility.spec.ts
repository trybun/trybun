// The use cases of ticket visibility (S1-11, §5.2, §5.3): one row per case of the effects table.
import { describe, expect, it } from 'vitest';
import {
  approveSharing,
  changeVisibility,
  initialVisibility,
  rejectSharing,
  type VisibilityFields,
  type VisibilityRequest,
} from './visibility.js';

const ONLY_ME: VisibilityFields = {
  visibility: 'only_me',
  sharingRequest: 'none',
};
const MY_ORGANIZATION: VisibilityFields = { ...ONLY_ME, visibility: 'my_organization' };
const REJECTED: VisibilityFields = {
  visibility: 'my_organization',
  sharingRequest: 'rejected',
};

const requester = (
  target: VisibilityRequest['target'],
  canChooseOrganization = true,
): VisibilityRequest => ({ target, isByRequester: true, canChooseOrganization });
const team = (target: VisibilityRequest['target']): VisibilityRequest => ({
  target,
  isByRequester: false,
  canChooseOrganization: false,
});

describe('changeVisibility', () => {
  it.each([
    [
      'the requester widens',
      ONLY_ME,
      requester('my_organization'),
      MY_ORGANIZATION,
      'visibility_changed',
      { from: 'only_me', to: 'my_organization' },
      null,
    ],
    [
      'the team narrows a shared ticket',
      { ...ONLY_ME, visibility: 'all_customers' },
      team('only_me'),
      ONLY_ME,
      'visibility_changed',
      { from: 'all_customers', to: 'only_me' },
      'ticket.visibility_changed',
    ],
    [
      'a request from only_me of a person in their organization',
      ONLY_ME,
      requester('all_customers'),
      { ...MY_ORGANIZATION, sharingRequest: 'pending' },
      'sharing_requested',
      { from: 'only_me', to: 'my_organization' },
      null,
    ],
    // Q4: no widening to an organization the person cannot choose.
    [
      'a request from only_me of a person without it',
      ONLY_ME,
      requester('all_customers', false),
      { ...ONLY_ME, sharingRequest: 'pending' },
      'sharing_requested',
      { from: 'only_me', to: 'only_me' },
      null,
    ],
    // Q5: a request after a refusal clears the reason.
    [
      'a repeated request after a refusal',
      REJECTED,
      requester('all_customers'),
      { ...MY_ORGANIZATION, sharingRequest: 'pending' },
      'sharing_requested',
      { from: 'my_organization', to: 'my_organization' },
      null,
    ],
    [
      'a withdrawal to the current visibility',
      { ...MY_ORGANIZATION, sharingRequest: 'pending' },
      requester('my_organization'),
      MY_ORGANIZATION,
      'sharing_request_withdrawn',
      { from: 'my_organization', to: 'my_organization' },
      null,
    ],
    [
      'a withdrawal to only_me',
      { ...MY_ORGANIZATION, sharingRequest: 'pending' },
      requester('only_me'),
      ONLY_ME,
      'sharing_request_withdrawn',
      { from: 'my_organization', to: 'only_me' },
      null,
    ],
    [
      'the team shares a refused ticket',
      REJECTED,
      team('all_customers'),
      { ...ONLY_ME, visibility: 'all_customers' },
      'visibility_changed',
      { from: 'my_organization', to: 'all_customers' },
      'ticket.visibility_changed',
    ],
    // A refusal stays between only_me and my_organization.
    [
      'the requester narrows a refused ticket',
      REJECTED,
      requester('only_me'),
      { ...REJECTED, visibility: 'only_me' },
      'visibility_changed',
      { from: 'my_organization', to: 'only_me' },
      null,
    ],
  ] as const)('%s', (_case, before, request, fields, type, data, audit) => {
    expect(changeVisibility(before, request)).toEqual({
      fields,
      event: { type, data, isPublic: false },
      audit,
    });
  });

  it.each([
    ['the current value', MY_ORGANIZATION, team('my_organization')],
    ['the requester’s current value', ONLY_ME, requester('only_me')],
    [
      'a second request of a pending one',
      { ...MY_ORGANIZATION, sharingRequest: 'pending' },
      requester('all_customers'),
    ],
  ] as const)('changes nothing for %s (Q12)', (_case, before, request) => {
    expect(changeVisibility(before, request)).toEqual({ fields: null, event: null, audit: null });
  });
});

describe('sharing decisions', () => {
  it('shares an approved request with one public event', () => {
    expect(approveSharing({ ...MY_ORGANIZATION, sharingRequest: 'pending' })).toEqual({
      fields: { visibility: 'all_customers', sharingRequest: 'none' },
      event: {
        type: 'sharing_approved',
        data: { from: 'my_organization', to: 'all_customers' },
        isPublic: true,
      },
      audit: 'ticket.sharing_approved',
    });
  });

  it('keeps the visibility of a refused request and leaves the reason out of the event', () => {
    expect(rejectSharing({ ...ONLY_ME, sharingRequest: 'pending' })).toEqual({
      fields: { ...ONLY_ME, sharingRequest: 'rejected' },
      event: { type: 'sharing_rejected', data: null, isPublic: false },
      audit: 'ticket.sharing_rejected',
    });
  });
});

describe('initialVisibility', () => {
  it.each([
    ['only_me', true, ONLY_ME],
    ['my_organization', true, MY_ORGANIZATION],
    ['all_customers', true, { ...MY_ORGANIZATION, sharingRequest: 'pending' }],
    ['all_customers', false, { ...ONLY_ME, sharingRequest: 'pending' }],
  ] as const)('creates %s (organization may be chosen: %s) as %o', (requested, may, fields) => {
    expect(initialVisibility(requested, may)).toEqual(fields);
  });
});
