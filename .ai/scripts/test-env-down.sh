#!/bin/sh
# om-prepare-test-env: generated entrypoint (contract v2) – teardown
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-10-27 generated: stops the API and the web application the up script started and the
#              Compose infrastructure when it started it; never removes volumes
#   2026-10-28 the Compose project `trybun-test` of test-env-up.sh, so `down` never stops an
#              installation or `pnpm dev` (project `trybun`)
#   2026-11-15 waits until the applications have exited (#352), so a boot right after finds the
#              ports free
#   2026-11-20 marks the descriptor "stopping" before it signals the applications (#383), so an
#              attached `test-env-up.sh --foreground` owner tells a stop from a crash
set -eu
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
DESCRIPTOR=.ai/qa/test-env.json
# The Compose project of test-env-up.sh (keep in sync): never `trybun`, the project of an installation.
COMPOSE="docker compose -p trybun-test -f compose.yaml -f compose.dev.yaml"
KEEP_SERVICES=0
[ "${1:-}" = "--keep-services" ] && KEEP_SERVICES=1
[ -f "$DESCRIPTOR" ] || { echo "No test environment recorded."; exit 0; }
json_get() { sed -n "s/.*\"$1\": *\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$DESCRIPTOR" | head -1; }
# "stopping" before any process is signalled (#383): an attached --foreground owner that sees its
# processes end then knows they were stopped, not crashed; the reuse check reads only "running".
# A failed update is logged and never stops the teardown.
set_status() {
  sed -i.bak "s/\"status\": \"[a-z]*\"/\"status\": \"$1\"/" "$DESCRIPTOR" ||
    echo "could not mark $DESCRIPTOR $1" >&2
  rm -f "$DESCRIPTOR.bak"
}
set_status stopping
PIDS=""
for key in apiPid workerPid webPid; do
  pid=$(json_get "$key")
  # Each process was started in its own session: stop the whole group (pnpm, node, next).
  if [ -n "$pid" ]; then
    kill -- "-$pid" 2>/dev/null || true
    PIDS="$PIDS $pid"
  fi
done
# The API closes its HTTP server only after its shutdown hooks: wait until every group has exited,
# so the ports are free when this returns (a boot right after checks them), then kill what is left.
waited=0
running=false
while [ "$waited" -lt 30 ]; do
  running=false
  for pid in $PIDS; do
    if kill -0 "-$pid" 2>/dev/null; then running=true; fi
  done
  [ "$running" = true ] || break
  sleep 1
  waited=$((waited + 1))
done
if [ "$running" = true ]; then
  for pid in $PIDS; do kill -s KILL "-$pid" 2>/dev/null || true; done
fi
if [ "$KEEP_SERVICES" = 0 ] && [ "$(json_get servicesStartedByScript)" = true ]; then
  $COMPOSE down >/dev/null 2>&1 || true
fi
set_status stopped
echo "TEST_ENV_STATUS=stopped"
