// @vitest-environment jsdom
// TanStack Query sets no refetch intervals outside a browser.
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import type { AttachmentStatus } from '@trybun/contracts/attachments';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachmentResponse } from '../../../test/factories/attachment.factory.js';
import { createFakeApiClient } from '../../../test/dom/fake-api-client.js';
import type { ApiClient } from '../../lib/api-client/api-client.js';
import { attachmentPollInterval, attachmentsQueryOptions } from './queries.js';

const IDS = Array.from(
  { length: 3 },
  (_, index) => `0199a3f0-0000-7000-8000-0000000001${String(index + 1).padStart(2, '0')}`,
);

describe('attachmentPollInterval (Q7)', () => {
  it.each([
    [['quarantine'], 1, 3_000],
    [['quarantine'], 2, 6_000],
    [['quarantine'], 3, 12_000],
    [['quarantine'], 4, 24_000],
    [['quarantine'], 5, 30_000],
    [['quarantine'], 9, 30_000],
    [['available', 'quarantine'], 1, 3_000],
    [['available', 'infected', 'rejected'], 1, false],
    [[], 1, false],
  ] satisfies [AttachmentStatus[], number, number | false][])(
    'polls %j after %i answers every %s ms',
    (statuses, answers, interval) => {
      const attachments = statuses.map((status) => attachmentResponse({ status }));

      expect(attachmentPollInterval(attachments, answers)).toBe(interval);
    },
  );
});

describe('attachmentsQueryOptions', () => {
  const fake = createFakeApiClient();
  let statuses: AttachmentStatus[];

  beforeEach(() => {
    vi.useFakeTimers();
    statuses = [];
    fake.on('GET /api/v1/attachments', (init) => {
      const { id } = (init as { params: { query: { id: string[] } } }).params.query;
      return {
        data: {
          items: id.map((attachmentId) =>
            attachmentResponse({ id: attachmentId, status: statuses.shift() ?? 'available' }),
          ),
          nextCursor: null,
        },
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    fake.reset();
  });

  it('polls all drafts with one request, slower each time, until none is checked', async () => {
    const client = new QueryClient();
    // Three answers with one draft still in quarantine, then all are available.
    const answer: AttachmentStatus[] = ['available', 'available', 'quarantine'];
    statuses = [...answer, ...answer, ...answer];
    const observer = new QueryObserver(
      client,
      attachmentsQueryOptions(fake.client as unknown as ApiClient, IDS),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    const requests = () => fake.callsTo('GET /api/v1/attachments').length;

    await vi.advanceTimersByTimeAsync(0);
    expect(requests()).toBe(1);
    expect(fake.calls[0]?.init).toMatchObject({ params: { query: { id: IDS } } });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(requests()).toBe(2);
    await vi.advanceTimersByTimeAsync(5_999);
    expect(requests()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests()).toBe(3);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(requests()).toBe(4);
    expect(observer.getCurrentResult().data?.map(({ status }) => status)).toEqual([
      'available',
      'available',
      'available',
    ]);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(requests()).toBe(4);

    unsubscribe();
    client.clear();
  });

  it('reads more than 50 IDs in chunks of 50', async () => {
    const client = new QueryClient();
    const ids = Array.from(
      { length: 51 },
      (_, index) => `0199a3f0-0000-7000-8000-${String(index).padStart(12, '0')}`,
    );

    const attachments = await client.fetchQuery(
      attachmentsQueryOptions(fake.client as unknown as ApiClient, ids),
    );

    expect(attachments).toHaveLength(51);
    expect(
      fake.calls.map(
        ({ init }) => (init as { params: { query: { id: string[] } } }).params.query.id.length,
      ),
    ).toEqual([50, 1]);
    client.clear();
  });
});
