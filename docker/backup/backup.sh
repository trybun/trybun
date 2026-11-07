#!/bin/sh
# Entry point of the backup service (§15.10), ghcr.io/trybun/backup. A backup is one set of both
# databases (pg_dump, custom format), the objects of the storage folder of TRYBUN_S3_URL (SeaweedFS
# of Compose or an external S3 storage) and the configuration (`.env` and the files of the
# deployment package, so a restore starts the backed-up version),
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
# The ID of this server, outside everything a backup contains, so a restore never brings back
# another server's ID; the marker of the storage folder names the server that uses the folder.
SERVER_ID=$DATA/server-id
MARKER=.trybun-installation
# Written into every set: `objects/` holds the storage folder. Sets of earlier releases have no
# such file; their `objects/` held the whole SeaweedFS of Compose, one folder per bucket.
LAYOUT=layout

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

has_seaweedfs() {
  case ",${COMPOSE_PROFILES:-}," in
    *,seaweedfs,*) return 0 ;;
    *) return 1 ;;
  esac
}

# The ID of this server; created on first use (the service's start in `./trybun install`, or
# `./trybun restore` on a new server). A link never replaces an ID written meanwhile.
server_id() {
  if [ ! -s "$SERVER_ID" ]; then
    temporary=$(mktemp "$SERVER_ID.XXXXXX")
    cat /proc/sys/kernel/random/uuid >"$temporary"
    ln "$temporary" "$SERVER_ID" 2>/dev/null || true
    rm -f "$temporary"
  fi
  id=$(cat "$SERVER_ID")
  [ -n "$id" ] || fail "$SERVER_ID is empty. Delete it, so a new server ID is created."
  printf '%s\n' "$id"
}

