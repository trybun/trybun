#!/bin/sh
# om-prepare-test-env: generated entrypoint (contract v2)
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-10-27 generated: the local environment of §15.12 as the E2E job of CI runs it –
#              Compose infrastructure, migrations and the demo dataset, production builds of the
#              API (3001) and the web application (3000); cold 39s (Turbo cache warm), warm 0s (reused)
#   2026-10-28 its own Compose project `trybun-test`: the project `trybun` of compose.yaml is also the
#              one of an installation (deploy/trybun) and of `pnpm dev`, whose containers, networks
#              and volumes the test environment must never reuse or stop; refuses while another
#              Compose project publishes the fixed ports of the infrastructure
#   2026-11-15 --reset (#352): removes the data volumes of `trybun-test` before the boot, so the
#              environment starts as empty as CI's E2E job; a boot without it keeps the data
#              the bootstrap lock is machine-wide (/tmp/trybun-test-env.lock), not per checkout
#   2026-11-18 TRYBUN_PSEUDO_LOCALE=true (#301): the web application serves the pseudo-locale en-XA
#              of the width-sensitive E2E checks, as playwright.config.ts sets it in CI
#   2026-11-20 --foreground (#383): runs the boot as a child and stays attached as the owner (a
#              closed terminal or SIGTERM stops what it booted) or a viewer (stops nothing) – the
#              start command of cezar Preview's startApp recipe and sv-prepare-qa-tests (README);
#              TEST_ENV_RUN_ID; an interrupted boot stops what it started (steps in their own
#              sessions, detached cleanup); refusal messages never invite stopping another checkout
#   2026-11-22 the descriptor's notes name test-env-pages.sh (#440), the opt-in records for a second
#              page of the lists – a companion script, not part of this generated entrypoint
#   2026-11-23 a failed stop is reported (#449): the --foreground owner exits 1 when
#              test-env-down.sh fails, and the cleanup of an interrupted boot records "stop-failed"
#              instead of "stopped" when its `compose down` fails; a boot after a failed stop keeps
#              the infrastructure it left running as started by this script, so the next stop ends it
#   2026-11-23 starts each application with the run id of its boot in its environment
#              (TEST_ENV_RUN_ID, #453) and records that (app.runIdInEnvironment, additive), so
#              test-env-down.sh can tell its process groups from those of other programs that reuse
#              the recorded PIDs after a crash or a reboot
#   2026-11-23 replaces the descriptor atomically (#457) – written to a temporary file in .ai/qa, then
#              renamed over it – so no reader sees it truncated, half-written or missing; the
#              --foreground owner decides from one read of it, never from separate reads that a
#              replacement can land between
#   2026-11-23 the reuse check and the watch of --foreground take a recorded application as running
#              only while test-env-down.sh's identity check confirms it (#456, test-env-processes.sh,
#              sourced): after a crash or a reboot its PID may belong to another program, so a boot
#              reused an environment it never started and an owner missed the crash of its own
set -eu

# --- project-specific facts (discovered from README.md, compose*.yaml, ci.yml, playwright.config.ts)
# Its own Compose project: `trybun` (compose.yaml) is shared by an installation and `pnpm dev`, so
# the test environment never reuses or stops their containers or volumes. Keep test-env-down.sh in
# sync.
COMPOSE_PROJECT=trybun-test
COMPOSE="docker compose -p $COMPOSE_PROJECT -f compose.yaml -f compose.dev.yaml"
# The volumes --reset removes: everything earlier runs left behind – the databases of Trybun and
# Keycloak (accounts, projects, passwords; both in PostgreSQL), the queued jobs and the attachments.
# `clamav-data` holds only the virus signatures, which ClamAV would otherwise download again.
DATA_VOLUMES="postgres-data valkey-data seaweedfs-data"
# The host ports compose.dev.yaml publishes; .env reaches the infrastructure there.
INFRA_PORTS="5432 6379 8333 8080 3310 8025 1025"
WEB_PORT=3000                       # fixed: Keycloak's redirect URIs and the sessions use it
API_PORT=3001                       # fixed: the web application reaches the API there (.env)
BASE_URL="http://localhost:$WEB_PORT"
WEB_HEALTH="$BASE_URL/api/health"
API_HEALTH="http://localhost:$API_PORT/health/ready"   # checks PostgreSQL too
# The parallel E2E/QA requests share the seeded accounts, as in playwright.config.ts.
export TRYBUN_RATE_LIMIT_PER_USER=10000 TRYBUN_RATE_LIMIT_PER_IP=10000
# The pseudo-locale of the width-sensitive E2E checks (§2.9), as in playwright.config.ts; the web
# application accepts it on the loopback NEXTAUTH_URL of .env only.
export TRYBUN_PSEUDO_LOCALE=true
API_COMMAND="pnpm --filter @trybun/server start"
# The Worker scans and releases uploaded attachments (S1-08); without it they stay "Checking…".
WORKER_COMMAND="pnpm --filter @trybun/server start:worker"
WEB_COMMAND="pnpm --filter @trybun/web exec next start --port $WEB_PORT"
PREP_CHAIN="pnpm install --frozen-lockfile && pnpm build"
ARTIFACTS="apps/server/dist/main.js apps/web/.next/BUILD_ID"
TTL_SECONDS="${TEST_ENV_CACHE_TTL_SECONDS:-28800}"
BROWSER_COMMAND=".ai/scripts/test-env-browser.sh"

