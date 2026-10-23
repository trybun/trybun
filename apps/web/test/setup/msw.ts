// Set-up file of the integration tests: a request to an external service without a handler fails the test.
import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from '../msw/server.js';

beforeAll(() => mswServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
