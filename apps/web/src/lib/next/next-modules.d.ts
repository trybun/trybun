// Entry points of Next.js imported by their documented names, which the compiler of Next.js
// matches literally (the font loader transforms only `next/font/google`). Under `nodenext`,
// TypeScript resolves them only with an extension and types the default export of these CommonJS
// modules as the whole module; these declarations give them the types of their implementations.

declare module 'next/font/google' {
  export * from 'next/dist/compiled/@next/font/dist/google/index.js';
}

declare module 'next/image' {
  export * from 'next/dist/shared/lib/image-external.js';
  const Image: (typeof import('next/dist/shared/lib/image-external.js'))['default'];
  export default Image;
}

declare module 'next/link' {
  export * from 'next/dist/client/link.js';
  const Link: (typeof import('next/dist/client/link.js'))['default'];
  export default Link;
}
