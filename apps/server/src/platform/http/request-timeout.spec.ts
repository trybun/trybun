import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { applyRequestTimeout, REQUEST_TIMEOUT_MS } from './request-timeout.js';

describe('applyRequestTimeout', () => {
  it('lets the largest upload arrive at 0.5 Mbit/s (§13.3)', () => {
    const largestUploadBits = 100 * 1024 * 1024 * 8;
    expect((largestUploadBits / 500_000) * 1000).toBeLessThan(REQUEST_TIMEOUT_MS);
  });

  it('sets the request timeout and keeps the default headers timeout', () => {
    const server = createServer();
    const { headersTimeout } = server;

    applyRequestTimeout(server);

    expect(server.requestTimeout).toBe(REQUEST_TIMEOUT_MS);
    expect(server.headersTimeout).toBe(headersTimeout);
  });
});
