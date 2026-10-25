import { config } from 'zod/v4/core';

// The strict Content Security Policy forbids `eval` (§13.5): Zod validates without compiling its
// schemas with `new Function`, and does not probe for it.
config({ jitless: true });
