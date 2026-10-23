// Simulated external HTTP services (§18.7). Tests add their handlers with `mswServer.use()`.
import { setupServer } from 'msw/node';

export const mswServer = setupServer();
