import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { assertVersionMatched, versionedUpdate } from './optimistic-locking.js';

describe('versionedUpdate', () => {
  it('matches the expected version and increments it', () => {
    expect(versionedUpdate({ id: 't1', version: 3 }, { title: 'New' })).toEqual({
      where: { id: 't1', version: 3 },
      data: { title: 'New', version: { increment: 1 } },
    });
  });
});

describe('assertVersionMatched', () => {
  it('accepts a changed row', () => {
    expect(() => assertVersionMatched({ count: 1 })).not.toThrow();
  });

  it('returns 412 when no row matched the version', () => {
    expect(() => assertVersionMatched({ count: 0 })).toThrow(
      new AppError('request.precondition_failed'),
    );
  });
});
