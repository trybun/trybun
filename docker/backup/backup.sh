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

# The volume `backup-data` and the installation folder; the tests replace them.
DATA=${TRYBUN_BACKUP_DATA:-/backup}
INSTALL=${TRYBUN_BACKUP_INSTALL:-/install}
TEMPORARY=${TMPDIR:-/tmp}
LOCAL_REPOSITORY=$DATA/repository
# The set being backed up. It is kept between runs, so only changed objects are copied again.
SET=$DATA/set
RESTORED=$DATA/restored
# Files of the installation folder, mounted at /install, that belong to the configuration.
CONFIGURATION='.env compose.yaml trybun .env.example INSTALL.md LICENSE CHANGELOG.md docker'
DATABASES='trybun keycloak'
# Every snapshot has the same host, so a new server finds the snapshots of the old one.
HOST=trybun
READY=$TEMPORARY/trybun-backup.ready
ERRORS=$TEMPORARY/trybun-backup.errors
# The ID of this server, outside everything a backup contains, so a restore never brings back
# another server's ID; the marker of the storage folder names the server that uses the folder.
SERVER_ID=$DATA/server-id
MARKER=.trybun-installation
# Written into every set: `objects/` holds the storage folder. Sets of earlier releases have no
# such file; their `objects/` held the whole SeaweedFS of Compose, one folder per bucket.
LAYOUT=layout
# TRYBUN_S3_URL of compose.yaml when .env sets none, and the origin of the SeaweedFS of Compose.
DEFAULT_STORAGE_URL=http://seaweedfs:8333/trybun
COMPOSE_SEAWEEDFS=http://seaweedfs:8333
# A storage URL as the server reads TRYBUN_S3_URL (§15.3) and valid_storage_url of deploy/trybun
# accepts it: http or https, a host, an optional port, a bucket name of S3 and an optional folder,
# no credentials, query or fragment, only characters that need no quoting in .env.
STORAGE_URL_PATTERN='[Hh][Tt][Tt][Pp]([Ss])?://(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9._-]+)(:[0-9]{1,5})?/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9](/[A-Za-z0-9._~%+,:@=!-]*)*'

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

fail() {
  log "Error: $*"
  exit 1
}

# The URL $1 without the credentials it may carry, for messages.
redact() {
  printf '%s' "$1" | sed 's|^\([^:/]*://\)[^/]*@|\1***@|'
}

# The repositories of the backups: always the local volume, and the external S3 storage when set.
repositories() {
  printf 'local\n'
  [ -z "${TRYBUN_BACKUP_S3_URL:-}" ] || printf 's3\n'
}

describe() {
  case $1 in
    local) printf 'the local backup volume' ;;
    s3) printf 'the external S3 storage (%s)' "$(redact "$TRYBUN_BACKUP_S3_URL")" ;;
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

# The folder of an S3 URL in a comparable form: the origin in lower case without a default port,
# then the bucket and the folder without empty segments, ending in a slash.
location() {
  origin=$(printf '%s\n' "$1" | sed 's|^\([^/]*//[^/]*\).*|\1|')
  path=$(printf '%s\n' "${1#"$origin"}" | tr -s / | sed 's|^/||; s|/$||')
  origin=$(printf '%s\n' "$origin" | tr '[:upper:]' '[:lower:]' |
    sed 's|^\(https://.*\):443$|\1|; s|^\(http://.*\):80$|\1|')
  printf '%s/%s\n' "$origin" "${path:+$path/}"
}

# Succeeds when the folders $1 and $2 (of `location`) are the same or one contains the other.
overlaps() {
  case $1 in "$2"*) return 0 ;; esac
  case $2 in "$1"*) return 0 ;; esac
  return 1
}

# Succeeds when the restic repository of the URL $1 (TRYBUN_BACKUP_S3_URL: restic's `s3:` prefix
# optional, https without a scheme) and the storage folder LOCATION overlap: a backup would copy
# the repository into itself, and a restore would delete it.
repository_overlaps() {
  [ -n "$1" ] || return 1
  url=${1#s3:}
  case $url in
    *://*) ;;
    *) url=https://$url ;;
  esac
  overlaps "$LOCATION" "$(location "$url")"
}

