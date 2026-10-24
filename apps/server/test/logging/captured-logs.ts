import type { DestinationStream } from 'pino';

/**
 * A log destination that keeps the JSON lines, for tests that check what is logged. nestjs-pino
 * builds its logger once per process, so a test file uses one destination for all its apps.
 */
export function captureLogs(): DestinationStream & { lines: Record<string, unknown>[] } {
  const lines: Record<string, unknown>[] = [];
  return {
    lines,
    write: (line: string) => {
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
  };
}