# --- paths
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
QA_DIR=.ai/qa
DESCRIPTOR="$QA_DIR/test-env.json"
# Every write of the descriptor goes here first and is then renamed over it (#457): a rename within a
# directory is atomic, so a reader opens either the old or the new descriptor, whole.
DESCRIPTOR_TMP="$DESCRIPTOR.$$.tmp"
CREDENTIALS_FILE="$QA_DIR/test-env.env"
BUILD_CACHE="$QA_DIR/test-env-build-cache.json"
# One bootstrap at a time on the whole machine, not per checkout: every checkout boots the same
# Compose project on the same ports, and --reset must never remove the volumes under another
# checkout's boot (TEST_ENV_LOCK_DIR moves it for the tests of this script).
LOCK_DIR="${TEST_ENV_LOCK_DIR:-/tmp/$COMPOSE_PROJECT-env.lock}"
LOG_DIR="$QA_DIR/logs"
mkdir -p "$QA_DIR" "$LOG_DIR"

FORCE=0
FORCE_REBUILD=0
RESET=0
FOREGROUND=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --force-rebuild) FORCE_REBUILD=1 ;;
    --reset) RESET=1 ;;
    --foreground) FOREGROUND=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done
# --force skips the reuse check and then refuses on the occupied ports: it never replaces a running
# environment, so there is nothing for --foreground to own or watch.
if [ "$FOREGROUND" = 1 ] && [ "$FORCE" = 1 ]; then
  echo "--foreground cannot be combined with --force" >&2
  exit 2
fi

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { printf '[test-env] %s\n' "$*" >&2; }
# The value of key $1 in file $2, or in standard input without $2.
json_get() { sed -n "s/.*\"$1\": *\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" ${2+"$2"} | head -1; }
# Whether a process exists: `ps -p`, not `kill -0`, which fails with EPERM for another user's
# process (the lock below is shared by the whole machine).
alive() { [ -n "${1:-}" ] && ps -p "$1" >/dev/null 2>&1; }
# Whether a process runs, not counting an exited child that is not reaped yet (a zombie).
running() { [ -n "${1:-}" ] && ps -o stat= -p "$1" 2>/dev/null | grep -qv '^Z'; }
healthy() { curl -fsS --max-time 5 -o /dev/null "$1" 2>/dev/null; }
# A recorded application runs only while its process group is the environment's (#456): a live PID
# alone may belong to another program the kernel gave it to after a crash or a reboot (#453).
# shellcheck source=.ai/scripts/test-env-processes.sh
. "$ROOT/.ai/scripts/test-env-processes.sh"
# Whether the applications recorded as $4, $5 and $6 all run as those of run id $1, whose descriptor
# has runIdInEnvironment $2 and startedAt $3: each recorded leader still runs, as before #456, and
# its group is the environment's – while the group exists, the kernel gives its PID to no other
# process.
applications_run() {
  for group in "$4" "$5" "$6"; do
    running "$group" && group_is_ours "$group" "$1" "$2" "$3" || return 1
  done
}
set_descriptor_status() {
  [ -f "$DESCRIPTOR" ] || return 0
  if sed "s/\"status\": \"[a-z-]*\"/\"status\": \"$1\"/" "$DESCRIPTOR" >"$DESCRIPTOR_TMP" &&
     mv -f "$DESCRIPTOR_TMP" "$DESCRIPTOR"; then
    return 0
  fi
  rm -f "$DESCRIPTOR_TMP"
}

# --- --foreground (#383): one start command for cezar Preview, sv-prepare-qa-tests and the QA
# skills. The boot runs unchanged as a child (this script without the flag), so the lock is held
# only while it boots; then this process stays attached while the applications live, in one role:
#   owner  – the child booted (TEST_ENV_REUSED=0): a signal runs test-env-down.sh, a crash too;
#   viewer – the child reused a running environment: a signal stops nothing.
# Signals are forwarded as SIGTERM: the child, an asynchronous command of a shell without job
# control, ignores SIGINT. A teardown runs in its own session and is waited for, so a SIGKILL of
# this process group a moment later cannot cut it off. Handler output goes to a log, because after
# SIGHUP the terminal is gone.