repository_overlap_message() {
  printf 'The storage folder %s (TRYBUN_S3_URL) and the backup repository %s (TRYBUN_BACKUP_S3_URL) overlap: a backup would copy the repository into itself, and a restore would delete it. Keep them in separate folders, e.g. separate buckets.' \
    "$(redact "$STORAGE_URL")" "$(redact "$1")"
}

# Validates the storage URL $1 like the server and sets ENDPOINT (the scheme and the host in lower
# case, with the port), ORIGIN (without a default port), BUCKET, FOLDER (`/folder` or nothing) and
# LOCATION (`location`). The server resolves `.` and `..` segments, rclone does not: refused.
parse_storage_url() {
  valid=1
  printf '%s\n' "$1" | grep -Eqx "$STORAGE_URL_PATTERN" || valid=
  case $(printf '%s/\n' "${1#*://*/}" | sed 's/%2[Ee]/./g') in
    ./* | ../* | */./* | */../*) valid= ;;
  esac
  if [ -z "$valid" ]; then
    fail "TRYBUN_S3_URL \"$(redact "$1")\" is not the URL of a storage folder. Name http:// or https://, the address of the storage, a bucket and an optional folder, without credentials, query or fragment, e.g. https://s3.example.com/bucket/folder."
  fi
  ENDPOINT=$(printf '%s\n' "$1" | sed 's|^\([^/]*//[^/]*\).*|\1|' | tr '[:upper:]' '[:lower:]')
  path=$(printf '%s\n' "${1#*://*/}" | tr -s / | sed 's|/$||')
  BUCKET=${path%%/*}
  FOLDER=${path#"$BUCKET"}
  LOCATION=$(location "$1")
  ORIGIN=$(location "$ENDPOINT")
  ORIGIN=${ORIGIN%/}
}

# Configures the rclone remote `objects` from TRYBUN_S3_URL (endpoint = origin, bucket = first path
# segment, folder = the rest, as the server reads it), the credentials and the region, with
# path-style addressing; sets STORAGE to the storage folder `objects:{bucket}/{folder}`.
configure_storage() {
  STORAGE_URL=${TRYBUN_S3_URL:-$DEFAULT_STORAGE_URL}
  parse_storage_url "$STORAGE_URL"
  STORAGE=objects:$BUCKET$FOLDER
  export RCLONE_CONFIG_OBJECTS_TYPE=s3
  if is_compose_seaweedfs; then
    export RCLONE_CONFIG_OBJECTS_PROVIDER=SeaweedFS
    unset RCLONE_CONFIG_OBJECTS_NO_CHECK_BUCKET
  else
    export RCLONE_CONFIG_OBJECTS_PROVIDER=Other
    # The API creates a missing bucket when it starts; rclone would try to create it before every
    # write, which an access key limited to the objects of its folder may not.
    export RCLONE_CONFIG_OBJECTS_NO_CHECK_BUCKET=true
  fi
  export RCLONE_CONFIG_OBJECTS_ENDPOINT="$ENDPOINT"
  export RCLONE_CONFIG_OBJECTS_ACCESS_KEY_ID="${TRYBUN_S3_ACCESS_KEY_ID:-}"
  export RCLONE_CONFIG_OBJECTS_SECRET_ACCESS_KEY="${TRYBUN_S3_SECRET_ACCESS_KEY:-}"
  export RCLONE_CONFIG_OBJECTS_REGION="${TRYBUN_S3_REGION:-us-east-1}"
  export RCLONE_CONFIG_OBJECTS_FORCE_PATH_STYLE=true
}

# Succeeds when the storage folder is on the SeaweedFS of Compose.
is_compose_seaweedfs() {
  [ "$ORIGIN" = "$COMPOSE_SEAWEEDFS" ]
}

# The server ID in the marker of the storage folder: nothing when the folder has no marker, `-`
# when its bucket does not exist. Runs in command substitutions, hence the explicit exits.
marker() {
  status=0
  content=$(rclone cat "$STORAGE/$MARKER" 2>"$ERRORS") || status=$?
  case $status in
    0) printf '%s' "$content" | tr -d '[:space:]' ;;
    # rclone: the bucket does not exist. A missing object in a bucket prints nothing.
    3) printf -- - ;;
    *)
      cat "$ERRORS" >&2
      fail "Cannot read the storage folder $(redact "$STORAGE_URL") (rclone exit code $status). Check TRYBUN_S3_URL, the TRYBUN_S3_* credentials and the connection."
      ;;
  esac
}

# `own`, `foreign` or `none`: whether the marker of the storage folder names this server, another
# server or nothing. With `objects`, a folder without a marker that holds objects is `unmarked`:
# it may belong to another application or server, so a restore treats it like `foreign` (Q26).
# Runs in command substitutions, hence the explicit exits.
owner() {
  marked=$(marker) || exit 1
  id=$(server_id) || exit 1
  case $marked in
    '') ;;
    -)
      printf 'none'
      return 0
      ;;
    "$id")
      printf 'own'
      return 0
      ;;
    *)
      printf 'foreign'
      return 0
      ;;
  esac
  if [ "${1-}" = objects ]; then
    rclone lsf --recursive --files-only --exclude "/$MARKER" "$STORAGE" >"$TEMPORARY/objects.list" 2>"$ERRORS" || {
      cat "$ERRORS" >&2
      fail "Cannot list the storage folder $(redact "$STORAGE_URL"). Check TRYBUN_S3_URL, the TRYBUN_S3_* credentials and the connection."
    }
    if [ -s "$TEMPORARY/objects.list" ]; then
      printf 'unmarked'
      return 0
    fi
  fi
  printf 'none'
}

write_marker() {
  id=$(server_id) || return 1
  printf '%s\n' "$id" | rclone rcat "$STORAGE/$MARKER"
}

# Marks the storage folder as the folder of this server, unless its marker names another server:
# only a restore takes over the folder of another server (§15.10). Runs as a condition, where
# `set -e` does not apply: explicit returns.
claim_marker() {
  state=$(owner) || return 1
  case $state in
    own) ;;
    foreign) log "Error: the marker of the storage folder $(redact "$STORAGE_URL") names another Trybun server, so this server leaves it unchanged. Check that TRYBUN_S3_URL names the folder of this installation alone; only ./trybun restore takes over the folder of another server." ;;
    *) write_marker || return 1 ;;
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
  configure_storage
  if repository_overlaps "${TRYBUN_BACKUP_S3_URL:-}"; then
    fail "$(repository_overlap_message "$TRYBUN_BACKUP_S3_URL")"
  fi
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
    [ ! -e "$INSTALL/$name" ] || cp -Rp "$INSTALL/$name" "$SET/configuration/"
  done
  [ -f "$SET/configuration/.env" ] || fail ".env of the installation is missing in $INSTALL."
  log "Copying the objects of the storage folder $(redact "$STORAGE_URL")"
  # The marker first: on SeaweedFS it also creates a missing bucket, so the copy finds the folder.
  claim_marker ||
    fail "Cannot write to the storage folder $(redact "$STORAGE_URL"). Check that its bucket exists (the API creates it when it starts), TRYBUN_S3_URL and the TRYBUN_S3_* credentials."
  rclone sync "$STORAGE" "$SET/objects" --exclude "/$MARKER" ||
    fail "Cannot copy the storage folder $(redact "$STORAGE_URL")."
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

# awk function: the value the line of a .env assigns to the variable `name`, read as Docker Compose
# reads it, or SUBSEP when the line assigns no value to it. Leading blanks, `export `, blanks around
# `=` (or `:`) are allowed; a quoted value ends at its closing quote; an unquoted one at ` #`,
# without trailing blanks. Compose also expands `${…}`, which no storage URL contains. The same
# function as in deploy/trybun, which rewrites the restored .env.
ENV_VALUE='function env_value(line, name, rest, quote, end) {
  sub(/\r$/, "", line)
  sub(/^[ \t]+/, "", line)
  sub(/^export[ \t]+/, "", line)
  if (substr(line, 1, length(name)) != name) return SUBSEP
  rest = substr(line, length(name) + 1)
  if (rest !~ /^[ \t]*[=:]/) return SUBSEP
  sub(/^[ \t]*[=:][ \t]*/, "", rest)
  quote = substr(rest, 1, 1)
  if (quote == "\"" || quote == "\047") {
    rest = substr(rest, 2)
    end = index(rest, quote)
    return end ? substr(rest, 1, end - 1) : rest
  }
  end = index(rest, " #")
  if (end) rest = substr(rest, 1, end - 1)
  sub(/[ \t]+$/, "", rest)
  return rest
}'

