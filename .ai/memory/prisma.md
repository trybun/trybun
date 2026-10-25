# Prisma ORM 7 – pitfalls

Non-obvious behaviour of Prisma found when the version was chosen (October 2026). Decision: [§14.2](../../docs/spec/14-architecture.md), [§14.5](../../docs/spec/14-architecture.md); patterns: [§18.3](../../docs/spec/18-code-patterns.md).

- `prisma@latest` installs the **Prisma ORM 8 release candidate**; Prisma ORM 7 is the `prev` tag. Install and update with an explicit major: `prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg@7`.
- Prisma ORM 8 is a different architecture (CLI plus `@prisma/orm-postgres`, a "contract" instead of `schema.prisma`) without `$extends`, atomic `increment`, transaction isolation levels and `P2002`-style error codes. Prisma 7 and 8 can run side by side on one database, so the later move can go query by query.
- Prisma 7: driver adapters are mandatory (`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`); configuration lives in `prisma.config.ts`; `.env` is not loaded automatically; the `prisma-client` generator needs an `output` path; `migrate dev` no longer runs `generate` or the seed.
- A PostgreSQL error raised by a trigger with `ERRCODE = 'restrict_violation'` reaches Prisma Client as "Foreign key constraint violated on the (not available)", without the message; a plain `RAISE EXCEPTION` (`P0001`) keeps it (S0-14, the immutable audit log).
- `$use` middleware is removed – cross-cutting behaviour uses client extensions (`$extends`). `@casl/prisma` 2.x requires `$extends(createCaslExtension())`; with the `prisma-client` generator its runtime (`@casl/prisma/runtime`) is wrapped with the project's generated types.
- TypedSQL (`$queryRawTyped`) is still a preview feature – the project uses `$queryRaw` tagged templates ([§18.3](../../docs/spec/18-code-patterns.md)).
- Interactive transactions: `$transaction(async (tx) => …, { maxWait, timeout, isolationLevel })`; since 7.5 a nested `$transaction` uses a savepoint.
- `@default(uuid(7))` generates UUIDv7 in Prisma Client (application side), as [§17.2](../../docs/spec/17-conventions.md) requires.

Found when Prisma was set up (S0-04, October 2026):

- The lockfile of Prisma 7.10 contains `@prisma/engines-version@8.1.0-…` – an engine build identifier, not a Prisma ORM 8 package; `scripts/check-prisma.js` exempts it.
- `@prisma/engines` and `prisma` need their install scripts (`allowBuilds`): the schema engine of the migrations is a downloaded binary. `prisma` is a production dependency of `apps/server`, because the image runs `prisma migrate deploy` (one-off `migrate` service).
- `prisma generate` runs without `DATABASE_URL` (postinstall, CI, image build) as long as `prisma.config.ts` does not call `env()`, which throws for a missing variable. `prisma migrate diff --from-empty --to-schema …` still needs a datasource URL (any URL; nothing connects) – without one it fails with an empty "Error in Schema engine". With `--script` it may also print nothing and exit 0 (S0-10, also with `--from-schema <old schema>`); a new migration is easiest created with `prisma migrate dev --create-only --name <name>` against a temporary database (the project image `trybun-postgres-test` needs `KEYCLOAK_DB_PASSWORD`), then renamed to the timestamp pattern of the folder.
- The seed (`migrations.seed`) runs with `tsx`: Node's type stripping cannot run the generated client imported with `.js` extensions. `tsx` works without the install script of `esbuild` (denied).
- The generated `prisma-client` output (`src/generated/prisma`) is TypeScript; the server bundle inlines it, its runtime `@prisma/client/runtime/*` stays external.
