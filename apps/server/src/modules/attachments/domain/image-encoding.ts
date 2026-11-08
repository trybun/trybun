/**
 * The decoding limit of an image (Q22): 40 megapixels counted over all frames, so decoding stays
 * within the Worker's 512 MB (`mem_limit` of `x-server`).
 */
export const MAX_DECODED_PIXELS = 40_000_000;

/** The JPEG and lossy WebP quality of a re-encoded image: high, as ADR 0008 asks. */
export const LOSSY_QUALITY = 90;

/**
 * The dimensions of an image as `sharp` reports them without reading its frames: `height` is the
 * height of one frame, `pages` the number of frames of an animation.
 */
export interface ImageDimensions {
  width: number;
  height: number;
  pages?: number | undefined;
}

/** The pixels of every frame together. */
export function decodedPixels({ width, height, pages }: ImageDimensions): number {
  return width * height * Math.max(1, pages ?? 1);
}

/** Whether decoding the image would exceed the limit (Q22); it is then rejected. */
export function exceedsDecodingLimit(dimensions: ImageDimensions): boolean {
  return decodedPixels(dimensions) > MAX_DECODED_PIXELS;
}

/**
 * How a clean raster image is re-encoded into its own format (ADR 0008): JPEG and lossy WebP at
 * high quality, PNG, GIF and lossless WebP without loss; GIF and WebP with all their frames.
 */
export type ImageEncoding =
  | { format: 'jpeg'; quality: number; isAnimated: false }
  | { format: 'png'; isAnimated: false }
  | { format: 'gif'; isAnimated: true }
  | { format: 'webp'; lossless: boolean; quality: number; isAnimated: true };

/**
 * The encoding of an image of an allowlisted raster type, from its content type and its bytes
 * (which tell lossless from lossy WebP); `undefined` for every other type, which is copied as it
 * is.
 */
export function imageEncodingOf(
  contentType: string,
  content: Uint8Array,
): ImageEncoding | undefined {
  switch (contentType) {
    case 'image/jpeg':
      return { format: 'jpeg', quality: LOSSY_QUALITY, isAnimated: false };
    case 'image/png':
      return { format: 'png', isAnimated: false };
    case 'image/gif':
      return { format: 'gif', isAnimated: true };
    case 'image/webp':
      return {
        format: 'webp',
        lossless: isLosslessWebp(content),
        quality: LOSSY_QUALITY,
        isAnimated: true,
      };
    default:
      return undefined;
  }
}

const RIFF_HEADER_SIZE = 12;
const CHUNK_HEADER_SIZE = 8;
/** An `ANMF` frame starts with 16 bytes of position, size, duration and flags. */
const FRAME_HEADER_SIZE = 16;

function fourCc(content: Uint8Array, offset: number): string {
  return String.fromCharCode(...content.subarray(offset, offset + 4));
}

/** The bitstream chunks (`VP8 ` lossy, `VP8L` lossless) of a run of RIFF chunks. */
function bitstreamsOf(content: Uint8Array, start: number, end: number): string[] {
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const found: string[] = [];
  let offset = start;
  while (offset + CHUNK_HEADER_SIZE <= end) {
    const type = fourCc(content, offset);
    const size = view.getUint32(offset + 4, true);
    const payload = offset + CHUNK_HEADER_SIZE;
    if (type === 'VP8 ' || type === 'VP8L') {
      found.push(type);
    } else if (type === 'ANMF') {
      found.push(
        ...bitstreamsOf(content, payload + FRAME_HEADER_SIZE, Math.min(end, payload + size)),
      );
    }
    // Chunks are padded to an even size.
    offset = payload + size + (size % 2);
  }
  return found;
}

/**
 * Whether a WebP file is lossless: every frame is a `VP8L` bitstream (WebP container
 * specification). A lossy frame anywhere, or a file that cannot be read, counts as lossy.
 */
export function isLosslessWebp(content: Uint8Array): boolean {
  if (
    content.length < RIFF_HEADER_SIZE ||
    fourCc(content, 0) !== 'RIFF' ||
    fourCc(content, 8) !== 'WEBP'
  ) {
    return false;
  }
  const bitstreams = bitstreamsOf(content, RIFF_HEADER_SIZE, content.length);
  return bitstreams.length > 0 && bitstreams.every((type) => type === 'VP8L');
}
