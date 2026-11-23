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
#   2026-11-23 a failed `compose down` (#449) is reported – the cause in .ai/qa/logs/down.log, the
#              descriptor "stop-failed", TEST_ENV_STATUS=stop-failed and exit 1 – instead of
#              "stopped" while the infrastructure keeps running; running it again retries the down
#   2026-11-23 signals the recorded applications only while the descriptor is not yet "stopped" or
#              "stop-failed" (#452): after they have exited their PIDs may belong to other processes;
#              such a down keeps that status until its `compose down` has succeeded
set -eu
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
DESCRIPTOR=.ai/qa/test-env.json
LOG_DIR=.ai/qa/logs
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
  sed -i.bak "s/\"status\": \"[a-z-]*\"/\"status\": \"$1\"/" "$DESCRIPTOR" ||
    echo "could not mark $DESCRIPTOR $1" >&2
  rm -f "$DESCRIPTOR.bak"
}
# "stopped" and "stop-failed" are written only after the applications were signalled and have
# exited, and the kernel may have given their PIDs to other processes since (#452): a later down
# (a retry after "stop-failed", or a second one) signals no process group; it repeats at most the
# `compose down`. It also keeps that status meanwhile: a retry cut off during the `compose down`
# must leave "stop-failed", which the next down and the next boot (servicesStartedByScript) read.
APP_KEYS="apiPid workerPid webPid"
case "$(json_get status)" in stopped | stop-failed) APP_KEYS="" ;; esac
if [ -n "$APP_KEYS" ]; then set_status stopping; fi
PIDS=""
for key in $APP_KEYS; do
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
  mkdir -p "$LOG_DIR"
  # A failed down leaves the infrastructure running and its ports bound (#449): never "stopped".
  if ! $COMPOSE down >"$LOG_DIR/down.log" 2>&1; then
    set_status stop-failed
    echo "[test-env] stopping the infrastructure failed, see $LOG_DIR/down.log" >&2
    # Compose reads the required variables of compose.yaml from .env, also for `down`.
    [ -f .env ] ||
      echo "[test-env] there is no .env in $ROOT: Compose needs it to read compose.yaml; restore it (cp .env.example .env) and run this script again" >&2
    echo "TEST_ENV_STATUS=stop-failed"
    exit 1
  fi
fi
set_status stopped
echo "TEST_ENV_STATUS=stopped"
