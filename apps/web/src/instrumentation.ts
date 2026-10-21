export async function register(): Promise<void> {
  // Next.js convention: Node.js-only code is imported only in the Node.js runtime.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./instrumentation-node.js');
    validateEnv();
  }
}
