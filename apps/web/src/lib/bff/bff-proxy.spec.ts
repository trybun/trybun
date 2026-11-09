import { gzipSync } from 'node:zlib';
import { http, HttpResponse } from 'msw';
import { NextRequest } from 'next/server.js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mswServer } from '../../../test/msw/server.js';

vi.mock('server-only', () => ({}));

const { createBffProxy } = await import('./bff-proxy.js');

const API_URL = 'http://api.test';
const ORIGIN = 'https://trybun.test';
const CONTENT = 'The content of a log file.\n';

const proxy = createBffProxy({
  apiUrl: API_URL,
  origin: ORIGIN,
  sessionCookieName: 'session',
  accessTokens: { forSession: () => Promise.resolve(undefined) },
});

beforeAll(() => mswServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe('the response headers of the BFF (§14.4)', () => {
  const path = '/api/v1/attachments/0199a3f0-0000-7000-8000-000000000001/content';

  it('keeps the length of a body without an encoding, so a download shows its progress', async () => {
    const body = Buffer.from(CONTENT);
    mswServer.use(
      http.get(`${API_URL}${path}`, () =>
        HttpResponse.arrayBuffer(
          body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
          {
            headers: { 'content-type': 'text/plain', 'content-length': String(body.length) },
          },
        ),
      ),
    );

    const res = await proxy(new NextRequest(`${ORIGIN}${path}`));

    expect(res.headers.get('content-length')).toBe(String(body.length));
    await expect(res.text()).resolves.toBe(CONTENT);
  });

  it('drops the encoding and the length of a body that fetch has decoded', async () => {
    const body = gzipSync(CONTENT);
    mswServer.use(
      http.get(`${API_URL}${path}`, () =>
        HttpResponse.arrayBuffer(
          body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
          {
            headers: {
              'content-type': 'text/plain',
              'content-encoding': 'gzip',
              'content-length': String(body.length),
            },
          },
        ),
      ),
    );

    const res = await proxy(new NextRequest(`${ORIGIN}${path}`));

    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('content-length')).toBeNull();
    await expect(res.text()).resolves.toBe(CONTENT);
  });
});
