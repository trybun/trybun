// Checks the integration test set-up itself: real PostgreSQL and Valkey containers and MSW.
import { connect } from 'node:net';
import { http, HttpResponse } from 'msw';
import pg from 'pg';
import { describe, expect, inject, it } from 'vitest';
import { mswServer } from '../msw/server.js';

/** Sends one command to Valkey in the Redis protocol and returns the raw reply. */
function valkeyCommand(url: string, ...args: string[]): Promise<string> {
  const { hostname, port } = new URL(url);
  const request = `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('')}`;
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port), hostname, () => socket.write(request));
    socket.once('data', (reply) => {
      socket.end();
      resolve(reply.toString());
    });
    socket.once('error', reject);
  });
}

describe('integration test set-up', () => {
  it('runs queries against a real PostgreSQL', async () => {
    const client = new pg.Client({ connectionString: inject('databaseUrl') });
    await client.connect();
    try {
      const { rows } = await client.query<{ serverVersion: string }>(
        'SELECT current_setting($1) AS "serverVersion"',
        ['server_version'],
      );
      expect(rows[0]?.serverVersion).toMatch(/^18\./);
    } finally {
      await client.end();
    }
  });

  it('runs commands against a real Valkey', async () => {
    expect(await valkeyCommand(inject('valkeyUrl'), 'PING')).toBe('+PONG\r\n');
  });

  it('answers external HTTP requests with MSW handlers', async () => {
    mswServer.use(
      http.get('https://api.github.com/zen', () => HttpResponse.text('Keep it logically awesome.')),
    );

    const response = await fetch('https://api.github.com/zen');

    expect(await response.text()).toBe('Keep it logically awesome.');
  });

  it('rejects external HTTP requests without a handler', async () => {
    await expect(fetch('https://api.github.com/zen')).rejects.toThrow();
  });
});
