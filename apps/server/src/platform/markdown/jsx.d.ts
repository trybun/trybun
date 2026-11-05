// The global JSX namespace that hast-util-to-jsx-runtime types its result with. React 19's types
// declare JSX only as `React.JSX`, and the server compiles no JSX of its own (§18.3).
import type { JSX as ReactJsx } from 'react';

declare global {
  namespace JSX {
    type Element = ReactJsx.Element;
    type ElementClass = ReactJsx.ElementClass;
    type IntrinsicElements = ReactJsx.IntrinsicElements;
  }
}
