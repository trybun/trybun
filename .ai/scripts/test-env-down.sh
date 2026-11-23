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
#              when signalled, by PID and start time, and names a live group it leaves alone
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
# to them (#453). A recorded group is the environment's only while a member carries the run id of
# the boot as TEST_ENV_RUN_ID: test-env-up.sh starts every process of the applications with it, they
# inherit it, and the descriptor says so (runIdInEnvironment) – this holds also after the leader
# exited first, as `sh -c` does on SIGTERM while the API runs its shutdown hooks. Linux only
# (/proc), as setsid in test-env-up.sh already is.
RUN_ID=$(json_get runId)
TAGGED=$(json_get runIdInEnvironment)
STARTED_AT=$(json_get startedAt)
# The start of process $1 in clock ticks since the boot, which no clock change moves; nothing for a
# zombie (it no longer holds a port) or a missing process – which may have exited a moment after
# `ps` listed it: never a failure that `set -e` would stop the teardown on.
ticks() { awk '{ sub(/.*\) /, "") } $1 != "Z" { print $20 }' "/proc/$1/stat" 2>/dev/null || true; }
members() { ps -e -o pid= -o pgid= | awk -v group="$1" '$2 == group { print $1 }'; }
ours() {
  [ -n "$RUN_ID" ] || return 1
  if [ "$TAGGED" = true ]; then
    for member in $(members "$1"); do
      # Unreadable for a zombie and for another user's process.
      if tr '\0' '\n' 2>/dev/null <"/proc/$member/environ" | grep -Fqx "TEST_ENV_RUN_ID=$RUN_ID"; then
        return 0
      fi
    done
    return 1
  fi
  # A boot before #453 started its applications without the run id. Its leader is still the one it
  # recorded while it runs and started shortly before startedAt (the boot waits at most 180 s for
  # their health, and writes the descriptor seconds after starting them): that PID has not been free
  # since, and after a reboot every process starts later. This reads the wall clock, which a
  # backward step after the boot would fool, so it stays the fallback of these descriptors only.
  # btime is whole seconds, so the start comes out up to 1 s early.
  start=$(ticks "$1")
  [ -n "$start" ] && [ -n "$STARTED_AT" ] || return 1
  at=$(date -u -d "$STARTED_AT" +%s 2>/dev/null) || return 1
  awk -v boot="$(awk '/^btime / { print $2 }' /proc/stat 2>/dev/null)" -v hz="$(getconf CLK_TCK)" \
    -v start="$start" -v at="$at" \
    'BEGIN { s = boot + start / hz; exit !(boot > 0 && s <= at - 1 && s >= at - 300) }'
}
# Every process of a group that is the environment's, as "<pid>:<start ticks>" from just before it
# is signalled: the wait and the kill below concern exactly these processes, never a later holder
# of their PIDs, and also the members of a group of a boot before #453 once its leader has exited.
MEMBERS=""
for key in $APP_KEYS; do
  pid=$(json_get "$key")
  [ -n "$pid" ] || continue
  if ours "$pid"; then
    for member in $(members "$pid"); do
      start=$(ticks "$member")
      if [ -n "$start" ]; then MEMBERS="$MEMBERS $member:$start"; fi
    done
    # Each process was started in its own session: stop the whole group (pnpm, node, next).
    kill -- "-$pid" 2>/dev/null || true
  elif kill -0 "-$pid" 2>/dev/null; then
    echo "[test-env] process group $pid ($key) is not an application of environment $RUN_ID; leaving it alone" >&2
  fi
done
# Whether "<pid>:<start ticks>" still runs as that process.
same() { [ "$(ticks "${1%%:*}")" = "${1#*:}" ]; }
# The API closes its HTTP server only after its shutdown hooks: wait until every process has exited,
# so the ports are free when this returns (a boot right after checks them), then kill what is left.
waited=0
running=false
while [ "$waited" -lt 30 ]; do
  running=false
  for member in $MEMBERS; do
    if same "$member"; then running=true; fi
  done
  [ "$running" = true ] || break
  sleep 1
  waited=$((waited + 1))
done
if [ "$running" = true ]; then
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
