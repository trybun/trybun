// Simulated external HTTP services (§18.7). Tests add their handlers with `mswServer.use()`.
import { http, passthrough } from 'msw';
import { setupServer } from 'msw/node';

/** Requests of supertest to the application under test, which listens on a loopback address. */
const applicationUnderTest = http.all(/^http:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?\//, () =>
  passthrough(),
);

export const mswServer = setupServer(applicationUnderTest);
