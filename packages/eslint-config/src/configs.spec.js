import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import { library } from './library.js';
import { nestjs } from './nestjs.js';
import { nextjs } from './nextjs.js';
import { react } from './react.js';

const FIXTURES = join(import.meta.dirname, '../test/fixtures');

// The checked rules need no type information, so the fixtures are linted without a project.
const withoutTypes = { ...tseslint.configs.disableTypeChecked, files: ['**/*.{ts,tsx}'] };

/** Rule IDs reported for `code` in the file `filePath` of the fixture `fixture`. */
async function ruleIds(config, fixture, filePath, code) {
  const eslint = new ESLint({
    cwd: join(FIXTURES, fixture),
    overrideConfigFile: true,
    overrideConfig: [...config, withoutTypes],
  });
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId ?? message.message);
}

/** Rule IDs reported for the existing fixture file `filePath`. */
async function ruleIdsOfFile(config, fixture, filePath) {
  const eslint = new ESLint({
    cwd: join(FIXTURES, fixture),
    overrideConfigFile: true,
    overrideConfig: [...config, withoutTypes],
  });
  const [result] = await eslint.lintFiles([filePath]);
  return result.messages.map((message) => message.ruleId ?? message.message);
}

/** Rule IDs reported with type information (the fixture's tsconfig.json) for `code`. */
async function typedRuleIds(config, fixture, filePath, code) {
  const cwd = join(FIXTURES, fixture);
  const file = join(cwd, filePath);
  await writeFile(file, code);
  try {
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [
        ...config,
        {
          languageOptions: {
            parserOptions: {
              projectService: false,
              project: './tsconfig.json',
              tsconfigRootDir: cwd,
            },
          },
        },
      ],
    });
    const [result] = await eslint.lintFiles([file]);
    return result.messages.map((message) => message.ruleId ?? message.message);
  } finally {
    await rm(file);
  }
}

const server = nestjs({
  allowedPackages: ['@trybun/contracts', '@trybun/i18n'],
  root: join(FIXTURES, 'server'),
});
const web = nextjs({
  allowedPackages: ['@trybun/contracts', '@trybun/i18n', '@trybun/ui'],
  root: join(FIXTURES, 'web'),
});
const ui = [...library({ allowedPackages: ['@trybun/i18n'] }), ...react];

