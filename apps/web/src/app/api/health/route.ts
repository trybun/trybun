/** Liveness of the web application for the Compose health check (§15.9, §17.2). */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ status: 'ok' });
}
