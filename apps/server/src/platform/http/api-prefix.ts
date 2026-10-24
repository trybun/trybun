/** Global prefix of the API; the BFF path `/api/v1/*` maps to it 1:1 (§14.4). */
export const API_PREFIX = 'api/v1';

/** Routes outside the global prefix: the health endpoints of the internal network (§17.2). */
export const UNPREFIXED_ROUTES = ['health', 'health/ready'];
