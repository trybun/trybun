import { describe, expect, it } from 'vitest';
import {
  decodedPixels,
  exceedsDecodingLimit,
  imageEncodingOf,
  isLosslessWebp,
  LOSSY_QUALITY,
  MAX_DECODED_PIXELS,
} from './image-encoding.js';

/** A RIFF chunk: its type, size (little endian) and payload padded to an even size. */
function chunk(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(type, 0, 'latin1');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload, Buffer.alloc(payload.length % 2)]);
}

/** A WebP container of the given chunks (WebP container specification). */
function webp(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...chunks]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

/** An animation frame: 16 bytes of frame header, then its chunks. */
function frame(...chunks: Buffer[]): Buffer {
  return chunk('ANMF', Buffer.concat([Buffer.alloc(16), ...chunks]));
}

const LOSSY = chunk('VP8 ', Buffer.alloc(5));
const LOSSLESS = chunk('VP8L', Buffer.alloc(5));
const EXTENDED = chunk('VP8X', Buffer.alloc(10));

describe('image decoding limit (Q22)', () => {
  it('counts the pixels of every frame', () => {
    expect(decodedPixels({ width: 1000, height: 500 })).toBe(500_000);
    expect(decodedPixels({ width: 1000, height: 500, pages: 30 })).toBe(15_000_000);
  });

  it.each([
    ['a still image at the limit', { width: 8000, height: 5000 }, false],
    ['a still image above the limit', { width: 8000, height: 5001 }, true],
    [
      'an animation whose frames together exceed it',
      { width: 2000, height: 1000, pages: 21 },
      true,
    ],
    ['an animation within it', { width: 2000, height: 1000, pages: 20 }, false],
  ])('%s', (_, dimensions, exceeds) => {
    expect(exceedsDecodingLimit(dimensions)).toBe(exceeds);
  });

  it('is 40 megapixels', () => {
    expect(MAX_DECODED_PIXELS).toBe(40_000_000);
  });
});

describe('re-encoding of raster images (ADR 0008)', () => {
  it('re-encodes JPEG at high quality and PNG without loss, first frame only', () => {
    expect(imageEncodingOf('image/jpeg', Buffer.alloc(0))).toEqual({
      format: 'jpeg',
      quality: LOSSY_QUALITY,
      isAnimated: false,
    });
    expect(imageEncodingOf('image/png', Buffer.alloc(0))).toEqual({
      format: 'png',
      isAnimated: false,
    });
  });

  it('keeps every frame of GIF and WebP', () => {
    expect(imageEncodingOf('image/gif', Buffer.alloc(0))).toEqual({
      format: 'gif',
      isAnimated: true,
    });
    expect(imageEncodingOf('image/webp', webp(LOSSLESS))).toEqual({
      format: 'webp',
      lossless: true,
      quality: LOSSY_QUALITY,
      isAnimated: true,
    });
    expect(imageEncodingOf('image/webp', webp(LOSSY))).toMatchObject({ lossless: false });
  });

  it('copies every other type', () => {
    expect(imageEncodingOf('application/pdf', Buffer.alloc(0))).toBeUndefined();
    expect(imageEncodingOf('text/plain; charset=utf-8', Buffer.alloc(0))).toBeUndefined();
  });
});

describe('lossless WebP', () => {
  it.each([
    ['a simple lossless file', webp(LOSSLESS), true],
    ['a simple lossy file', webp(LOSSY), false],
    [
      'an extended lossless file with metadata',
      webp(EXTENDED, LOSSLESS, chunk('EXIF', Buffer.alloc(3))),
      true,
    ],
    [
      'an extended lossy file with alpha',
      webp(EXTENDED, chunk('ALPH', Buffer.alloc(4)), LOSSY),
      false,
    ],
    [
      'an animation of lossless frames',
      webp(EXTENDED, chunk('ANIM', Buffer.alloc(6)), frame(LOSSLESS), frame(LOSSLESS)),
      true,
    ],
    ['an animation with one lossy frame', webp(EXTENDED, frame(LOSSLESS), frame(LOSSY)), false],
    ['a file without a bitstream', webp(EXTENDED), false],
    ['a file that is no WebP', Buffer.from('not an image'), false],
    ['a truncated file', webp(LOSSLESS).subarray(0, 14), false],
  ])('%s: %s', (_, content, isLossless) => {
    expect(isLosslessWebp(content)).toBe(isLossless);
  });
});