# The role the child's output names, once it has exited 0 (also for a signal that arrives before
# the role is set).
fg_read_role() {
  FG_RUN=$(sed -n 's/^TEST_ENV_RUN_ID=//p' "$FG_OUT" | head -1)
  case "$(sed -n 's/^TEST_ENV_REUSED=//p' "$FG_OUT" | head -1)" in
    0) FG_ROLE=owner ;;
    1) FG_ROLE=viewer ;;
    *) FG_ROLE="" ;;
  esac
}
# One read of the descriptor (#457): every decision below takes its values from the same version of
# it, so a replacement that lands in between cannot mix the status of one run with the runId of
# another. Empty values when there is no descriptor.
fg_read_descriptor() {
  FG_DESCRIPTOR=$(cat "$DESCRIPTOR" 2>/dev/null || true)
  FG_STATUS=$(printf '%s\n' "$FG_DESCRIPTOR" | json_get status)
  FG_CURRENT=$(printf '%s\n' "$FG_DESCRIPTOR" | json_get runId)
}
# Whether the last read of the descriptor records this owner's run as running.
fg_still_ours() {
  [ -n "$FG_RUN" ] && [ "$FG_STATUS" = running ] && [ "$FG_CURRENT" = "$FG_RUN" ]
}
# Returns the exit status of test-env-down.sh: non-zero when the infrastructure still runs (#449).
fg_teardown() {
  setsid sh "$ROOT/.ai/scripts/test-env-down.sh" >>"$FG_LOG" 2>&1 < /dev/null &
  teardown_pid=$!
  # The first `wait` also collects the status of a teardown the shell has already reaped.
  teardown_status=0
  wait "$teardown_pid" || teardown_status=$?
  while alive "$teardown_pid"; do
    teardown_status=0
    wait "$teardown_pid" || teardown_status=$?
  done
  return "$teardown_status"
}
fg_signal() {
  # Ignore further signals from here on: a closed terminal can hang up the group more than once
  # (the hangup, then the end of its session leader), and the commands below inherit the ignored
  # disposition, so a later SIGHUP cannot kill the descriptor reads this decision rests on.
  trap '' HUP INT TERM
  exec >>"$FG_LOG" 2>&1
  if [ -n "$FG_SLEEP" ]; then kill "$FG_SLEEP" 2>/dev/null || true; fi
  if [ -n "$FG_CHILD" ]; then
    # Still booting: the child stops what it started; this layer has nothing of its own. A child
    # that has just finished its boot exits 0, and its output names the role. FG_CHILD_STATUS
    # keeps the status of a child the main loop has already reaped.
    if running "$FG_CHILD"; then
      log "signal during the boot; stopping it"
      kill -s TERM "$FG_CHILD" 2>/dev/null || true
    fi
    while alive "$FG_CHILD"; do
      FG_CHILD_STATUS=0
      wait "$FG_CHILD" || FG_CHILD_STATUS=$?
    done
    FG_CHILD=""
    [ "$FG_CHILD_STATUS" = 0 ] || exit "$FG_CHILD_STATUS"
  fi
  [ -n "$FG_ROLE" ] || fg_read_role
  fg_read_descriptor
  if [ "$FG_ROLE" = owner ] && fg_still_ours; then
    log "closing the owner of environment $FG_RUN; stopping it"
    if ! fg_teardown; then
      log "stopping environment $FG_RUN failed; see the messages of test-env-down.sh above"
      exit 1
    fi
  elif [ "$FG_ROLE" = owner ]; then
    log "closing the owner of environment $FG_RUN, which was already stopped or replaced"
  else
    log "closing a viewer; the environment keeps running"
  fi
  exit 0
}
if [ "$FOREGROUND" = 1 ]; then
  FG_OUT="$LOG_DIR/foreground-boot.out"
  FG_LOG="$LOG_DIR/foreground.log"
  FG_CHILD=""
  FG_SLEEP=""
  FG_ROLE=""
  FG_RUN=""
  FG_DESCRIPTOR=""
  FG_STATUS=""
  FG_CURRENT=""
  FG_CHILD_STATUS=0
  child_flags=""
  [ "$FORCE_REBUILD" = 1 ] && child_flags="$child_flags --force-rebuild"
  [ "$RESET" = 1 ] && child_flags="$child_flags --reset"

  trap 'fg_signal 129' HUP
  trap 'fg_signal 130' INT
  trap 'fg_signal 143' TERM

  # shellcheck disable=SC2086 # one flag per word
  sh "$ROOT/.ai/scripts/test-env-up.sh" $child_flags >"$FG_OUT" &
  FG_CHILD=$!
  while alive "$FG_CHILD"; do
    FG_CHILD_STATUS=0
    wait "$FG_CHILD" || FG_CHILD_STATUS=$?
  done
  FG_CHILD=""
  cat "$FG_OUT"
  [ "$FG_CHILD_STATUS" = 0 ] || exit "$FG_CHILD_STATUS"
  fg_read_role
  if [ -z "$FG_ROLE" ] || [ -z "$FG_RUN" ]; then
    log "the boot printed no TEST_ENV_REUSED or TEST_ENV_RUN_ID; see $FG_OUT"
    exit 1
  fi
  # The applications to watch, from one read of the descriptor too, before the attach is reported.
  fg_read_descriptor
  fg_api=$(printf '%s\n' "$FG_DESCRIPTOR" | json_get apiPid)
  fg_worker=$(printf '%s\n' "$FG_DESCRIPTOR" | json_get workerPid)
  fg_web=$(printf '%s\n' "$FG_DESCRIPTOR" | json_get webPid)
  fg_tagged=$(printf '%s\n' "$FG_DESCRIPTOR" | json_get runIdInEnvironment)
  fg_started=$(printf '%s\n' "$FG_DESCRIPTOR" | json_get startedAt)
  if [ "$FG_ROLE" = owner ]; then
    log "attached in the foreground as the owner – closing this terminal stops the environment"
  else
    log "attached in the foreground as a viewer of an environment started elsewhere – closing this terminal stops nothing; to stop the environment, close the owner's terminal or run: sh .ai/scripts/test-env-down.sh"
  fi
  # While the applications of this run live (#456): not merely their PIDs, which another program may
  # hold once an application has crashed.
  while applications_run "$FG_RUN" "$fg_tagged" "$fg_started" "$fg_api" "$fg_worker" "$fg_web"; do
    sleep 2 &
    FG_SLEEP=$!
    wait "$FG_SLEEP" || true
    FG_SLEEP=""
  done
  # The applications ended: a crash of this owner's run, or a stop or replacement from elsewhere.
  fg_read_descriptor
  if [ "$FG_ROLE" = owner ] && fg_still_ours; then
    # A signal during this teardown must not start a second one or change the exit code.
    trap '' HUP INT TERM
    log "an application of environment $FG_RUN exited; stopping the rest (logs in $LOG_DIR)"
    fg_teardown || log "stopping environment $FG_RUN failed; see $FG_LOG"
    exit 1
  fi
  if [ -n "$FG_CURRENT" ] && [ "$FG_CURRENT" != "$FG_RUN" ]; then
    log "environment $FG_RUN was replaced by $FG_CURRENT; detaching – the new environment keeps running; to stop it, run: sh .ai/scripts/test-env-down.sh"
  elif [ "$FG_STATUS" = stop-failed ]; then
    log "the stop of environment $FG_RUN elsewhere failed; its infrastructure may still run; detaching"
  else
    log "environment $FG_RUN was stopped elsewhere ($FG_STATUS); detaching"
  fi
  exit 0
