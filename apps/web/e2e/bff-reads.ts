import { expect, type Page, type Request } from '@playwright/test';

/** The path prefix of the API behind the BFF (§14.4): the only API requests a browser makes. */
const BFF_API_PATH = '/api/v1/';

/**
 * The reads (`GET`) of one API path that a page makes through the BFF (§14.4), recorded from the
 * page's `request` events. Requests of a separate `APIRequestContext`, which seed the data, are
 * not seen. A regression that reads the same data once per row instead of once per page shows up
 * as more reads; reads happen between the web server and the API for a server-rendered page, so
 * only the reads after the first paint are counted.
 */
export class BffReads {
  private readonly reads: URL[] = [];
  private readonly inFlight = new Set<Request>();
  private lastActivity = Date.now();

  constructor(page: Page, path: string) {
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith(BFF_API_PATH)) {
        return;
      }
      this.inFlight.add(request);
      this.lastActivity = Date.now();
      if (request.method() === 'GET' && url.pathname === path) {
        this.reads.push(url);
      }
    });
    const settled = (request: Request) => {
      if (this.inFlight.delete(request)) {
        this.lastActivity = Date.now();
      }
    };
    page.on('requestfinished', settled);
    page.on('requestfailed', settled);
  }

  /**
   * Waits until no API request is in flight and none started for `quietMs`: a read the page
   * starts after its content showed – a row querying its own data after it rendered – is then
   * counted before the test checks the count.
   */
  async settle(quietMs = 500): Promise<void> {
    await expect
      .poll(() => this.inFlight.size === 0 && Date.now() - this.lastActivity >= quietMs, {
        message: `no API request through the BFF for ${quietMs} ms`,
        intervals: [100],
      })
      .toBe(true);
  }

  /** Forgets the reads so far, so the next count covers one step of the test. */
  reset(): void {
    this.reads.length = 0;
  }

  /** The number of `userId` values of each read since the last reset, in the order of the reads. */
  accountsPerRead(): number[] {
    return this.reads.map((url) => url.searchParams.getAll('userId').length);
  }
}
