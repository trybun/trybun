import { describe, expect, it } from 'vitest';
import { ERROR_HTTP_STATUS, errorCodeSchema } from './index.js';

describe('error codes', () => {
  it.each(errorCodeSchema.options)('%s has an HTTP error status', (code) => {
    expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
  });
});