fi

# --- lock: one bootstrap at a time
acquire_lock() {
  waited=0
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    owner=$(json_get pid "$LOCK_DIR/owner.json" 2>/dev/null || true)
    if ! alive "$owner"; then
      log "removing the stale lock of PID ${owner:-?}"
      rm -rf "$LOCK_DIR"
      continue
    fi
    [ "$waited" -ge 300 ] && { log "another bootstrap (PID $owner) still runs after 5 min"; exit 1; }
    sleep 5
    waited=$((waited + 5))
  done
  printf '{ "pid": "%s", "source": "test-env-up.sh", "acquiredAt": "%s" }\n' "$$" "$(now)" > "$LOCK_DIR/owner.json"
  LOCKED=1
  trap 'release_lock' EXIT
  trap 'interrupted 129' HUP
  trap 'interrupted 130' INT
  trap 'interrupted 143' TERM
}
release_lock() {
  if [ "$LOCKED" = 1 ]; then rm -rf "$LOCK_DIR"; fi
  LOCKED=0
}

# --- interrupted boot (#383): a signal after the lock stops what this boot started so far – the
# running step, the applications and the Compose infrastructure it brought up – then frees the lock.
# The cleanup runs in its own session and this shell waits for it, so a SIGKILL of the caller's
# process group a moment later (e.g. sv-prepare-qa-tests) cannot cut it off; it takes over the lock
# under its own PID, so no other boot takes the lock as stale while it runs. The output goes to a
# log: after SIGHUP the terminal is gone, and a failed write must not abort the cleanup.
LOCKED=0
BOOTED=0
STEP_PID=""
API_PID=""
WORKER_PID=""
WEB_PID=""
SERVICES_STARTED=false
# shellcheck disable=SC2016 # expanded by the cleanup shell, from its positional parameters
CLEANUP='
  lock=$1 locked=$2 boot=$3 services=$4; shift 4; compose=$1; shift
  owner() { sed -n "s/.*\"pid\": *\"\([0-9]*\)\".*/\1/p" "$lock/owner.json" 2>/dev/null; }
  # Take the lock over only while it is still the boot'"'"'s, and remove it only while it is ours.
  if [ "$locked" = 1 ] && [ "$(owner)" = "$boot" ]; then
    printf "{ \"pid\": \"%s\", \"source\": \"test-env-up.sh cleanup\" }\n" "$$" > "$lock/owner.json"
  else
    locked=0
  fi
  for pid in "$@"; do kill -- "-$pid" 2>/dev/null || true; done
  waited=0
  while [ "$waited" -lt 30 ]; do
    running=false
    for pid in "$@"; do kill -0 "-$pid" 2>/dev/null && running=true; done
    [ "$running" = true ] || break
    sleep 1
    waited=$((waited + 1))
  done
  for pid in "$@"; do kill -s KILL "-$pid" 2>/dev/null || true; done
  stopped=true
  if [ "$services" = true ] && ! $compose down; then
    stopped=false
    echo "[test-env] stopping the infrastructure failed; see the output above"
  fi
  if [ "$locked" = 1 ] && [ "$(owner)" = "$$" ]; then rm -rf "$lock"; fi
  [ "$stopped" = true ] || exit 1
  echo "[test-env] interrupted boot cleaned up"