describe('lint rules', () => {
  // The first type-aware lint builds the TypeScript program of the fixture, which typescript-eslint
  // then reuses; on a busy CI runner that alone can take longer than the timeout of a test. The
  // warm-up lints the file the tests use, so the program already contains it.
  beforeAll(async () => {
    await typedRuleIds(server, 'server', 'src/modules/tickets/naming-case.ts', 'export {};\n');
  }, 60_000);

  it.each([
    [
      'a cross-boundary import (ui → server)',
      ui,
      'ui',
      'src/components/button.tsx',
      "import { ApiModule } from '@trybun/server/api.module';\nexport const x = ApiModule;\n",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'an import of an application from contracts',
      library(),
      'contracts',
      'src/tickets/index.ts',
      "import { x } from '@trybun/web/lib';\nexport const y = x;\n",
      '@typescript-eslint/no-restricted-imports',
    ],
    [
      'NestJS in a domain file',
      server,
      'server',
      'src/modules/tickets/domain/status-transitions.ts',
      "import { Injectable } from '@nestjs/common';\nexport const x = Injectable;\n",
      'no-restricted-imports',
    ],
    [
      'Prisma in a domain file',
      server,
      'server',
      'src/modules/tickets/domain/status-transitions.ts',
      "import { Prisma } from '@prisma/client';\nexport const x = Prisma;\n",
      'no-restricted-imports',
    ],
    [
      'reading the clock in a domain file',
      server,
      'server',
      'src/modules/tickets/domain/sla.ts',
      'export const now = () => Date.now();\n',
      'no-restricted-syntax',
    ],
    [
      'Prisma in a controller',
      server,
      'server',
      'src/modules/tickets/tickets.controller.ts',
      "import { Prisma } from '@prisma/client';\nexport const x = Prisma;\n",
      'no-restricted-imports',
    ],
    [
      'a parameter without its schema',
      server,
      'server',
      'src/modules/tickets/tickets.controller.ts',
      "import { Body, Controller, Post } from '@nestjs/common';\n@Controller('tickets')\nexport class TicketsController {\n  @Post()\n  create(@Body() body: unknown) {\n    return body;\n  }\n}\n",
      'no-restricted-syntax',
    ],
    [
      'platform importing a feature module',
      server,
      'server',
      'src/platform/outbox/outbox.service.ts',
      "import { ticketsService } from '../../modules/tickets/tickets.service.js';\nexport const x = ticketsService;\n",
      'import-x/no-restricted-paths',
    ],
    [
      'process.env outside the configuration',
      server,
      'server',
      'src/modules/tickets/tickets.service.ts',
      'export const domain = process.env.TRYBUN_DOMAIN;\n',
      'no-restricted-properties',
    ],
    [
      'console',
      server,
      'server',
      'src/modules/tickets/tickets.service.ts',
      "console.log('x');\n",
      'no-console',
    ],
    [
      'a default export outside framework files',
      server,
      'server',
      'src/modules/tickets/tickets.service.ts',
      'export default class TicketsService {}\n',
      'import-x/no-default-export',
    ],
    [
      'a file name that is not kebab-case',
      server,
      'server',
      'src/modules/tickets/ticketsService.ts',
      'export const x = 1;\n',
      'check-file/filename-naming-convention',
    ],
    ...['Query', 'Param', 'MessageBody'].map((decorator) => [
      `@${decorator}() without its schema`,
      server,
      'server',
      'src/modules/tickets/tickets.gateway.ts',
      `import { ${decorator} } from '@nestjs/common';\nexport class TicketsGateway {\n  handle(@${decorator}() value: unknown) {\n    return value;\n  }\n}\n`,
      'no-restricted-syntax',
    ]),
    [
      'Prisma in a gateway',
      server,
      'server',
      'src/modules/tickets/tickets.gateway.ts',
      "import { Prisma } from '@prisma/client';\nexport const x = Prisma;\n",
      'no-restricted-imports',
    ],
    [
      'Prisma in a processor',
      server,
      'server',
      'src/modules/tickets/tickets.processor.ts',
      "import { Prisma } from '@prisma/client';\nexport const x = Prisma;\n",
      'no-restricted-imports',
    ],
    [
      'a service in a domain file',
      server,
      'server',
      'src/modules/tickets/domain/status-transitions.ts',
      "import { ticketsService } from '../tickets.service.js';\nexport const x = ticketsService;\n",
      'no-restricted-imports',
    ],
    [
      'a relative import of another package',
      library(),
      'contracts',
      'src/tickets/index.ts',
      "import { button } from '../../../ui/src/components/button.js';\nexport const x = button;\n",
      'import-x/no-relative-packages',
    ],
    [
      'a feature importing a route',
      web,
      'web',
      'src/features/tickets/ticket-page.ts',
      "import { layout } from '../../app/app-layout.js';\nexport const x = layout;\n",
      'import-x/no-restricted-paths',
    ],
    [
      'a string literal in an accessible name',
      web,
      'web',
      'src/features/tickets/close-button.tsx',
      'export function CloseButton() {\n  return <button aria-label="Close" />;\n}\n',
      'no-restricted-syntax',
    ],
    [
      'an img element in the web app (Next.js rules)',
      web,
      'web',
      'src/features/tickets/avatar.tsx',
      'export function Avatar({ src }: { src: string }) {\n  return <img src={src} alt={src} />;\n}\n',
      '@next/next/no-img-element',
    ],
    [
      'a React component that mutates its props',
      web,
      'web',
      'src/features/tickets/ticket-title.tsx',
      'export function TicketTitle(props: { title: string }) {\n  props.title = props.title.trim();\n  return <h1>{props.title}</h1>;\n}\n',
      'react-hooks/immutability',
    ],
    [
      'a string literal in JSX',
      web,
      'web',
      'src/features/tickets/ticket-title.tsx',
      'export function TicketTitle() {\n  return <h1>Tickets</h1>;\n}\n',
      'no-restricted-syntax',
    ],
    [
      'asChild',
      ui,
      'ui',
      'src/components/menu.tsx',
      'export function Menu({ trigger }: { trigger: React.ReactNode }) {\n  return <div asChild>{trigger}</div>;\n}\n',
      'no-restricted-syntax',
    ],
    [
      'Radix UI',
      ui,
      'ui',
      'src/components/dialog.tsx',
      "import { Dialog } from 'radix-ui';\nexport const x = Dialog;\n",
      'no-restricted-imports',
    ],
    [
      'a v8 coverage-ignore comment',
      library(),
      'contracts',
      'src/tickets/index.ts',
      '/* v8 ignore next -- @preserve */\nexport const x = 1;\n',
      'no-warning-comments',
    ],
    [
      'an istanbul coverage-ignore comment',
      server,
      'server',
      'src/modules/tickets/tickets.service.ts',
      '// istanbul ignore next\nexport const x = 1;\n',
      'no-warning-comments',
    ],
    [
      'a c8 coverage-ignore comment',
      web,
      'web',
      'src/features/tickets/ticket-list.ts',
      '/* c8 ignore start */\nexport const x = 1;\n/* c8 ignore stop */\n',
      'no-warning-comments',
    ],
    [
      'lib importing a feature',
      web,
      'web',
      'src/lib/api-client/client.ts',
      "import { ticketList } from '../../features/tickets/ticket-list.js';\nexport const x = ticketList;\n",
      'import-x/no-restricted-paths',
    ],
  ])('reports %s', async (_case, config, fixture, filePath, code, ruleId) => {
    expect(await ruleIds(config, fixture, filePath, code)).toContain(ruleId);
  });

  it.each([
    [
      'a parameter with its schema',
      server,
      'server',
      'src/modules/tickets/tickets.controller.ts',
      "import { Body, Controller, Post } from '@nestjs/common';\nimport { z } from 'zod';\n@Controller('tickets')\nexport class TicketsController {\n  @Post()\n  create(@Body({ schema: z.object({}) }) body: unknown) {\n    return body;\n  }\n}\n",
    ],
    [
      'process.env in the configuration',
      server,
      'server',
      'src/platform/config/config.module.ts',
      'export const env = process.env;\n',
    ],
    [
      'an allowed package import',
      web,
      'web',
      'src/features/tickets/ticket-schema.ts',
      "import { problemDetailsSchema } from '@trybun/contracts/problem-details';\nexport const x = problemDetailsSchema;\n",
    ],
    [
      'punctuation between expressions in JSX',
      web,
      'web',
      'src/features/tickets/ticket-key.tsx',
      'export function TicketKey({ project, num }: { project: string; num: number }) {\n  return (\n    <span>\n      {project}-{num}\n    </span>\n  );\n}\n',
    ],
    [
      'a string literal in a story',
      ui,
      'ui',
      'src/components/button.stories.tsx',
      'export function Primary() {\n  return <button type="button">Save</button>;\n}\n',
    ],
    [
      'a default export of a route file',
      web,
      'web',
      'src/app/(team)/tickets/[id]/page.tsx',
      'export default function TicketPage() {\n  return <main />;\n}\n',
    ],
  ])('accepts %s', async (_case, config, fixture, filePath, code) => {
    expect(await ruleIds(config, fixture, filePath, code)).toEqual([]);
  });

  it('reports a dependency cycle between modules', async () => {
    expect(await ruleIdsOfFile(server, 'server', 'src/modules/cycles/cycle-a.ts')).toContain(
      'import-x/no-cycle',
    );
  });

  it.each([
    ['an interface with an I prefix', 'export interface ITicket {\n  id: string;\n}\n'],
    ['a boolean without is/has/can/should', 'export const shared = true;\n'],
    ['a class property in snake_case', 'export class Ticket {\n  ticket_key = 1;\n}\n'],
  ])('reports %s (naming convention)', async (_case, code) => {
    expect(
      await typedRuleIds(server, 'server', 'src/modules/tickets/naming-case.ts', code),
    ).toContain('@typescript-eslint/naming-convention');
  });

  it.each([
    ['a boolean with a prefix', 'export const isShared = true;\n'],
    ['an UPPER_SNAKE_CASE boolean constant', 'export const IS_PRODUCTION = false;\n'],
    [
      'a PascalCase type and a camelCase function',
      'export type Ticket = { id: string };\nexport function assignTicket(): void {}\n',
    ],
  ])('accepts %s (naming convention)', async (_case, code) => {
    expect(
      await typedRuleIds(server, 'server', 'src/modules/tickets/naming-case.ts', code),
    ).toEqual([]);
  });
});
