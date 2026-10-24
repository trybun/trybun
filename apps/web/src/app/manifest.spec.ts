import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './manifest.js';

const PUBLIC_DIR = join(import.meta.dirname, '../../public');

describe('web app manifest', () => {
  it('lets the application be added to the home screen with the brand icons', () => {
    const { display, start_url: startUrl, icons = [] } = manifest();

    expect({ display, startUrl }).toEqual({ display: 'standalone', startUrl: '/' });
    expect(icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', 'any']);
    for (const icon of icons) {
      expect(existsSync(join(PUBLIC_DIR, icon.src))).toBe(true);
    }
  });
});
