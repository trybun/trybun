import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// The local environment keeps one `.env` in the repository root (§15.12); containers pass
// variables directly, so the file is optional.
loadEnvConfig(join(import.meta.dirname, '../..'), undefined, undefined, true);

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  transpilePackages: ['@trybun/contracts', '@trybun/ui'],
};

export default nextConfig;
