#!/bin/sh
# The QA page records of the QA test environment (#440), an opt-in step after test-env-up.sh:
#   add     – adds more accounts, organizations, projects, members and tickets than one page of a
#             list holds, so the lists show Load more; running it again restores them;
#   remove  – removes exactly those records again (and what was added to them during the QA).
# The records: apps/server/prisma/qa-pages-dataset.ts. A boot with --reset removes them too; a boot
# without it keeps them. Not part of the om-prepare-test-env generator: regenerating
# test-env-up.sh leaves this script alone.
set -eu

COMPOSE_PROJECT=trybun-test         # as in test-env-up.sh
POSTGRES_PORT=5432                  # the host port of PostgreSQL in compose.dev.yaml (.env)

log() { printf '[test-env] %s\n' "$*" >&2; }

case "${1:-}" in
  add | remove) [ "$#" = 1 ] || { echo "Usage: $0 add|remove" >&2; exit 2; } ;;
  *) echo "Usage: $0 add|remove" >&2; exit 2 ;;
esac

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# Only the database of the test environment: DATABASE_URL of .env reaches whichever PostgreSQL
# publishes the port, and that of `pnpm dev` (project `trybun`) or an installation must never
# get these records.
holder=$(docker ps --filter "publish=$POSTGRES_PORT" --format '{{.Label "com.docker.compose.project"}}') ||
  { log "listing the containers failed"; exit 1; }
if [ "$holder" != "$COMPOSE_PROJECT" ]; then
  log "port $POSTGRES_PORT is not published by the PostgreSQL of the Compose project $COMPOSE_PROJECT (${holder:-no container}); start the test environment first: sh .ai/scripts/test-env-up.sh"
  exit 1
fi

pnpm --filter @trybun/server exec tsx --env-file-if-exists=../../.env prisma/qa-pages.ts "$1"
