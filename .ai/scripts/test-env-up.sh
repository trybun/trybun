#!/bin/sh
# om-prepare-test-env: generated entrypoint (contract v2)
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-10-27 generated: the local environment of §15.12 as the E2E job of CI runs it –
#              Compose infrastructure, migrations and the demo dataset, production builds of the
#              API (3001) and the web application (3000); cold 39s (Turbo cache warm), warm 0s (reused)
set -eu

# --- project-specific facts (discovered from README.md, compose*.yaml, ci.yml, playwright.config.ts)
COMPOSE="docker compose -f compose.yaml -f compose.dev.yaml"
WEB_PORT=3000                       # fixed: Keycloak's redirect URIs and the sessions use it
API_PORT=3001                       # fixed: the web application reaches the API there (.env)
BASE_URL="http://localhost:$WEB_PORT"
WEB_HEALTH="$BASE_URL/api/health"
API_HEALTH="http://localhost:$API_PORT/health/ready"   # checks PostgreSQL too
# The parallel E2E/QA requests share the seeded accounts, as in playwright.config.ts.
export TRYBUN_RATE_LIMIT_PER_USER=10000 TRYBUN_RATE_LIMIT_PER_IP=10000
API_COMMAND="pnpm --filter @trybun/server start"
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
CREDENTIALS_FILE="$QA_DIR/test-env.env"
BUILD_CACHE="$QA_DIR/test-env-build-cache.json"
LOCK_DIR="$QA_DIR/test-env.lock"
LOG_DIR="$QA_DIR/logs"
mkdir -p "$QA_DIR" "$LOG_DIR"

FORCE=0
FORCE_REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --force-rebuild) FORCE_REBUILD=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { printf '[test-env] %s\n' "$*" >&2; }
json_get() { sed -n "s/.*\"$1\": *\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$2" | head -1; }
alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }
healthy() { curl -fsS --max-time 5 -o /dev/null "$1" 2>/dev/null; }

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
  trap 'rm -rf "$LOCK_DIR"' EXIT INT TERM
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

print_result() {
  printf 'TEST_ENV_STATUS=running\nTEST_ENV_BASE_URL=%s\nTEST_ENV_DESCRIPTOR=%s\nTEST_ENV_REUSED=%s\n' \
    "$BASE_URL" "$DESCRIPTOR" "$1"
  printf 'BROWSER_PROVIDER=agent-browser\nBROWSER_INSTALLED=%s\n' "$(json_get installed "$DESCRIPTOR")"
}

CURRENT_FP=$(fingerprint)

# --- reuse check: attach to a running environment of this checkout
if [ "$FORCE" = 0 ] && [ -f "$DESCRIPTOR" ] && [ "$(json_get status "$DESCRIPTOR")" = running ]; then
  api_pid=$(json_get apiPid "$DESCRIPTOR")
  web_pid=$(json_get webPid "$DESCRIPTOR")
  if alive "$api_pid" && alive "$web_pid" && healthy "$WEB_HEALTH" && healthy "$API_HEALTH" &&
     [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$API_PORT/api/v1/users/me")" = 401 ] &&
     [ "$(age_seconds "$(json_get startedAt "$DESCRIPTOR")")" -lt "$TTL_SECONDS" ] &&
     [ "$(json_get sourceFingerprint "$DESCRIPTOR")" = "$CURRENT_FP" ]; then
    log "reusing the running environment $(json_get runId "$DESCRIPTOR")"
    print_result 1
    exit 0
  fi
  log "the recorded environment is stale; restarting it"
  sh .ai/scripts/test-env-down.sh --keep-services >/dev/null 2>&1 || true
fi

acquire_lock
START=$(date +%s)

# Never take over a server this script did not start (e.g. `pnpm dev`).
for port in "$WEB_PORT" "$API_PORT"; do
  if curl -s -o /dev/null --max-time 3 "http://localhost:$port/"; then
    log "port $port is served by a process this script did not start – stop it (e.g. pnpm dev) first"
    exit 1
  fi