'
interrupted() {
  # Ignore further signals, as fg_signal does: the cleanup below must not be cut by a second one.
  trap '' HUP INT TERM
  # A boot that has completed is recorded and kept; only the lock is released (EXIT).
  [ "$BOOTED" = 1 ] && exit "$1"
  exec >>"$LOG_DIR/boot-interrupt.log" 2>&1
  log "interrupted (exit $1); stopping what this boot started"
  # Interrupted after the descriptor was written but before the result was printed: nobody was
  # told the environment runs, so it is stopped and recorded as such. Interrupted while it was
  # written: the descriptor still records an earlier run, which this cleanup leaves as it is (#457).
  rm -f "$DESCRIPTOR_TMP"
  recorded=false
  if [ -n "${RUN_ID:-}" ] && [ "$(json_get runId "$DESCRIPTOR" 2>/dev/null)" = "$RUN_ID" ]; then
    recorded=true
    set_descriptor_status stopping
  fi
  pids=""
  for pid in "$STEP_PID" "$API_PID" "$WORKER_PID" "$WEB_PID"; do [ -n "$pid" ] && pids="$pids $pid"; done
  # shellcheck disable=SC2086 # one PID per word
  setsid sh -c "$CLEANUP" cleanup "$LOCK_DIR" "$LOCKED" "$$" "$SERVICES_STARTED" "$COMPOSE" $pids &
  cleanup_pid=$!
  LOCKED=0
  # A second signal interrupts `wait`; keep waiting until the cleanup has finished. The first
  # `wait` also collects the status of a cleanup the shell has already reaped.
  cleanup_status=0
  wait "$cleanup_pid" || cleanup_status=$?
  while alive "$cleanup_pid"; do
    cleanup_status=0
    wait "$cleanup_pid" || cleanup_status=$?
  done
  # A failed `compose down` leaves the infrastructure running: never "stopped" (#449).
  if [ "$recorded" = true ]; then
    if [ "$cleanup_status" = 0 ]; then set_descriptor_status stopped; else set_descriptor_status stop-failed; fi
  fi
  exit "$1"
}

# A long boot step in its own session (like start_bg), so the cleanup above can stop the whole
# step – a killed shell would leave its children (pnpm, next build) running. $1 = command,
# $2 = log file, $3 = "append" to add to the log.
run_step() {
  if [ "${3:-}" = append ]; then
    setsid sh -c "$1" >>"$2" 2>&1 < /dev/null &
  else
    setsid sh -c "$1" >"$2" 2>&1 < /dev/null &
  fi
  STEP_PID=$!
  step_status=0
  wait "$STEP_PID" || step_status=$?
  STEP_PID=""
  return "$step_status"
}

# --- source fingerprint: the commit, the changes and the untracked files of the checkout
fingerprint() {
  {
    git rev-parse HEAD
    git diff HEAD -- . ':(exclude).ai' 2>/dev/null
    git ls-files -o --exclude-standard -- apps packages pnpm-lock.yaml 2>/dev/null | LC_ALL=C sort |
      while IFS= read -r f; do printf '%s:%s\n' "$f" "$(stat -c '%s:%Y' "$f" 2>/dev/null || stat -f '%z:%m' "$f")"; done
  } | cksum | awk '{print $1"-"$2}'
}

