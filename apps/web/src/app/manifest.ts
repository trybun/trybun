import type { MetadataRoute } from 'next';

/** The web app manifest with the brand icons, to add Trybun to the home screen (§2.9). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trybun',
    short_name: 'Trybun',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/trybun-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/trybun-icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/trybun-icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
