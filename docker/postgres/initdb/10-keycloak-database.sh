#!/bin/bash
# Creates the Keycloak database with its own user in the same instance (§15.5) and keeps every
# other role out of both databases.
set -euo pipefail

: "${KEYCLOAK_DB_PASSWORD:?KEYCLOAK_DB_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v system_db="$POSTGRES_DB" -v keycloak_password="$KEYCLOAK_DB_PASSWORD" <<'SQL'
CREATE ROLE keycloak LOGIN PASSWORD :'keycloak_password';
CREATE DATABASE keycloak OWNER keycloak;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
REVOKE ALL ON DATABASE :"system_db" FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
SQL
