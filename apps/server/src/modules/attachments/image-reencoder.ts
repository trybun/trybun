import { Injectable } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';
import {
  exceedsDecodingLimit,
  type ImageEncoding,
  MAX_DECODED_PIXELS,
} from './domain/image-encoding.js';

/** A re-encoded image, or why it cannot be released (attachment serving item 2, Q22). */
export type ReencodedImage =
  { outcome: 'reencoded'; content: Buffer } | { outcome: 'too_large' | 'undecodable' };

function encoder(image: Sharp, encoding: ImageEncoding): Sharp {
  switch (encoding.format) {
    case 'jpeg':
      return image.jpeg({ quality: encoding.quality });
    case 'png':
      return image.png();
    case 'gif':
      // The existing palette is reused, so the frames keep their colours.
      return image.gif();
    case 'webp':
      return encoding.lossless
        ? image.webp({ lossless: true })
        : image.webp({ quality: encoding.quality });
  }
}

/**
 * Strips the metadata of a clean raster image by re-encoding it into its own format with `sharp`
 * (ADR 0008): oriented by its EXIF orientation first, so a photo keeps its orientation, then
 * written without EXIF, XMP, IPTC or ICC data. Only the Worker decodes images. One image at a
 * time on one thread, without the decoder cache, at most 40 megapixels over all frames (Q22).
 */
@Injectable()
export class ImageReencoder {
  constructor() {
    sharp.concurrency(1);
    sharp.cache(false);
  }

  async reencode(content: Buffer, encoding: ImageEncoding): Promise<ReencodedImage> {
    try {
      // The header only: `height` is the height of one frame and `pages` their number, checked
      // before any frame is decoded.
      const { width, height, pages } = await sharp(content, { limitInputPixels: false }).metadata();
      if (exceedsDecodingLimit({ width, height, pages })) {
        return { outcome: 'too_large' };
      }
      const image = sharp(content, {
        autoOrient: true,
        animated: encoding.isAnimated,
        limitInputPixels: MAX_DECODED_PIXELS,
      });
      return { outcome: 'reencoded', content: await encoder(image, encoding).toBuffer() };
    } catch {
      // libvips refused the content: a damaged or truncated file, or one beyond the limit.
      return { outcome: 'undecodable' };
    }
  }
}
