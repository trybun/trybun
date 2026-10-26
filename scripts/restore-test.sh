#!/bin/sh
# Restore test of a release (§13.6), run by the release workflow before anything is published:
# installs the deployment package on a first "server", creates a user in Keycloak, an object in the
# object storage and records in the system database, backs up to an S3 storage outside the server,
# destroys the server (containers, volumes, folder), restores onto a new one from the deployment
# package, .env and the passphrase alone, and checks that the user signs in with the same ID and
# the objects and records are the same.
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

# The objects of the object storage: path and checksum of each.
objects() {
  docker compose run --rm -T --no-deps --entrypoint rclone backup md5sum objects: | sort
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

printf 'localhost\nen\nUTC\nstored\n' | ./trybun install
cat >>.env <<EOF
TRYBUN_BACKUP_S3_URL=http://$gateway:8334/trybun-backups/restore-test
TRYBUN_BACKUP_S3_ACCESS_KEY_ID=restore-test
TRYBUN_BACKUP_S3_SECRET_ACCESS_KEY=restore-test-secret
EOF
docker compose up -d --wait

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
docker compose run --rm -T --no-deps --entrypoint sh backup -c \
  'printf "%s" "$1" | rclone rcat objects:restore-test/object.txt' sh "$password"
objects_before=$(objects)
records_before=$(records)
[ -n "$objects_before" ] || fail 'the object storage has no objects.'
[ -n "$records_before" ] || fail 'the installation has no setup token.'
cp .env "$work/kept.env"

step 'Backing up'
./trybun backup

step 'Destroying the first server'
docker compose down --volumes --remove-orphans
cd "$work"
rm -rf "$work/server-a"

step 'Restoring onto a new server from the deployment package, .env and the passphrase'
unpack server-b
cd "$work/server-b"
cp "$work/kept.env" .env
chmod 600 .env
printf 'y\n' | ./trybun restore

step 'Checking the restored data'
signed_in=$(sign_in "$password")
[ "$signed_in" = "$user" ] || fail "the user $user does not sign in with the same ID, but $signed_in."
[ "$(objects)" = "$objects_before" ] || fail 'the objects of the object storage differ.'
[ "$(records)" = "$records_before" ] || fail 'the records of the system database differ.'
step 'Restore test passed'
