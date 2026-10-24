import 'server-only';
import { QueryClient } from '@tanstack/react-query';
import { cache } from 'react';
import { QUERY_CLIENT_CONFIG } from './query-client-config.js';

/**
 * The query client of one request on the server, shared by its layouts and pages: they prefetch
 * into it, and its dehydrated state is passed to the browser with `HydrationBoundary` (§18.5).
 */
export const getServerQueryClient = cache(() => new QueryClient(QUERY_CLIENT_CONFIG));
