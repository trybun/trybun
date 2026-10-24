import { describe, expect, it } from 'vitest';
import { ApiError } from '../errors/api-error.js';
import { dataOf } from './api-client.js';

describe('dataOf', () => {
  it('returns the data of a successful response', async () => {
    const data = { id: 'u1' };

    await expect(dataOf(Promise.resolve({ data, response: new Response() }))).resolves.toBe(data);
  });

  it('throws the ApiError of a failed response', async () => {
    const error = {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'request.not_found',
    };

    const result = dataOf(
      Promise.resolve({ error, response: new Response(null, { status: 404 }) }),
    );

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 404, code: 'request.not_found' });
  });
});
