import { describe, expect, it } from 'vitest';
import { AppError } from '../../../platform/errors/app-error.js';
import {
  assertContentAvailable,
  type ConditionalHeaders,
  contentDisposition,
  contentETag,
  isNotModified,
} from './content-response.js';

const ID = '0190f2f4-7c1e-7000-8000-000000000001';
const ETAG = contentETag(ID);

describe('content of an attachment (attachment serving item 3)', () => {
  it('is available only after the scan', () => {
    expect(() => assertContentAvailable('available')).not.toThrow();
  });

  it.each([
    ['quarantine', 'attachment.not_available'],
    ['infected', 'attachment.removed'],
    ['rejected', 'attachment.removed'],
  ] as const)('answers %s with %s', (status, code) => {
    expect(() => assertContentAvailable(status)).toThrow(expect.objectContaining({ code }));
    expect(() => assertContentAvailable(status)).toThrow(AppError);
  });
});

describe('isNotModified (RFC 9110, section 13.1.2)', () => {
  const headers = (overrides: Partial<ConditionalHeaders>): ConditionalHeaders => ({
    ifNoneMatch: undefined,
    ifModifiedSince: undefined,
    cacheControl: undefined,
    ...overrides,
  });

  it.each([
    ['the ETag', { ifNoneMatch: ETAG }, true],
    ['the weak ETag in a list', { ifNoneMatch: `"other", W/${ETAG}` }, true],
    ['any ETag', { ifNoneMatch: '*' }, true],
    ['no condition', {}, false],
    ['another ETag', { ifNoneMatch: '"other"' }, false],
    ['the ETag without a stored answer', { ifNoneMatch: ETAG, cacheControl: 'no-cache' }, false],
    ['the ETag with max-age', { ifNoneMatch: ETAG, cacheControl: 'max-age=0' }, true],
    [
      'the ETag with a date',
      { ifNoneMatch: ETAG, ifModifiedSince: 'Thu, 05 Nov 2026 10:00:00 GMT' },
      false,
    ],
  ])('for %s: %s', (_case, overrides, expected) => {
    expect(isNotModified(headers(overrides), ETAG)).toBe(expected);
  });
});

describe('contentDisposition (§13.3, RFC 8187)', () => {
  it.each([
    [
      'an image inline',
      'screenshot.png',
      true,
      `inline; filename="screenshot.png"; filename*=UTF-8''screenshot.png`,
    ],
    [
      'another file as a download',
      'report.pdf',
      false,
      `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
    ],
    [
      'a name outside ASCII',
      'Zażółć gęślą.txt',
      false,
      `attachment; filename="Za____ g__l_.txt"; filename*=UTF-8''Za%C5%BC%C3%B3%C5%82%C4%87%20g%C4%99%C5%9Bl%C4%85.txt`,
    ],
    [
      'quotes, a backslash and the characters RFC 8187 encodes',
      `a"b\\c'(d)*.log`,
      false,
      `attachment; filename="a_b_c'(d)*.log"; filename*=UTF-8''a%22b%5Cc%27%28d%29%2A.log`,
    ],
  ])('sends %s', (_case, fileName, isImage, expected) => {
    expect(contentDisposition(fileName, isImage)).toBe(expected);
  });
});
