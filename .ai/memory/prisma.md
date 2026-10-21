# Prisma ORM 7 – pitfalls

Non-obvious behaviour of Prisma found when the version was chosen (October 2026). Decision: [§14.2](../../docs/spec/14-architecture.md), [§14.5](../../docs/spec/14-architecture.md); patterns: [§18.3](../../docs/spec/18-code-patterns.md).

- `prisma@latest` installs the **Prisma ORM 8 release candidate**; Prisma ORM 7 is the `prev` tag. Install and update with an explicit major: `prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg@7`.
- Prisma ORM 8 is a different architecture (CLI plus `@prisma/orm-postgres`, a "contract" instead of `schema.prisma`) without `$extends`, atomic `increment`, transaction isolation levels and `P2002`-style error codes. Prisma 7 and 8 can run side by side on one database, so the later move can go query by query.
- Prisma 7: driver adapters are mandatory (`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`); configuration lives in `prisma.config.ts`; `.env` is not loaded automatically; the `prisma-client` generator needs an `output` path; `migrate dev` no longer runs `generate` or the seed.
- `$use` middleware is removed – cross-cutting behaviour uses client extensions (`$extends`). `@casl/prisma` 2.x requires `$extends(createCaslExtension())`; with the `prisma-client` generator its runtime (`@casl/prisma/runtime`) is wrapped with the project's generated types.
- TypedSQL (`$queryRawTyped`) is still a preview feature – the project uses `$queryRaw` tagged templates ([§18.3](../../docs/spec/18-code-patterns.md)).
- Interactive transactions: `$transaction(async (tx) => …, { maxWait, timeout, isolationLevel })`; since 7.5 a nested `$transaction` uses a savepoint.
- `@default(uuid(7))` generates UUIDv7 in Prisma Client (application side), as [§17.2](../../docs/spec/17-conventions.md) requires.
