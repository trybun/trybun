#!/bin/sh
# Restore test of a release (§13.6), run by the release workflow before anything is published:
# installs the deployment package on a first "server", creates a user in Keycloak, an object in the
# attachment folder of SeaweedFS and records in the system database, backs up to an S3 storage
# outside the server, destroys the server (containers, volumes, folder), restores onto a new one
# from the deployment package, .env and the passphrase alone, and checks that the user signs in
# with the same ID and the objects and records are the same. A second pair of servers keeps its
# attachments on that S3 storage instead of SeaweedFS (§15.10): the restore refuses the folder of
# the lost server without a terminal, restores a test copy into another folder with --storage-url
# while the folder of the backup stays unchanged, and replaces the folder of the lost server with
# --replace-foreign-objects, bringing back an object deleted after the backup.
# Usage: scripts/restore-test.sh <deployment package archive>
# Needs Docker, free ports 80 and 443, and the images of the release (pulled or loaded).
set -eu

archive=$(cd "$(dirname -- "$1")" && pwd)/$(basename -- "$1")
work=$(mktemp -d)
s3=trybun-restore-test-s3
# The optional services without ClamAV, which needs minutes to start; a project name of its own.
export COMPOSE_PROFILES=seaweedfs
export COMPOSE_PROJECT_NAME=trybun-restore-test

step() {
  printf '\n=== %s\n' "$*"
}