build_needed() {
  [ "$FORCE_REBUILD" = 1 ] && return 0
  [ -f "$BUILD_CACHE" ] || return 0
  [ "$(json_get sourceFingerprint "$BUILD_CACHE")" = "$CURRENT_FP" ] || return 0
  [ "$(json_get projectRoot "$BUILD_CACHE")" = "$ROOT" ] || return 0
  for a in $ARTIFACTS; do [ -s "$a" ] || return 0; done
  return 1
}

age_seconds() {
  started=$(date -u -d "$1" +%s 2>/dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s)
  echo $(( $(date -u +%s) - started ))
}

# $1 = 1 when the running environment was reused, $2 = its run id (TEST_ENV_RUN_ID, #383: the
# --foreground owner checks it against the descriptor before it tears anything down).
print_result() {
  printf 'TEST_ENV_STATUS=running\nTEST_ENV_BASE_URL=%s\nTEST_ENV_DESCRIPTOR=%s\nTEST_ENV_REUSED=%s\nTEST_ENV_RUN_ID=%s\n' \
    "$BASE_URL" "$DESCRIPTOR" "$1" "$2"
  printf 'BROWSER_PROVIDER=agent-browser\nBROWSER_INSTALLED=%s\n' "$(json_get installed "$DESCRIPTOR")"
}

CURRENT_FP=$(fingerprint)

# --- reuse check: attach to a running environment of this checkout (never with --reset)
if [ "$FORCE" = 0 ] && [ "$RESET" = 0 ] && [ -f "$DESCRIPTOR" ] && [ "$(json_get status "$DESCRIPTOR")" = running ]; then
  api_pid=$(json_get apiPid "$DESCRIPTOR")
  worker_pid=$(json_get workerPid "$DESCRIPTOR")
  web_pid=$(json_get webPid "$DESCRIPTOR")
  # Its own applications (#456): with their PIDs held by other programs after a crash or a reboot,
  # the health checks may answer from another checkout's environment on the same ports.
  if applications_run "$(json_get runId "$DESCRIPTOR")" "$(json_get runIdInEnvironment "$DESCRIPTOR")" \
       "$(json_get startedAt "$DESCRIPTOR")" "$api_pid" "$worker_pid" "$web_pid" &&
     healthy "$WEB_HEALTH" && healthy "$API_HEALTH" &&
     [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$API_PORT/api/v1/users/me")" = 401 ] &&
     [ "$(age_seconds "$(json_get startedAt "$DESCRIPTOR")")" -lt "$TTL_SECONDS" ] &&
     [ "$(json_get sourceFingerprint "$DESCRIPTOR")" = "$CURRENT_FP" ]; then
    log "reusing the running environment $(json_get runId "$DESCRIPTOR")"
    print_result 1 "$(json_get runId "$DESCRIPTOR")"
    exit 0
  fi
  log "the recorded environment is stale; restarting it"
  sh .ai/scripts/test-env-down.sh --keep-services >/dev/null 2>&1 || true
fi
acquire_lock
START=$(date +%s)

# A reset replaces the running environment of this checkout: its applications use the data.
if [ "$RESET" = 1 ] && [ -f "$DESCRIPTOR" ] && [ "$(json_get status "$DESCRIPTOR")" = running ]; then
  log "stopping the running environment $(json_get runId "$DESCRIPTOR") for the reset"
  sh .ai/scripts/test-env-down.sh --keep-services >/dev/null 2>&1 || true
fi

# Never take over or stop a server this script did not start: the test environment of another
# checkout (one per machine) or `pnpm dev` – it is another session's work (#383).
for port in "$WEB_PORT" "$API_PORT"; do
  if curl -s -o /dev/null --max-time 3 "http://localhost:$port/"; then
    log "port $port is already served – by the test environment of another checkout or by pnpm dev. This checkout never stops it: stop it from where it was started (sh .ai/scripts/test-env-down.sh there), then start again."
    exit 1
  fi
done

# The infrastructure publishes fixed host ports: a container of another Compose project holding one
# (e.g. `pnpm dev`, project `trybun`) is never taken over or stopped – it must be stopped first.
for port in $INFRA_PORTS; do
  holder=$(docker ps --filter "publish=$port" --format '{{.Names}} {{.Label "com.docker.compose.project"}}' |
    awk -v own="$COMPOSE_PROJECT" '$2 != own { print $1 " (project " ($2 == "" ? "none" : $2) ")"; exit }')
  if [ -n "$holder" ]; then
    log "port $port is published by $holder. This checkout never stops it: stop it from where it was started, then start again; the test environment runs as the Compose project $COMPOSE_PROJECT"
    exit 1
  fi
done

