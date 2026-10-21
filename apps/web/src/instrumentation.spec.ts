import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { register } = await import('./instrumentation.js');

describe('register', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('ends the Node.js server process on an invalid environment', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('TRYBUN_DOMAIN', '');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await register();

    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/TRYBUN_DOMAIN/));
  });

  it('starts the Node.js server process with a valid environment', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('TRYBUN_DOMAIN', 'trybun.example.com');
    vi.stubEnv('TRYBUN_API_URL', 'http://api:3001');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await register();

    expect(exit).not.toHaveBeenCalled();
  });

  it('skips the validation in the Edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    vi.stubEnv('TRYBUN_DOMAIN', '');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await register();

    expect(exit).not.toHaveBeenCalled();
  });
});