# The value of the variable $1 in the `.env` of the fetched backup, as Compose reads it: the last
# assignment counts.
restored_env() {
  awk -v name="$1" "$ENV_VALUE"'
    { value = env_value($0, name); if (value != SUBSEP) found = value }
    END { printf "%s", found }
  ' "$RESTORED/configuration/.env"
}

# Prints `<state> <URL>` for the storage folder the restore replaces: the folder of the fetched
# backup's `.env`, or with a URL (`--storage-url` of `./trybun restore`) that folder, read with the
# credentials of the backup's `.env`. <state> is that of `owner objects`, or:
# - `overlap <URL of the backup's folder>`: the folder of the URL contains the backup's folder or
#   lies inside it, so the restore would change the backup's folder;
# - `repository <URL> <repository URL>`: the folder and a backup repository (TRYBUN_BACKUP_S3_URL of
#   this server or of the backup) overlap, so the restore would delete backups;
# - `external <URL>`, with --test and no URL: the backup's folder is not on the SeaweedFS of
#   Compose, so the backed-up installation may still use it (Q25).
storage_owner() {
  test=
  if [ "${1-}" = --test ]; then
    test=1
    shift
  fi
  [ -f "$RESTORED/configuration/.env" ] || fail 'No fetched backup. Run fetch first.'
  # Created here on a new server, before the restore marks the folder.
  server_id >/dev/null
  restored_repository=$(restored_env TRYBUN_BACKUP_S3_URL)
  for name in TRYBUN_S3_URL TRYBUN_S3_ACCESS_KEY_ID TRYBUN_S3_SECRET_ACCESS_KEY TRYBUN_S3_REGION; do
    export "$name=$(restored_env "$name")"
  done
  configure_storage
  if [ -n "${1-}" ]; then
    backup_url=$STORAGE_URL
    backup_location=$LOCATION
    TRYBUN_S3_URL=$1
    configure_storage
    if overlaps "$LOCATION" "$backup_location"; then
      printf 'overlap %s\n' "$(redact "$backup_url")"
      return 0
    fi
  elif [ -n "$test" ] && ! is_compose_seaweedfs; then
    printf 'external %s\n' "$(redact "$STORAGE_URL")"
    return 0
  fi
  for repository in "${TRYBUN_BACKUP_S3_URL:-}" "$restored_repository"; do
    if repository_overlaps "$repository"; then
      printf 'repository %s %s\n' "$(redact "$STORAGE_URL")" "$(redact "$repository")"
      return 0
    fi
  done
  state=$(owner objects) || exit 1
  printf '%s %s\n' "$state" "$(redact "$STORAGE_URL")"
}