# --- services: the Compose infrastructure of the local environment (§15.12), as in CI
if [ ! -f .env ]; then
  cp .env.example .env
  log "created .env from .env.example with its optional services (SeaweedFS and ClamAV for attachments)"
fi

# --- reset (--reset): the data volumes of this Compose project only, found by their Compose labels;
# Keycloak imports the development realm again on its first start, the seed below fills the rest
if [ "$RESET" = 1 ]; then
  log "resetting the data of the Compose project $COMPOSE_PROJECT ($DATA_VOLUMES)"
  $COMPOSE down >"$LOG_DIR/reset.log" 2>&1 || { log "stopping the infrastructure failed, see $LOG_DIR/reset.log"; exit 1; }
  for volume in $DATA_VOLUMES; do
    name=$(docker volume ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" \
      --filter "label=com.docker.compose.volume=$volume") ||
      { log "listing the volumes of $COMPOSE_PROJECT failed"; exit 1; }
    [ -n "$name" ] || continue
    docker volume rm "$name" >>"$LOG_DIR/reset.log" 2>&1 ||
      { log "removing the volume $name failed, see $LOG_DIR/reset.log"; exit 1; }
  done
fi
SERVICES_STARTED=true
[ -n "$($COMPOSE ps -q postgres 2>/dev/null)" ] && SERVICES_STARTED=false
# The infrastructure a failed stop of this checkout left running (#449) is still this script's: the
# next stop must take it down rather than leave it as someone else's.
if [ "$SERVICES_STARTED" = false ] && [ -f "$DESCRIPTOR" ] &&
   [ "$(json_get status "$DESCRIPTOR")" = stop-failed ] &&
   [ "$(json_get servicesStartedByScript "$DESCRIPTOR")" = true ]; then
  SERVICES_STARTED=true
fi
log "starting the infrastructure"
run_step "$COMPOSE up -d --wait" "$LOG_DIR/compose.log"
run_step "$COMPOSE wait keycloak-config" "$LOG_DIR/compose.log" append

# --- build cache: install and build only when the sources changed
REUSED_BUILD=true
if build_needed; then
  REUSED_BUILD=false
  log "preparing the workspace: $PREP_CHAIN"
  run_step "$PREP_CHAIN" "$LOG_DIR/build.log" || { log "build failed, see $LOG_DIR/build.log"; exit 1; }
  printf '{ "builtAt": "%s", "sourceFingerprint": "%s", "projectRoot": "%s", "artifactPaths": "%s" }\n' \
    "$(now)" "$CURRENT_FP" "$ROOT" "$ARTIFACTS" > "$BUILD_CACHE"
else
  log "build cache valid; skipping install and build"
fi

# --- database: fresh migrations and the demo dataset on every boot
log "migrating and seeding the database"
run_step "pnpm db:migrate && pnpm db:seed" "$LOG_DIR/database.log" ||
  { log "migration or seed failed, see $LOG_DIR/database.log"; exit 1; }

# --- app start + health wait
# The run id of this boot, recorded as runId once the applications are healthy. Every process of the
# applications inherits it as TEST_ENV_RUN_ID (#453): test-env-down.sh signals a recorded process
# group only while a member still carries it, never a group of another program that the kernel gave
# a recorded PID to after the applications ended without a stop (a crash, a reboot).
BOOT_RUN_ID="$(date -u +%Y%m%d%H%M%S)-$$"
start_bg() { # $1 log name, $2 command – in its own session, so the down script stops the group
  setsid env TEST_ENV_RUN_ID="$BOOT_RUN_ID" sh -c "$2" >"$LOG_DIR/$1.log" 2>&1 < /dev/null &
  echo $!
}
API_PID=$(start_bg api "$API_COMMAND")
WORKER_PID=$(start_bg worker "$WORKER_COMMAND")
WEB_PID=$(start_bg web "$WEB_COMMAND")
log "waiting for the API (PID $API_PID) and the web application (PID $WEB_PID)"
waited=0
until healthy "$API_HEALTH" && healthy "$WEB_HEALTH"; do
  if ! alive "$API_PID" || ! alive "$WORKER_PID" || ! alive "$WEB_PID" || [ "$waited" -ge 180 ]; then
    log "the application did not become healthy; see $LOG_DIR/api.log, $LOG_DIR/worker.log and $LOG_DIR/web.log"
    kill -- "-$API_PID" "-$WORKER_PID" "-$WEB_PID" 2>/dev/null || true
    exit 1
  fi
  # In the background, so a signal to this PID alone is handled at once (a trap waits for a
  # foreground command).
  sleep 2 &
  wait "$!" || true
  waited=$((waited + 2))
done

# --- credentials: demo values of the local environment (README.md), kept out of git
cat > "$CREDENTIALS_FILE" <<'EOF'
TEST_ADMIN_PASSWORD=trybun
TEST_PROJECT_MANAGER_PASSWORD=trybun
TEST_DEVELOPER_PASSWORD=trybun
TEST_NEWCOMER_PASSWORD=trybun
TEST_TOTP_SECRET=ORZHSYTVNYWWY33DMFWC2MTGMEWWWZLZ
EOF

# --- browser provider state, verified at generation
BROWSER_INSTALLED=false
BROWSER_VERSION=unknown
if sh "$BROWSER_COMMAND" --version >/dev/null 2>&1; then
  BROWSER_INSTALLED=true
  BROWSER_VERSION=$(sh "$BROWSER_COMMAND" --version 2>/dev/null | awk '{print $2}')
fi

ELAPSED=$(( $(date +%s) - START ))
# Set only here: the cleanup of an interrupted boot reads a set RUN_ID, recorded in the descriptor, as
# "the descriptor is written".
RUN_ID="$BOOT_RUN_ID"
# Written whole to the temporary file, then renamed over the descriptor (#457): `cat >` on the
# descriptor itself would truncate it first, and a reader in between would see it empty or cut off.
cat > "$DESCRIPTOR_TMP" <<EOF
{
  "version": 1,
  "runId": "$RUN_ID",
  "status": "running",
  "mode": "discovered",
  "baseUrl": "$BASE_URL",
  "startedByThisRepo": true,
  "servicesStartedByScript": $SERVICES_STARTED,
  "composeProject": "$COMPOSE_PROJECT",
  "startScript": ".ai/scripts/test-env-up.sh",
  "stopScript": ".ai/scripts/test-env-down.sh",
  "app": { "startCommand": "$API_COMMAND & $WORKER_COMMAND & $WEB_COMMAND", "port": $WEB_PORT, "healthPath": "/api/health", "apiPid": "$API_PID", "workerPid": "$WORKER_PID", "webPid": "$WEB_PID", "runIdInEnvironment": true, "apiUrl": "http://localhost:$API_PORT" },
  "services": [
    { "type": "compose", "command": "$COMPOSE", "note": "Compose project $COMPOSE_PROJECT, its own containers and volumes; PostgreSQL 5432, Valkey 6379, SeaweedFS 8333, Keycloak 8080, Mailpit 8025" }
  ],
  "credentials": [
    { "role": "admin", "username": "admin@example.com", "passwordEnv": "TEST_ADMIN_PASSWORD", "totpSecretEnv": "TEST_TOTP_SECRET" },
    { "role": "project_manager", "username": "manager@example.com", "passwordEnv": "TEST_PROJECT_MANAGER_PASSWORD", "totpSecretEnv": "TEST_TOTP_SECRET" },
    { "role": "developer", "username": "developer@example.com", "passwordEnv": "TEST_DEVELOPER_PASSWORD", "totpSecretEnv": "TEST_TOTP_SECRET" },
    { "role": "newcomer", "username": "newcomer@example.com", "passwordEnv": "TEST_NEWCOMER_PASSWORD", "totpSecretEnv": "TEST_TOTP_SECRET" }
  ],
  "credentialsFile": "$CREDENTIALS_FILE",
  "browser": {
    "provider": "agent-browser",
    "installed": $BROWSER_INSTALLED,
    "command": "$BROWSER_COMMAND",
    "version": "$BROWSER_VERSION",
    "descriptor": ".ai/browsers/agent-browser.md",
    "notes": "The wrapper sets TMPDIR=/tmp (Chrome's socket path limit) and --no-sandbox (Ubuntu blocks unprivileged user namespaces, as Playwright's default does)"
  },
  "testRunner": { "name": "playwright", "config": "apps/web/playwright.config.ts" },
  "platform": "linux",
  "sourceFingerprint": "$CURRENT_FP",
  "startedAt": "$(now)",
  "notes": "Sign-in goes through Keycloak at localhost:8080: e-mail, password, then a TOTP code of TEST_TOTP_SECRET (all seeded accounts share it; a code is accepted once). The demo dataset has the projects CP, ERP and the archived LEGACY. Build reused: $REUSED_BUILD; boot ${ELAPSED}s; data reset: $([ "$RESET" = 1 ] && echo true || echo false). The data of earlier runs stays until a boot with --reset (before a local E2E run). For a second page of the lists (Load more): sh .ai/scripts/test-env-pages.sh add, and remove afterwards. Stop with: sh .ai/scripts/test-env-down.sh"
}
EOF
mv -f "$DESCRIPTOR_TMP" "$DESCRIPTOR"
log "environment $RUN_ID running at $BASE_URL (${ELAPSED}s)"
print_result 0 "$RUN_ID"
BOOTED=1
