// The reference widths of §2.9: phone from 360 px, tablet from 768 px, desktop from 1280 px.
export const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '360px', height: '740px' }, type: 'mobile' },
  tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
  desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
} as const;

/** The `globals` of a story shown in a viewport: `{ ...Overview, globals: viewport('phone') }`. */
export function viewport(name: keyof typeof VIEWPORTS) {
  return { viewport: { value: name, isRotated: false } };
}