# Replaces both databases and the objects of the storage folder with those of the fetched backup.
# The applications must be stopped; the restored `.env` must be in use. A folder whose marker names
# another server, or without a marker but with objects, is replaced only with
# --replace-foreign-objects.
restore_data() {
  [ -d "$RESTORED/databases" ] || fail 'No fetched backup. Run fetch first.'
  lock
  # The folder in use must be the backup's one or, after --storage-url, lie outside it, as
  # storage-owner checked, also when Compose read the restored .env otherwise than this script.
  backup_url=$(restored_env TRYBUN_S3_URL)
  parse_storage_url "${backup_url:-$DEFAULT_STORAGE_URL}"
  backup_location=$LOCATION
  configure_storage
  unchanged='The databases and the storage folder were not changed.'
  if [ "$LOCATION" != "$backup_location" ] && overlaps "$LOCATION" "$backup_location"; then
    fail "The storage folder $(redact "$STORAGE_URL") overlaps the storage folder $(redact "${backup_url:-$DEFAULT_STORAGE_URL}") of the backup. $unchanged"
  fi
  if repository_overlaps "${TRYBUN_BACKUP_S3_URL:-}"; then
    fail "$(repository_overlap_message "$TRYBUN_BACKUP_S3_URL") $unchanged"
  fi
  state=$(owner objects) || exit 1
  if [ "${1-}" != --replace-foreign-objects ]; then
    case $state in
      foreign) fail "The storage folder $(redact "$STORAGE_URL") belongs to another Trybun server. Run ./trybun restore again in a terminal to confirm, or with --replace-foreign-objects. $unchanged" ;;
      unmarked) fail "The storage folder $(redact "$STORAGE_URL") holds objects but no Trybun marker, so it may belong to another application or server. Run ./trybun restore again in a terminal to confirm, or with --replace-foreign-objects. $unchanged" ;;
    esac
  fi
  marked=$(marker) || exit 1
  if [ "$marked" = - ]; then
    # rclone creates no bucket on an external storage (configure_storage); a restore must.
    log "Creating the bucket $BUCKET"
    rclone mkdir "objects,no_check_bucket=false:$BUCKET"
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
    if is_compose_seaweedfs && [ -d "$RESTORED/objects/$BUCKET$FOLDER" ]; then
      objects=$RESTORED/objects/$BUCKET$FOLDER
    fi
    mkdir -p "$objects"
  fi
  log "Restoring the objects of the storage folder $(redact "$STORAGE_URL")"
  rclone sync "$objects" "$STORAGE" --exclude "/$MARKER"
  write_marker
  rm -rf "$RESTORED"
  log 'Restored.'
}

