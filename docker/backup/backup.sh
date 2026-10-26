#!/bin/sh
# Entry point of the backup service (§15.10), ghcr.io/trybun/backup. A backup is one set of both
# databases (pg_dump, custom format), the objects of the object storage and the configuration
# (`.env` and the files of the deployment package, so a restore starts the backed-up version),
# encrypted by restic with TRYBUN_BACKUP_PASSPHRASE into the repository on the local volume and,
# when TRYBUN_BACKUP_S3_URL is set, into the one on the external S3 storage. The commands of
# `./trybun` (backup, restore, update) run it as a one-off container; the service runs `schedule`.
# Messages go to stderr; stdout carries only results (snapshot IDs, the configuration archive).
set -eu

DATA=/backup
LOCAL_REPOSITORY=$DATA/repository
# The set being backed up. It is kept between runs, so only changed objects are copied again.
SET=$DATA/set
RESTORED=$DATA/restored
# Files of the installation folder, mounted at /install, that belong to the configuration.
CONFIGURATION='.env compose.yaml trybun .env.example INSTALL.md LICENSE CHANGELOG.md docker'
DATABASES='trybun keycloak'
# Every snapshot has the same host, so a new server finds the snapshots of the old one.
HOST=trybun
READY=/tmp/trybun-backup.ready

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

fail() {
  log "Error: $*"
  exit 1
}

# The repositories of the backups: always the local volume, and the external S3 storage when set.
repositories() {
  printf 'local\n'
  [ -z "${TRYBUN_BACKUP_S3_URL:-}" ] || printf 's3\n'
}

describe() {
  case $1 in
    local) printf 'the local backup volume' ;;
    s3) printf 'the external S3 storage (%s)' "$TRYBUN_BACKUP_S3_URL" ;;
  esac
}

repository_restic() {
  repository=$1
  shift
  case $repository in
    local) restic --repo "$LOCAL_REPOSITORY" "$@" ;;
    s3) restic --repo "s3:$TRYBUN_BACKUP_S3_URL" "$@" ;;
  esac
}

# Succeeds when the repository exists; creates nothing.
repository_exists() {
  status=0
  repository_restic "$1" cat config >/dev/null 2>&1 || status=$?
  case $status in
    0) return 0 ;;
    # restic: the repository does not exist.
    10) return 1 ;;
    12) fail "TRYBUN_BACKUP_PASSPHRASE does not open the backups on $(describe "$1"). Set the passphrase of these backups in .env." ;;
    *) fail "Cannot reach the backups on $(describe "$1") (restic exit code $status). Check the TRYBUN_BACKUP_S3_* settings in .env and the connection." ;;
  esac
}

ensure_repository() {
  repository_exists "$1" && return
  log "Creating the backup repository on $(describe "$1")"
  repository_restic "$1" init --repository-version 2 >/dev/null
}

has_object_storage() {
  case ",${COMPOSE_PROFILES:-}," in
    *,seaweedfs,*) return 0 ;;
    *) return 1 ;;
  esac
}

# One run at a time: a scheduled backup waits for a restore and the other way round.
lock() {
  exec 9>"$DATA/.lock"
  flock 9
}

backup() {
  tag=${1:-manual}
  lock
  mkdir -p "$SET/databases" "$SET/objects"
  for database in $DATABASES; do
    log "Dumping the database $database"
    # Uncompressed, so restic deduplicates unchanged data; restic compresses the repository.
    pg_dump --format=custom --compress=0 --file="$SET/databases/$database.dump.partial" "$database"
    mv "$SET/databases/$database.dump.partial" "$SET/databases/$database.dump"
  done
  log 'Copying the configuration'
  rm -rf "$SET/configuration"
  mkdir "$SET/configuration"
  for name in $CONFIGURATION; do
    [ ! -e "/install/$name" ] || cp -Rp "/install/$name" "$SET/configuration/"
  done
  [ -f "$SET/configuration/.env" ] || fail '.env of the installation is missing in /install.'
  if has_object_storage; then
    log 'Copying the objects of the object storage'
    rclone sync objects: "$SET/objects"
  else
    rm -rf "$SET/objects"
    mkdir "$SET/objects"
  fi
  failed=
  for repository in $(repositories); do
    if ! store "$repository" "$tag"; then
      log "Error: the backup on $(describe "$repository") failed."
      failed=1
    fi
  done
  [ -z "$failed" ]
}

