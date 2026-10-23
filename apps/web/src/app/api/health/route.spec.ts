import { describe, expect, it } from 'vitest';
import { GET } from './route.js';

describe('GET /api/health', () => {
  it('reports liveness', async () => {
    const res = GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