# Deletes the fetched backup, e.g. after ./trybun restore stopped before it stopped Trybun: the
# restore folder holds the databases and the .env of the backup.
discard() {
  lock
  rm -rf "$RESTORED"
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
  configure_storage
  if repository_overlaps "${TRYBUN_BACKUP_S3_URL:-}"; then
    fail "$(repository_overlap_message "$TRYBUN_BACKUP_S3_URL")"
  fi
  for repository in $(repositories); do
    ensure_repository "$repository"
  done
  server_id >/dev/null
  [ -n "${TRYBUN_BACKUP_S3_URL:-}" ] ||
    log 'Warning: TRYBUN_BACKUP_S3_URL is not set, so the backups are kept only on this server.'
  touch "$READY"
  # The folder is marked from the start, not only from the first daily backup on, so a restore
  # onto another server with this .env asks before it replaces the folder. A storage that is not
  # reachable yet does not stop the service.
  claim_marker ||
    log 'Warning: the marker of the storage folder could not be written; the daily backup writes it.'
  trap 'exit 0' INT TERM
  while :; do
    wait_seconds=$(seconds_until "$time")
    log "Next backup at $time UTC, in $wait_seconds seconds."
    sleep "$wait_seconds" &
    wait $!
    # In a subshell, which closes the lock when it ends: the service runs on, and a lock held by
    # this shell would block every later `./trybun backup`, `restore` and `update`. Not as a
    # condition (`… || log`), where shells ignore `set -e` in the whole subshell, so a failing
    # step would not stop the backup: `set +e` keeps only this shell running.
    set +e
    (
      set -e
      backup daily
    ) >/dev/null
    status=$?
    set -e
    [ "$status" -eq 0 ] || log 'Error: the daily backup failed; the next one runs tomorrow.'
  done
}

case ${1-} in
  schedule) schedule ;;
  backup) backup "${2-}" ;;
  list) list ;;
  fetch) fetch "${2-}" ;;
  configuration) configuration ;;
  storage-owner)
    shift
    storage_owner "$@"
    ;;
  restore-data) restore_data "${2-}" ;;
  discard) discard ;;
  # rclone with the remote `objects` of the storage, for the restore test and diagnosis.
  rclone)
    shift
    configure_storage
    exec rclone "$@"
    ;;
  *) fail "Unknown command \"${1-}\". Commands: schedule, backup [tag], list, fetch [snapshot], configuration, storage-owner [--test] [url], restore-data [--replace-foreign-objects], discard, rclone <arguments>." ;;
esac
