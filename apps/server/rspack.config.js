// Bundles the API, the Worker and the command line (§14.6, ADR 0003): the @trybun/* workspace packages are
// inlined from their TypeScript source, npm dependencies stay external.
import nodeExternals from 'webpack-node-externals';

const WORKSPACE_PACKAGES = /^@trybun\//;

/**
 * @param {import('@rspack/core').RspackOptions} options defaults of the NestJS CLI; their first
 *   external is `webpack-node-externals` without an allowlist, replaced below
 */
export default function rspackConfig(options) {
  const [, ...builtinExternals] = options.externals;
  const external = (modulesDir) =>
    nodeExternals({ importType: 'module', allowlist: [WORKSPACE_PACKAGES], modulesDir });
  return {
    ...options,
    entry: {
      main: './src/main.ts',
      worker: './src/worker.ts',
      cli: './src/cli.ts',
    },
    output: {
      ...options.output,
      filename: '[name].js',
    },
    externals: [external('node_modules'), external('../../node_modules'), ...builtinExternals],
  };
}
