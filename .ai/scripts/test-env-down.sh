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
#   2026-11-23 signals, waits for and kills a recorded process group only while a member carries
#              the run id of the boot (TEST_ENV_RUN_ID, #453): a "running" descriptor left by a crash
#              or a reboot records PIDs the kernel may have given to other programs; it names a live
#              group it leaves alone
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
# A "running" or "stopping" descriptor cannot tell its applications from other programs either:
# after a crash with no --foreground owner or a reboot, the kernel may have given the recorded PIDs
# to them (#453). test-env-up.sh starts every process of the applications with the run id of its
# boot as TEST_ENV_RUN_ID, which they inherit, so a group is the environment's only while a member
# still carries it – also after its leader exited first, as `sh -c` does on SIGTERM while the API
# runs its shutdown hooks. An environment booted before #453 carries none and is left running.
RUN_TAG="TEST_ENV_RUN_ID=$(json_get runId)"
ours() {
  [ "$RUN_TAG" != "TEST_ENV_RUN_ID=" ] || return 1
  for member in $(ps -e -o pid= -o pgid= | awk -v group="$1" '$2 == group { print $1 }'); do
    # Empty for an exited member not reaped yet (a zombie): it no longer holds a port.
    if tr '\0' '\n' 2>/dev/null <"/proc/$member/environ" | grep -Fqx "$RUN_TAG"; then return 0; fi
  done
  return 1
}
PIDS=""
for key in $APP_KEYS; do
  pid=$(json_get "$key")
  [ -n "$pid" ] || continue
  # Each process was started in its own session: stop the whole group (pnpm, node, next).
  if ours "$pid"; then
    kill -- "-$pid" 2>/dev/null || true
    PIDS="$PIDS $pid"
  elif kill -0 "-$pid" 2>/dev/null; then
    echo "[test-env] process group $pid ($key) is not an application of environment $(json_get runId); leaving it alone" >&2
  fi
done
# The API closes its HTTP server only after its shutdown hooks: wait until every group has exited,
# so the ports are free when this returns (a boot right after checks them), then kill what is left
# – checking each time that the group is still the environment's, never one under a reused PID.
waited=0
running=false
while [ "$waited" -lt 30 ]; do
  running=false
  for pid in $PIDS; do
    if ours "$pid"; then running=true; fi
  done
  [ "$running" = true ] || break
  sleep 1
  waited=$((waited + 1))
done
if [ "$running" = true ]; then
  for pid in $PIDS; do
    if ours "$pid"; then kill -s KILL "-$pid" 2>/dev/null || true; fi
  done
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