# Configures the rclone remote `objects` from TRYBUN_S3_URL (endpoint = origin, bucket = first path
# segment, folder = the rest, as the server reads it), the credentials and the region, with
# path-style addressing; sets STORAGE to the storage folder `objects:{bucket}/{folder}`.
configure_storage() {
  url=${TRYBUN_S3_URL:-http://seaweedfs:8333/trybun}
  endpoint=$(printf '%s\n' "$url" | sed -n 's|^\(https\{0,1\}://[^/?#]\{1,\}\).*|\1|p')
  path=$(printf '%s\n' "${url#"$endpoint"}" | tr -s / | sed 's|^/||; s|/$||')
  bucket=${path%%/*}
  if [ -z "$endpoint" ] || [ -z "$bucket" ]; then
    fail "TRYBUN_S3_URL \"$url\" is not the URL of a bucket, e.g. https://s3.example.com/bucket/folder."
  fi
  folder=${path#"$bucket"}
  STORAGE=objects:$bucket$folder
  STORAGE_URL=$url
  # The folder in a comparable form: the origin in lower case without a default port, then the
  # bucket and the folder, ending in a slash.
  origin=$(printf '%s\n' "$endpoint" | tr '[:upper:]' '[:lower:]' |
    sed 's|^\(https://.*\):443$|\1|; s|^\(http://.*\):80$|\1|')
  LOCATION=$origin/$bucket$folder/
  export RCLONE_CONFIG_OBJECTS_TYPE=s3
  if has_seaweedfs; then
    export RCLONE_CONFIG_OBJECTS_PROVIDER=SeaweedFS
  else
    export RCLONE_CONFIG_OBJECTS_PROVIDER=Other
  fi
  export RCLONE_CONFIG_OBJECTS_ENDPOINT="$endpoint"
  export RCLONE_CONFIG_OBJECTS_ACCESS_KEY_ID="${TRYBUN_S3_ACCESS_KEY_ID:-}"
  export RCLONE_CONFIG_OBJECTS_SECRET_ACCESS_KEY="${TRYBUN_S3_SECRET_ACCESS_KEY:-}"
  export RCLONE_CONFIG_OBJECTS_REGION="${TRYBUN_S3_REGION:-us-east-1}"
  export RCLONE_CONFIG_OBJECTS_FORCE_PATH_STYLE=true
}

# The server ID in the marker of the storage folder; nothing when the folder has no marker.
marker() {
  status=0
  content=$(rclone cat "$STORAGE/$MARKER" 2>/tmp/marker.errors) || status=$?
  case $status in
    0) printf '%s' "$content" | tr -d '[:space:]' ;;
    # rclone: the bucket does not exist. A missing object in a bucket prints nothing.
    3) ;;
    *)
      cat /tmp/marker.errors >&2
      fail "Cannot read the storage folder $STORAGE_URL (rclone exit code $status). Check TRYBUN_S3_URL, the TRYBUN_S3_* credentials and the connection."
      ;;
  esac
}

# `own`, `none` or `foreign`: whether the marker of the storage folder names this server, nothing
# or another server.
owner() {
  # `set -e` does not reach into command substitutions of BusyBox sh, hence the explicit exits.
  marked=$(marker) || exit 1
  id=$(server_id) || exit 1
  if [ -z "$marked" ]; then
    printf 'none'
  elif [ "$marked" = "$id" ]; then
    printf 'own'
  else
    printf 'foreign'
  fi
}

# Runs also in the daily backup, a condition where `set -e` does not apply: explicit returns.
write_marker() {
  id=$(server_id) || return 1
  printf '%s\n' "$id" | rclone rcat "$STORAGE/$MARKER"
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
  configure_storage
  log "Copying the objects of the storage folder $STORAGE_URL"
  # The marker first, which also creates a missing bucket, so the copy finds the folder.
  write_marker || fail "Cannot write to the storage folder $STORAGE_URL."
  rclone sync "$STORAGE" "$SET/objects" --exclude "/$MARKER" ||
    fail "Cannot copy the storage folder $STORAGE_URL."
  printf 'objects=folder\n' >"$SET/$LAYOUT"
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

# The value of the variable $1 in the `.env` of the fetched backup, without enclosing quotes.
restored_env() {
  value=$(sed -n "s/^$1=//p" "$RESTORED/configuration/.env" | tail -n 1)
  case $value in
    \"*\" | \'*\') value=${value#?} value=${value%?} ;;
  esac
  printf '%s' "$value"
}

# Prints `own|none|foreign <URL>` for the storage folder of the fetched backup's `.env`, the folder
# its restore replaces: `./trybun restore` asks before it replaces a folder of another server.
# With a URL (`--storage-url` of `./trybun restore`), for that folder instead, with the credentials
# of the backup's `.env`; `overlap <URL of the backup's folder>` when one folder contains the
# other, since such a restore would change the backup's folder.
storage_owner() {
  [ -f "$RESTORED/configuration/.env" ] || fail 'No fetched backup. Run fetch first.'
  # Created here on a new server, before the restore marks the folder.
  server_id >/dev/null
  for name in TRYBUN_S3_URL TRYBUN_S3_ACCESS_KEY_ID TRYBUN_S3_SECRET_ACCESS_KEY TRYBUN_S3_REGION; do
    export "$name=$(restored_env "$name")"
  done
  configure_storage
  if [ -n "${1-}" ]; then
    backup_url=$STORAGE_URL
    backup_location=$LOCATION
    TRYBUN_S3_URL=$1
    configure_storage
    case $LOCATION in
      "$backup_location"*) overlap=1 ;;
      *) case $backup_location in "$LOCATION"*) overlap=1 ;; *) overlap= ;; esac ;;
    esac
    if [ -n "$overlap" ]; then
      printf 'overlap %s\n' "$backup_url"
      return 0
    fi
  fi
  state=$(owner) || exit 1
  printf '%s %s\n' "$state" "$STORAGE_URL"
}

# Replaces both databases and the objects of the storage folder with those of the fetched backup.
# The applications must be stopped; the restored `.env` must be in use. A folder whose marker names
# another server is replaced only with --replace-foreign-objects.
restore_data() {
  [ -d "$RESTORED/databases" ] || fail 'No fetched backup. Run fetch first.'
  lock
  configure_storage
  state=$(owner) || exit 1
  if [ "$state" = foreign ] && [ "${1-}" != --replace-foreign-objects ]; then
    fail "The storage folder $STORAGE_URL belongs to another Trybun server. Run ./trybun restore again in a terminal to confirm, or with --replace-foreign-objects. The data was not changed."
  fi
  for database in $DATABASES; do
    log "Restoring the database $database"
    psql --dbname=postgres --quiet --set=ON_ERROR_STOP=1 \
      --command="DROP DATABASE IF EXISTS \"$database\" WITH (FORCE)"
    pg_restore --dbname=postgres --create --exit-on-error "$RESTORED/databases/$database.dump"
  done
  objects=$RESTORED/objects
  if [ ! -f "$RESTORED/$LAYOUT" ]; then
    # A set of an earlier release, which copied the whole SeaweedFS of Compose: the storage folder
    # is at its bucket and folder path there. Before S1-08 there was no bucket of attachments, and
    # an external storage was not backed up, so the folder is left empty, the state of that time.
    objects=$RESTORED/empty
    if [ "$RCLONE_CONFIG_OBJECTS_ENDPOINT" = http://seaweedfs:8333 ] &&
      [ -d "$RESTORED/objects/${STORAGE#objects:}" ]; then
      objects=$RESTORED/objects/${STORAGE#objects:}
    fi
    mkdir -p "$objects"
  fi
  log "Restoring the objects of the storage folder $STORAGE_URL"
  rclone sync "$objects" "$STORAGE" --exclude "/$MARKER"
  write_marker
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
  server_id >/dev/null
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
  storage-owner) storage_owner "${2-}" ;;
  restore-data) restore_data "${2-}" ;;
  # rclone with the remote `objects` of the storage, for the restore test and diagnosis.
  rclone)
    shift
    configure_storage
    exec rclone "$@"
    ;;
  *) fail "Unknown command \"${1-}\". Commands: schedule, backup [tag], list, fetch [snapshot], configuration, storage-owner [url], restore-data [--replace-foreign-objects], rclone <arguments>." ;;
esac
