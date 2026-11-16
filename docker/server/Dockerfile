# ghcr.io/trybun/server: the API and the Worker, started with different commands (§14.6, §15.4).
# Build context: the repository root. Base image pinned to a digest in the `FROM` lines,
# where Dependabot updates it (§2.10).
FROM node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --offline --frozen-lockfile --filter @trybun/server...
RUN pnpm --filter @trybun/server build \
  && pnpm --filter @trybun/server deploy --prod --legacy /out

FROM node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist ./dist
# Migrations of the one-off `migrate` service (§15.7).
COPY --from=build /repo/apps/server/prisma.config.ts ./
COPY --from=build /repo/apps/server/prisma ./prisma
USER node
EXPOSE 3001
# The API; the Worker runs `node dist/worker.js`, the command line `node dist/cli.js` (§15.5),
# the migrations `prisma migrate deploy`.
CMD ["node", "dist/main.js"]
