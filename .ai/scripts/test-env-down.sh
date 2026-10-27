#!/bin/sh
# om-prepare-test-env: generated entrypoint (contract v2) – teardown
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-10-27 generated: stops the API and the web application the up script started and the
#              Compose infrastructure when it started it; never removes volumes
set -eu
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
DESCRIPTOR=.ai/qa/test-env.json
COMPOSE="docker compose -f compose.yaml -f compose.dev.yaml"
KEEP_SERVICES=0
[ "${1:-}" = "--keep-services" ] && KEEP_SERVICES=1
[ -f "$DESCRIPTOR" ] || { echo "No test environment recorded."; exit 0; }
json_get() { sed -n "s/.*\"$1\": *\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$DESCRIPTOR" | head -1; }
for key in apiPid webPid; do
  pid=$(json_get "$key")
  # Each process was started in its own session: stop the whole group (pnpm, node, next).
  if [ -n "$pid" ]; then kill -- "-$pid" 2>/dev/null || true; fi
done
if [ "$KEEP_SERVICES" = 0 ] && [ "$(json_get servicesStartedByScript)" = true ]; then
  $COMPOSE down >/dev/null 2>&1 || true
fi
sed -i.bak 's/"status": "running"/"status": "stopped"/' "$DESCRIPTOR" && rm -f "$DESCRIPTOR.bak"
echo "TEST_ENV_STATUS=stopped"
