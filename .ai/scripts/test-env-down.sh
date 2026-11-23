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
#   2026-11-23 signals a recorded process group only while a member carries the run id of the boot
#              (TEST_ENV_RUN_ID, #453) – for a boot before #453 while its leader started shortly before
#              startedAt: a "running" descriptor left by a crash or a reboot records PIDs the kernel
#              may have given to other programs; it waits for and kills the processes the groups had
#              when signalled, by PID and start time, and the groups while they carry the run id, and
#              names a live group it leaves alone
#   2026-11-23 replaces the descriptor atomically when it marks its status (#457) – written to a
#              temporary file in .ai/qa, then renamed over it – so no reader sees it half-written or
#              missing (`sed -i` with a backup suffix renames it away before the new one is in place)
#   2026-11-23 the identity check of a recorded process group moves to test-env-processes.sh, which
#              it sources (#456): test-env-up.sh applies the same check to its reuse check and watch
set -eu
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
DESCRIPTOR=.ai/qa/test-env.json
# Each status update is written here and then renamed over the descriptor (#457), as test-env-up.sh
# writes it: a reader opens either the old or the new descriptor, whole.
DESCRIPTOR_TMP="$DESCRIPTOR.$$.tmp"
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
  if sed "s/\"status\": \"[a-z-]*\"/\"status\": \"$1\"/" "$DESCRIPTOR" >"$DESCRIPTOR_TMP" &&
     mv -f "$DESCRIPTOR_TMP" "$DESCRIPTOR"; then
    return 0
  fi
  rm -f "$DESCRIPTOR_TMP"
  echo "could not mark $DESCRIPTOR $1" >&2
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
# to them (#453). A recorded group is signalled only while it is the environment's (group_is_ours:
# a member carries the run id of the boot – for a boot before #453, its leader started shortly
# before startedAt), the check test-env-up.sh shares (#456).
# shellcheck source=.ai/scripts/test-env-processes.sh
. "$ROOT/.ai/scripts/test-env-processes.sh"
RUN_ID=$(json_get runId)
TAGGED=$(json_get runIdInEnvironment)
STARTED_AT=$(json_get startedAt)
ours() { group_is_ours "$1" "$RUN_ID" "$TAGGED" "$STARTED_AT"; }
# Every process of a group that is the environment's, as "<pid>:<start ticks>" from just before it
# is signalled: the wait and the kill below concern these processes, never a later holder of their
# PIDs – also the members of a group of a boot before #453 once its leader has exited. Since #453
# they also concern the groups while a member carries the run id, which a process forked later
# (e.g. by a shutdown hook) inherits.
SIGNALLED=""
MEMBERS=""
for key in $APP_KEYS; do
  pid=$(json_get "$key")
  [ -n "$pid" ] || continue
  if ours "$pid"; then
    for member in $(group_members "$pid"); do
      start=$(proc_ticks "$member")
      if [ -n "$start" ]; then MEMBERS="$MEMBERS $member:$start"; fi
    done
    SIGNALLED="$SIGNALLED $pid"
    # Each process was started in its own session: stop the whole group (pnpm, node, next).
    kill -- "-$pid" 2>/dev/null || true
  elif kill -0 "-$pid" 2>/dev/null; then
    echo "[test-env] process group $pid ($key) is not an application of environment $RUN_ID; leaving it alone" >&2
  fi
done
# Whether "<pid>:<start ticks>" still runs as that process.
same() { [ "$(proc_ticks "${1%%:*}")" = "${1#*:}" ]; }
# Whether recorded group $1 still holds a process carrying the run id (boots since #453 only).
tagged() { [ "$TAGGED" = true ] && ours "$1"; }
# The API closes its HTTP server only after its shutdown hooks: wait until every process has exited,
# so the ports are free when this returns (a boot right after checks them), then kill what is left.
waited=0
running=false
while [ "$waited" -lt 30 ]; do
  running=false
  for member in $MEMBERS; do
    if same "$member"; then running=true; fi
  done
  for pid in $SIGNALLED; do
    if tagged "$pid"; then running=true; fi
  done
  [ "$running" = true ] || break
  sleep 1
  waited=$((waited + 1))
done
if [ "$running" = true ]; then
  for pid in $SIGNALLED; do
    if tagged "$pid"; then kill -s KILL -- "-$pid" 2>/dev/null || true; fi
  done
  for member in $MEMBERS; do
    if same "$member"; then kill -s KILL "${member%%:*}" 2>/dev/null || true; fi
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