fail() {
  printf 'Restore test failed: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  for server in "$work"/server-*; do
    [ ! -f "$server/compose.yaml" ] || (cd "$server" && docker compose down --volumes --remove-orphans >/dev/null 2>&1) || true
  done
  docker rm --force "$s3" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

# A server: the unpacked deployment package in a folder of its own.
unpack() {
  mkdir "$work/$1"
  tar -xzf "$archive" -C "$work/$1" --strip-components=1
}

# Runs a Node.js program from stdin in the api container, with the variables given as arguments.
api_node() {
  count=$#
  while [ "$count" -gt 0 ]; do
    set -- "$@" --env "$1"
    shift
    count=$((count - 1))
  done
  docker compose exec -T "$@" api node --input-type=module -
}

# Creates an end user with a password through the Keycloak Admin API; prints its ID.
create_user() {
  api_node "USER_PASSWORD=$1" <<'EOF'
const keycloak = process.env.TRYBUN_KEYCLOAK_URL;
const response = await fetch(`${keycloak}/realms/trybun/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: 'trybun-server',
    client_secret: process.env.TRYBUN_KEYCLOAK_SERVER_CLIENT_SECRET,
  }),
});
const { access_token: token } = await response.json();
const created = await fetch(`${keycloak}/admin/realms/trybun/users`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    username: 'restore-test@example.com',
    email: 'restore-test@example.com',
    emailVerified: true,
    firstName: 'Restore',
    lastName: 'Test',
    enabled: true,
    credentials: [{ type: 'password', value: process.env.USER_PASSWORD, temporary: false }],
  }),
});
if (created.status !== 201) {
  throw new Error(`Creating the user: ${created.status} ${await created.text()}`);
}
console.log(created.headers.get('location').split('/').pop());
EOF
}

# Signs in with the password (direct grant of the realm's admin-cli client); prints the user ID
# of the ID token.
sign_in() {
  api_node "USER_PASSWORD=$1" <<'EOF'
const response = await fetch(
  `${process.env.TRYBUN_KEYCLOAK_URL}/realms/trybun/protocol/openid-connect/token`,
  {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      scope: 'openid',
      username: 'restore-test@example.com',
      password: process.env.USER_PASSWORD,
    }),
  },
);
if (!response.ok) {
  throw new Error(`Signing in: ${response.status} ${await response.text()}`);
}
const { id_token: token } = await response.json();
console.log(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub);
EOF
}

# rclone with the remote `objects` of the backup service: the storage of TRYBUN_S3_URL.
storage() {
  docker compose run --rm -T --no-deps backup rclone "$@"
}

# The objects of the storage folder $1: path and checksum of each, without the installation marker.
objects() {
  storage md5sum "$1" --exclude /.trybun-installation | sort
}

# The ID of this server, and the one in the marker of the storage folder $1.
server_id() {
  docker compose run --rm -T --no-deps --entrypoint cat backup /backup/server-id
}
marker() {
  storage cat "$1/.trybun-installation"
}

# Installs the deployment package unpacked in the current folder, with its backups also in the
# folder $1 of the S3 storage.
install_server() {
  printf 'localhost\nen\nUTC\nstored\n' | ./trybun install
  cat >>.env <<EOF
TRYBUN_BACKUP_S3_URL=http://$gateway:8334/trybun-backups/$1
TRYBUN_BACKUP_S3_ACCESS_KEY_ID=restore-test
TRYBUN_BACKUP_S3_SECRET_ACCESS_KEY=restore-test-secret
EOF
  docker compose up -d --wait
}

# Destroys the server of the current folder (containers, volumes, folder), keeping its .env as $1.
destroy() {
  cp .env "$1"
  docker compose down --volumes --remove-orphans
  server_folder=$(pwd)
  cd "$work"
  rm -rf "$server_folder"
}

# Restores onto the new server $1 from the deployment package and the .env $2, with the options
# that follow, answering yes to the first question.
restore_onto() {
  [ -d "$work/$1" ] || unpack "$1"
  cd "$work/$1"
  cp "$2" .env
  chmod 600 .env
  shift 2
  printf 'y\n' | ./trybun restore "$@"
}

# Records of the system database: the setup tokens of the installation.
records() {
  docker compose exec -T postgres psql --username=trybun --dbname=trybun --tuples-only --no-align \
    --command='SELECT token_hash, expires_at FROM setup_tokens ORDER BY created_at'
}

step 'Installing the first server'
unpack server-a
cd "$work/server-a"

step 'The S3 storage of the backups: SeaweedFS of the package, outside the server'
# On the address of the host in Docker's default bridge network, which the containers reach.
gateway=$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')
docker run --detach --name "$s3" --publish "$gateway:8334:8333" \
  --env AWS_ACCESS_KEY_ID=restore-test --env AWS_SECRET_ACCESS_KEY=restore-test-secret \
  "$(sed -n 's/^ *image: \(chrislusf\/seaweedfs:.*\)$/\1/p' compose.yaml)" \
  server -dir=/data -s3 -master.telemetry=false >/dev/null
until docker exec "$s3" wget -q -O /dev/null http://127.0.0.1:8333/healthz 2>/dev/null; do sleep 2; done

install_server restore-test

step 'A scheduled backup, then one of ./trybun'
# The service keeps running after its daily backup; the backup of ./trybun must not wait for it.
printf 'TRYBUN_BACKUP_TIME=%s\n' "$(date -u -d '+2 minutes' +%H:%M)" >>.env
docker compose up -d --wait backup
waited=0
until [ "$(docker compose logs backup | grep -c 'Next backup at')" -ge 2 ]; do
  [ "$waited" -lt 240 ] || fail 'the scheduled backup did not run.'
  sleep 5
  waited=$((waited + 5))
done
timeout 300 ./trybun backup || fail 'the backup of ./trybun did not finish after a scheduled one.'

step 'Creating the data'
password=$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')
user=$(create_user "$password")
signed_in=$(sign_in "$password")
[ "$signed_in" = "$user" ] || fail "the new user $user does not sign in, but $signed_in."
# An object of an attachment in the folder of the default TRYBUN_S3_URL: the bucket `trybun`.
folder=objects:trybun
printf '%s' "$password" | storage rcat "$folder/available/restore-test"
objects_before=$(objects "$folder")
records_before=$(records)
[ -n "$objects_before" ] || fail 'the attachment folder has no objects.'
[ -n "$records_before" ] || fail 'the installation has no setup token.'

step 'Backing up'
./trybun backup

step 'Destroying the first server'
destroy "$work/kept.env"

step 'Restoring onto a new server from the deployment package, .env and the passphrase'
# A new SeaweedFS has no marker, so the restore asks no second question.
restore_onto server-b "$work/kept.env"

step 'Checking the restored data'
signed_in=$(sign_in "$password")
[ "$signed_in" = "$user" ] || fail "the user $user does not sign in with the same ID, but $signed_in."
[ "$(objects "$folder")" = "$objects_before" ] || fail 'the objects of the attachment folder differ.'
[ "$(records)" = "$records_before" ] || fail 'the records of the system database differ.'
[ "$(marker "$folder")" = "$(server_id)" ] || fail 'the marker of the attachment folder does not name the new server.'
destroy "$work/kept.env"

step 'Installing a server with the attachments on the external S3 storage'
# Without SeaweedFS: the attachments in a bucket of their own on the S3 storage of the backups.
external=http://$gateway:8334/trybun-attachments/restore-test
export COMPOSE_PROFILES=
# The storage of the first start of ./trybun install; .env gets the same settings below.
export TRYBUN_S3_URL="$external" TRYBUN_S3_ACCESS_KEY_ID=restore-test TRYBUN_S3_SECRET_ACCESS_KEY=restore-test-secret
unpack server-c
cd "$work/server-c"
install_server restore-test-external
sed -i '/^COMPOSE_PROFILES=/d; /^TRYBUN_S3_ACCESS_KEY_ID=/d; /^TRYBUN_S3_SECRET_ACCESS_KEY=/d' .env
cat >>.env <<EOF
COMPOSE_PROFILES=
TRYBUN_S3_URL=$external
TRYBUN_S3_ACCESS_KEY_ID=restore-test
TRYBUN_S3_SECRET_ACCESS_KEY=restore-test-secret
EOF
# From here on, the restores read the storage settings from .env alone.
unset TRYBUN_S3_URL TRYBUN_S3_ACCESS_KEY_ID TRYBUN_S3_SECRET_ACCESS_KEY
docker compose up -d --wait
! docker compose ps --services --status running | grep -qx seaweedfs ||
  fail 'SeaweedFS runs without its profile.'

step 'Backing up the attachment folder of the external storage'
folder=objects:trybun-attachments/restore-test
printf '%s' "$password" | storage rcat "$folder/available/deleted-after-the-backup"
printf 'checking' | storage rcat "$folder/quarantine/kept"
objects_before=$(objects "$folder")
./trybun backup
lost_server=$(server_id)
[ "$(marker "$folder")" = "$lost_server" ] || fail 'the backup did not write the marker of the storage folder.'
storage deletefile "$folder/available/deleted-after-the-backup"
printf 'later' | storage rcat "$folder/available/uploaded-after-the-backup"
objects_after=$(objects "$folder")

step 'Destroying the server; its storage folder stays'
destroy "$work/kept-external.env"

step 'Refusing to replace the folder of the lost server without a terminal'
if restore_onto server-d "$work/kept-external.env" 2>"$work/refused.log"; then
  fail 'the restore replaced the storage folder of another server without --replace-foreign-objects.'
fi
cat "$work/refused.log" >&2
grep -qF "The storage folder $external belongs to another Trybun server" "$work/refused.log" ||
  fail 'the restore did not say why it refused.'
[ "$(objects "$folder")" = "$objects_after" ] || fail 'the refused restore changed the storage folder.'

step 'Refusing a --storage-url folder that contains the folder of the backup'
if restore_onto server-d "$work/kept-external.env" --storage-url "http://$gateway:8334/trybun-attachments" 2>"$work/overlap.log"; then
  fail 'the restore accepted a --storage-url folder that contains the folder of the backup.'
fi
cat "$work/overlap.log" >&2
grep -qF "overlaps the storage folder $external of the backup" "$work/overlap.log" ||
  fail 'the restore did not say why it refused the overlapping folder.'
[ "$(objects "$folder")" = "$objects_after" ] || fail 'the refused restore changed the storage folder.'

step 'Restoring a test copy into another folder with --storage-url, without a second question'
# As the quarterly test restore while production runs: a new, empty folder has no marker.
copy=http://$gateway:8334/trybun-attachments/restore-test-copy
copy_folder=objects:trybun-attachments/restore-test-copy
restore_onto server-d "$work/kept-external.env" --storage-url "$copy"
[ "$(sed -n 's/^TRYBUN_S3_URL=//p' .env)" = "$copy" ] || fail 'the restored .env does not use the folder of --storage-url.'
[ "$(objects "$copy_folder")" = "$objects_before" ] ||
  fail 'the objects of the --storage-url folder are not those of the backup.'
[ "$(objects "$folder")" = "$objects_after" ] || fail 'the restore with --storage-url changed the folder of the backup.'
[ "$(marker "$folder")" = "$lost_server" ] || fail 'the restore with --storage-url changed the marker of the folder of the backup.'
[ "$(marker "$copy_folder")" = "$(server_id)" ] || fail 'the marker of the --storage-url folder does not name the new server.'

step 'Restoring with --replace-foreign-objects'
restore_onto server-d "$work/kept-external.env" --replace-foreign-objects
[ "$(objects "$folder")" = "$objects_before" ] ||
  fail 'the objects of the external storage folder are not those of the backup.'
new_server=$(server_id)
[ "$new_server" != "$lost_server" ] || fail 'the new server has the ID of the lost one.'
[ "$(marker "$folder")" = "$new_server" ] || fail 'the marker of the storage folder does not name the new server.'
step 'Restore test passed'
