import { describe, expect, it } from 'vitest';
import {
  findComposeProblems,
  findDockerfileProblems,
  findTestImageProblems,
  findWorkflowProblems,
  pinnedImages,
} from './check-supply-chain.js';

const SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const DIGEST = 'sha256:' + 'a'.repeat(64);

describe('findWorkflowProblems', () => {
  const WORKFLOW = '.github/workflows/ci.yml';

  it('accepts pull_request workflows with pinned and local actions', () => {
    const content = `
on:
  pull_request:
  push:
    branches: [main]
jobs:
  lint:
    steps:
      - uses: actions/checkout@${SHA} # v7.0.1
      - uses: ./.github/actions/setup
      - uses: docker://alpine:3@${DIGEST}
`;
    expect(findWorkflowProblems(WORKFLOW, content)).toEqual([]);
  });

  it.each(['pull_request_target', 'workflow_run'])('reports the trigger %s', (trigger) => {
    expect(findWorkflowProblems(WORKFLOW, `on:\n  ${trigger}:\n`)).toEqual([
      `${WORKFLOW}:2: ${trigger} runs with the repository's secrets for events of forks; use pull_request (§16.5)`,
    ]);
    expect(findWorkflowProblems(WORKFLOW, `on: [push, ${trigger}]\n`)).toHaveLength(1);
  });

  it('ignores triggers named in comments', () => {
    expect(
      findWorkflowProblems(WORKFLOW, 'on:\n  pull_request: # never pull_request_target\n'),
    ).toEqual([]);
  });

  it('reports actions pinned to a tag, a branch or a short SHA', () => {
    const content = `
steps:
  - uses: actions/checkout@v7
  - uses: 'pnpm/action-setup@main'
  - uses: actions/setup-node@949feb2
  - uses: docker://alpine:3
`;
    expect(findWorkflowProblems(WORKFLOW, content)).toEqual([
      `${WORKFLOW}:3: actions/checkout@v7 is not pinned to a full commit SHA (§2.10)`,
      `${WORKFLOW}:4: pnpm/action-setup@main is not pinned to a full commit SHA (§2.10)`,
      `${WORKFLOW}:5: actions/setup-node@949feb2 is not pinned to a full commit SHA (§2.10)`,
      `${WORKFLOW}:6: docker://alpine:3 is not pinned to a full commit SHA (§2.10)`,
    ]);
  });
});

describe('findDockerfileProblems', () => {
  const DOCKERFILE = 'docker/web/Dockerfile';

  it('accepts pinned base images and earlier stages', () => {
    const content = `FROM node:24-slim@${DIGEST} AS build
RUN pnpm build
FROM --platform=linux/amd64 node:24-slim@${DIGEST}
COPY --from=build /out .
FROM build AS test
FROM scratch
`;
    expect(findDockerfileProblems(DOCKERFILE, content)).toEqual([]);
  });

  it('reports images without a digest', () => {
    expect(findDockerfileProblems(DOCKERFILE, 'FROM node:24-slim AS build\n')).toEqual([
      `${DOCKERFILE}:1: node:24-slim is not pinned to a digest (§2.10)`,
    ]);
  });

  it('reports images from variables, which Dependabot does not update', () => {
    const content = `ARG NODE_IMAGE=node:24-slim@${DIGEST}\nFROM \${NODE_IMAGE}\n`;
    expect(findDockerfileProblems(DOCKERFILE, content)).toEqual([
      `${DOCKERFILE}:2: \${NODE_IMAGE} is a variable; write the pinned image in the FROM line (§2.10)`,
    ]);
  });
});

describe('findComposeProblems', () => {
  it('accepts pinned images and the images of this repository', () => {
    const content = `services:
  web:
    image: ghcr.io/trybun/web:\${TRYBUN_VERSION:-latest}
  valkey:
    image: valkey/valkey:9.1.2-alpine@${DIGEST} # pinned
`;
    expect(findComposeProblems('compose.yaml', content)).toEqual([]);
  });

  it('reports third-party images without a digest', () => {
    expect(findComposeProblems('compose.yaml', 'services:\n  c:\n    image: caddy:2\n')).toEqual([
      'compose.yaml:3: caddy:2 is not pinned to a digest (§2.10)',
    ]);
  });
});

describe('findTestImageProblems', () => {
  const VALKEY = `valkey/valkey:9.1.2-alpine@${DIGEST}`;
  const TEST = 'apps/server/test/setup/containers.ts';

  it('finds the pinned image references of a file', () => {
    expect(
      pinnedImages(`const A = '${VALKEY}';\nconst B = "quay.io/keycloak/keycloak@${DIGEST}";`),
    ).toEqual([VALKEY, `quay.io/keycloak/keycloak@${DIGEST}`]);
  });

  it('accepts the images of the Compose files', () => {
    expect(findTestImageProblems(TEST, `const IMAGE = '${VALKEY}';`, new Set([VALKEY]))).toEqual(
      [],
    );
  });

  it('reports images that differ from the Compose files', () => {
    const outdated = `valkey/valkey:9.0.0-alpine@sha256:${'b'.repeat(64)}`;
    expect(findTestImageProblems(TEST, `const IMAGE = '${outdated}';`, new Set([VALKEY]))).toEqual([
      `${TEST}: ${outdated} is not the image of the Compose files (§2.10)`,
    ]);
  });
});