# Stores the set in one repository, prints `<repository> <snapshot ID>` and applies the retention.
# Runs as a condition, where `set -e` does not apply, hence the explicit returns.
store() {
  ensure_repository "$1" || return 1
  log "Storing the backup on $(describe "$1")"
  summary=$(repository_restic "$1" backup --json --quiet --host "$HOST" \
    --tag "$2" --tag "version=${TRYBUN_VERSION:-unknown}" "$SET") || return 1
  snapshot=$(printf '%s\n' "$summary" | sed -n 's/.*"snapshot_id":"\([0-9a-f]\{8\}\).*/\1/p' | tail -n 1)
  [ -n "$snapshot" ] || return 1
  printf '%s %s\n' "$1" "$snapshot"
  keep=${TRYBUN_BACKUP_KEEP_DAILY:-30}
  repository_restic "$1" forget --quiet --host "$HOST" \
    --keep-daily "$keep" --keep-within "${keep}d" --prune >/dev/null || return 1
}

list() {
  for repository in $(repositories); do
    printf 'Backups on %s:\n' "$(describe "$repository")"
    if repository_exists "$repository"; then
      repository_restic "$repository" snapshots --compact --host "$HOST"
    else
      printf '  none\n'
    fi
  done
}

# Restores a snapshot – `latest` or an ID – into the restore folder: from the local volume when it
# has it, else from the external S3 storage (a new server).
fetch() {
  snapshot=${1:-latest}
  lock
  from=
  for repository in $(repositories); do
    if repository_exists "$repository" &&
      repository_restic "$repository" snapshots --json --host "$HOST" "$snapshot" 2>/dev/null | grep -q '"id"'; then
      from=$repository
      break
    fi
  done
  [ -n "$from" ] || fail "No backup \"$snapshot\" found. See ./trybun backup list."
  log "Restoring the backup $snapshot from $(describe "$from")"
  repository_restic "$from" snapshots --compact --host "$HOST" "$snapshot" >&2
  rm -rf "$RESTORED"
  repository_restic "$from" restore --quiet --host "$HOST" --target "$RESTORED" "$snapshot:$SET"
  [ -f "$RESTORED/configuration/.env" ] || fail "The backup $snapshot contains no configuration."
}

# The configuration of the fetched backup as a tar archive on stdout; the host unpacks it, so its
# files belong to the user running ./trybun.
configuration() {
  [ -d "$RESTORED/configuration" ] || fail 'No fetched backup. Run fetch first.'
  tar -C "$RESTORED/configuration" -cf - .
}

# Replaces both databases and the objects with those of the fetched backup. The applications must
# be stopped; the restored `.env` must be in use.
restore_data() {
  [ -d "$RESTORED/databases" ] || fail 'No fetched backup. Run fetch first.'
  lock
  for database in $DATABASES; do
    log "Restoring the database $database"
    psql --dbname=postgres --quiet --set=ON_ERROR_STOP=1 \
      --command="DROP DATABASE IF EXISTS \"$database\" WITH (FORCE)"
    pg_restore --dbname=postgres --create --exit-on-error "$RESTORED/databases/$database.dump"
  done
  if has_object_storage; then
    log 'Restoring the objects of the object storage'
    rclone sync "$RESTORED/objects" objects:
  fi
  rm -rf "$RESTORED"
  log 'Restored.'
}

# Seconds until the next backup time (HH:MM, UTC).
seconds_until() {
  now=$(date -u +%s)
  next=$(date -u -d "$(date -u +%Y-%m-%d) $1" +%s)
  [ "$next" -gt "$now" ] || next=$((next + 86400))
  printf '%s' $((next - now))
}

# The service: a backup every day at TRYBUN_BACKUP_TIME. Wrong settings stop it at the start, so
# `docker compose up --wait` reports them.
schedule() {
  time=${TRYBUN_BACKUP_TIME:-03:00}
  printf '%s\n' "$time" | grep -Eqx '([01][0-9]|2[0-3]):[0-5][0-9]' ||
    fail "TRYBUN_BACKUP_TIME \"$time\" is not a time HH:MM (UTC)."
  for repository in $(repositories); do
    ensure_repository "$repository"
  done
  [ -n "${TRYBUN_BACKUP_S3_URL:-}" ] ||
    log 'Warning: TRYBUN_BACKUP_S3_URL is not set, so the backups are kept only on this server.'
  touch "$READY"
  trap 'exit 0' INT TERM
  while :; do
    wait_seconds=$(seconds_until "$time")
    log "Next backup at $time UTC, in $wait_seconds seconds."
    sleep "$wait_seconds" &
    wait $!
    # In a subshell, which closes the lock when it ends: the service runs on, and a lock held by
    # this shell would block every later `./trybun backup`, `restore` and `update`.
    (backup daily) >/dev/null || log 'Error: the daily backup failed; the next one runs tomorrow.'
  done
}

case ${1-} in
  schedule) schedule ;;
  backup) backup "${2-}" ;;
  list) list ;;
  fetch) fetch "${2-}" ;;
  configuration) configuration ;;
  restore-data) restore_data ;;
  *) fail "Unknown command \"${1-}\". Commands: schedule, backup [tag], list, fetch [snapshot], configuration, restore-data." ;;
esac
