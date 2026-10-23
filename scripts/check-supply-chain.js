// Supply-chain checks of `pnpm lint` (§2.10, §16.5): workflows have no trigger that gives code of
// a fork access to secrets, GitHub Actions are pinned to a commit SHA, and container images are
// pinned to a digest where Dependabot can update them.
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKFLOWS = ['.github/workflows/*.{yml,yaml}', '.github/actions/*/action.{yml,yaml}'];
const DOCKERFILES = ['docker/**/Dockerfile'];
const COMPOSE_FILES = ['compose*.{yml,yaml}'];
const TEST_FILES = ['{apps,packages}/*/test/**/*.ts'];

/** Images built by this repository; they are versioned by its releases (§2.11). */
const OWN_IMAGES = 'ghcr.io/trybun/';

/**
 * Triggers that run in the context of the base repository, with its secrets, for events a fork
 * can cause (GitHub: "Keeping your GitHub Actions and workflows secure"). Pull requests use
 * `pull_request`, whose runs from forks get no secrets.
 */
const FORBIDDEN_TRIGGERS = /\b(pull_request_target|workflow_run)\b/;
const USES = /^\s*(?:-\s+)?uses:\s*['"]?([^\s'"#]+)/;
const PINNED_ACTION = /^[^@\s]+@[0-9a-f]{40}$/;
const DIGEST = /@sha256:[0-9a-f]{64}$/;
const FROM = /^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i;
const IMAGE = /^\s*image:\s*['"]?([^\s'"#]+)/;
const PINNED_IMAGE_LITERAL = /['"`]([\w.-]+(?:\/[\w.-]+)*(?::[\w.-]+)?@sha256:[0-9a-f]{64})['"`]/g;

/** The lines of a YAML file with their line numbers, without comments. */
function yamlLines(content) {
  return content
    .split('\n')
    .map((text, index) => ({ text: text.replace(/(^|\s)#.*$/, ''), line: index + 1 }));
}

/**
 * Forbidden triggers and actions not pinned to a commit SHA in a workflow or composite action.
 * @param {string} path path of the file, relative to the repository root
 * @param {string} content
 * @returns {string[]} one message per problem
 */
export function findWorkflowProblems(path, content) {
  const problems = [];
  for (const { text, line } of yamlLines(content)) {
    const trigger = FORBIDDEN_TRIGGERS.exec(text)?.[1];
    if (trigger) {
      problems.push(
        `${path}:${line}: ${trigger} runs with the repository's secrets for events of forks; use pull_request (§16.5)`,
      );
    }
    const action = USES.exec(text)?.[1];
    if (
      action &&
      !action.startsWith('./') &&
      !(action.startsWith('docker://') && DIGEST.test(action)) &&
      !PINNED_ACTION.test(action)
    ) {
      problems.push(`${path}:${line}: ${action} is not pinned to a full commit SHA (§2.10)`);
    }
  }
  return problems;
}

/**
 * Base images of a Dockerfile not pinned to a digest in the `FROM` line itself; Dependabot does
 * not read images from `ARG` values.
 * @param {string} path
 * @param {string} content
 * @returns {string[]}
 */
export function findDockerfileProblems(path, content) {
  const stages = new Set(['scratch']);
  const problems = [];
  content.split('\n').forEach((text, index) => {
    const match = FROM.exec(text.trim());
    if (!match) {
      return;
    }
    const [, image, stage] = match;
    if (image.includes('$')) {
      problems.push(
        `${path}:${index + 1}: ${image} is a variable; write the pinned image in the FROM line (§2.10)`,
      );
    } else if (!stages.has(image.toLowerCase()) && !DIGEST.test(image)) {
      problems.push(`${path}:${index + 1}: ${image} is not pinned to a digest (§2.10)`);
    }
    if (stage) {
      stages.add(stage.toLowerCase());
    }
  });
  return problems;
}

/**
 * Third-party images of a Compose file not pinned to a digest.
 * @param {string} path
 * @param {string} content
 * @returns {string[]}
 */
export function findComposeProblems(path, content) {
  const problems = [];
  for (const { text, line } of yamlLines(content)) {
    const image = IMAGE.exec(text)?.[1];
    if (image && !image.startsWith(OWN_IMAGES) && !DIGEST.test(image)) {
      problems.push(`${path}:${line}: ${image} is not pinned to a digest (§2.10)`);
    }
  }
  return problems;
}

/** The digest-pinned image references of a file. */
export function pinnedImages(content) {
  return [...content.matchAll(PINNED_IMAGE_LITERAL)].map(([, image]) => image);
}

/**
 * Images of test code that differ from the Compose files. Dependabot updates only the Compose
 * files, so the tests use the same references.
 * @param {string} path
 * @param {string} content
 * @param {Set<string>} composeImages image references of the Compose files
 * @returns {string[]}
 */
export function findTestImageProblems(path, content, composeImages) {
  return pinnedImages(content)
    .filter((image) => !composeImages.has(image))
    .map((image) => `${path}: ${image} is not the image of the Compose files (§2.10)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = relative(process.cwd(), join(dirname(fileURLToPath(import.meta.url)), '..')) || '.';
  const files = (patterns) =>
    globSync(patterns, { cwd: root, exclude: ['**/node_modules/**'] }).sort();
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const composeImages = new Set(
    files(COMPOSE_FILES).flatMap((path) =>
      yamlLines(read(path)).flatMap(({ text }) => IMAGE.exec(text)?.[1] ?? []),
    ),
  );
  const problems = [
    ...files(WORKFLOWS).flatMap((path) => findWorkflowProblems(path, read(path))),
    ...files(DOCKERFILES).flatMap((path) => findDockerfileProblems(path, read(path))),
    ...files(COMPOSE_FILES).flatMap((path) => findComposeProblems(path, read(path))),
    ...files(TEST_FILES).flatMap((path) => findTestImageProblems(path, read(path), composeImages)),
  ];
  for (const problem of problems) {
    process.stderr.write(`${problem}\n`);
  }
  process.stdout.write(
    problems.length === 0
      ? 'Supply-chain checks: all passed.\n'
      : `Supply-chain checks: ${problems.length} problems.\n`,
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}
