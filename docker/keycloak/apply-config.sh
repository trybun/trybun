#!/bin/sh
# Entry point of the one-off `keycloak-config` service (§15.5): applies the realm configuration
# with keycloak-config-cli. Optional parts – SMTP and the sign-in providers – are imported only
# when their variables are set (§15.3).
set -eu

: "${TRYBUN_DOMAIN:?TRYBUN_DOMAIN must be set}"
export TRYBUN_WEB_URL="${TRYBUN_WEB_URL:-https://$TRYBUN_DOMAIN}"
export TRYBUN_WEB_INTERNAL_URL="${TRYBUN_WEB_INTERNAL_URL:-http://web:3000}"

files="file:/config/realm/trybun.yaml"
include() {
  files="$files,file:/config/$1"
}

if [ -n "${TRYBUN_SMTP_HOST:-}" ]; then
  : "${TRYBUN_MAIL_FROM:?TRYBUN_MAIL_FROM must be set with TRYBUN_SMTP_HOST}"
  # Security of the connection: `starttls` (default), `tls` or `none`.
  case "${TRYBUN_SMTP_SECURITY:-starttls}" in
    starttls) KEYCLOAK_SMTP_STARTTLS=true KEYCLOAK_SMTP_SSL=false ;;
    tls) KEYCLOAK_SMTP_STARTTLS=false KEYCLOAK_SMTP_SSL=true ;;
    none) KEYCLOAK_SMTP_STARTTLS=false KEYCLOAK_SMTP_SSL=false ;;
    *)
      echo "TRYBUN_SMTP_SECURITY must be starttls, tls or none" >&2
      exit 1
      ;;
  esac
  KEYCLOAK_SMTP_AUTH=false
  if [ -n "${TRYBUN_SMTP_USER:-}" ]; then
    KEYCLOAK_SMTP_AUTH=true
  fi
  export KEYCLOAK_SMTP_AUTH KEYCLOAK_SMTP_STARTTLS KEYCLOAK_SMTP_SSL
  include realm/smtp.yaml
fi
if [ -n "${TRYBUN_GITHUB_CLIENT_ID:-}" ] && [ -n "${TRYBUN_GITHUB_CLIENT_SECRET:-}" ]; then
  include realm/github.yaml
fi
if [ -n "${TRYBUN_MICROSOFT_CLIENT_ID:-}" ] && [ -n "${TRYBUN_MICROSOFT_CLIENT_SECRET:-}" ]; then
  include realm/microsoft.yaml
fi
if [ -n "${TRYBUN_GOOGLE_CLIENT_ID:-}" ] && [ -n "${TRYBUN_GOOGLE_CLIENT_SECRET:-}" ]; then
  include realm/google.yaml
fi
export IMPORT_FILES_LOCATIONS="$files"

# Settings of keycloak-config-cli. The `$(env:…)` placeholders of the files are substituted.
export IMPORT_VARSUBSTITUTION_ENABLED=true
# Every run applies the files, also when they are unchanged, so managed settings changed in
# Keycloak are restored (§15.5).
export IMPORT_CACHE_ENABLED=false
# Sign-in providers are only added: a provider whose variables are removed stays in Keycloak, and
# the files of different providers never delete each other's provider.
export IMPORT_MANAGED_IDENTITYPROVIDER=no-delete
# Keycloak reports ready before its first start has created the master realm.
export KEYCLOAK_AVAILABILITYCHECK_ENABLED=true
export KEYCLOAK_AVAILABILITYCHECK_TIMEOUT=120s

exec java $JAVA_OPTS -jar /app/keycloak-config-cli.jar