done

# --- services: the Compose infrastructure of the local environment (§15.12), as in CI
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i.bak 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=/' .env && rm -f .env.bak
  log "created .env from .env.example without the optional services"
fi
SERVICES_STARTED=true
[ -n "$($COMPOSE ps -q postgres 2>/dev/null)" ] && SERVICES_STARTED=false
log "starting the infrastructure"
$COMPOSE up -d --wait >"$LOG_DIR/compose.log" 2>&1
$COMPOSE wait keycloak-config >>"$LOG_DIR/compose.log" 2>&1

# --- build cache: install and build only when the sources changed
REUSED_BUILD=true
if build_needed; then
  REUSED_BUILD=false
  log "preparing the workspace: $PREP_CHAIN"
  sh -c "$PREP_CHAIN" >"$LOG_DIR/build.log" 2>&1 || { log "build failed, see $LOG_DIR/build.log"; exit 1; }
  printf '{ "builtAt": "%s", "sourceFingerprint": "%s", "projectRoot": "%s", "artifactPaths": "%s" }\n' \
    "$(now)" "$CURRENT_FP" "$ROOT" "$ARTIFACTS" > "$BUILD_CACHE"
else
  log "build cache valid; skipping install and build"
fi

# --- database: fresh migrations and the demo dataset on every boot
log "migrating and seeding the database"
{ pnpm db:migrate && pnpm db:seed; } >"$LOG_DIR/database.log" 2>&1 ||
  { log "migration or seed failed, see $LOG_DIR/database.log"; exit 1; }

# --- app start + health wait
start_bg() { # $1 log name, $2 command – in its own session, so the down script stops the group
  setsid sh -c "$2" >"$LOG_DIR/$1.log" 2>&1 < /dev/null &
  echo $!
}
API_PID=$(start_bg api "$API_COMMAND")
WEB_PID=$(start_bg web "$WEB_COMMAND")
log "waiting for the API (PID $API_PID) and the web application (PID $WEB_PID)"
waited=0
until healthy "$API_HEALTH" && healthy "$WEB_HEALTH"; do
  if ! alive "$API_PID" || ! alive "$WEB_PID" || [ "$waited" -ge 180 ]; then
    log "the application did not become healthy; see $LOG_DIR/api.log and $LOG_DIR/web.log"
    kill -- "-$API_PID" "-$WEB_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 2
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
RUN_ID="$(date -u +%Y%m%d%H%M%S)-$$"
cat > "$DESCRIPTOR" <<EOF
{
  "version": 1,
  "runId": "$RUN_ID",
  "status": "running",
  "mode": "discovered",
  "baseUrl": "$BASE_URL",
  "startedByThisRepo": true,
  "servicesStartedByScript": $SERVICES_STARTED,
  "startScript": ".ai/scripts/test-env-up.sh",
  "stopScript": ".ai/scripts/test-env-down.sh",
  "app": { "startCommand": "$API_COMMAND & $WEB_COMMAND", "port": $WEB_PORT, "healthPath": "/api/health", "apiPid": "$API_PID", "webPid": "$WEB_PID", "apiUrl": "http://localhost:$API_PORT" },
  "services": [
    { "type": "compose", "command": "$COMPOSE", "note": "PostgreSQL 5432, Valkey 6379, SeaweedFS 8333, Keycloak 8080, Mailpit 8025" }
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
  "notes": "Sign-in goes through Keycloak at localhost:8080: e-mail, password, then a TOTP code of TEST_TOTP_SECRET (all seeded accounts share it; a code is accepted once). The demo dataset has the projects CP, ERP and the archived LEGACY. Build reused: $REUSED_BUILD; boot ${ELAPSED}s. Stop with: sh .ai/scripts/test-env-down.sh"
}
EOF
log "environment $RUN_ID running at $BASE_URL (${ELAPSED}s)"
print_result 0
