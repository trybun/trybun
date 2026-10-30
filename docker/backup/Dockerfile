# ghcr.io/trybun/backup: the backup service (§15.10) – restic, rclone and the PostgreSQL client
# of the major version of ghcr.io/trybun/postgres. Images pinned to a digest in the `FROM` lines,
# where Dependabot updates them (§2.10).
FROM restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510 AS restic
FROM rclone/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5 AS rclone

FROM postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15
# Only the client tools are used; gosu of the server's entry point is not (and had a critical
# vulnerability of its Go standard library, 2026-10).
RUN rm /usr/local/bin/gosu
# brotli-libs 1.2.0-r1 of the base image has the critical CVE-2026-111497, fixed in 1.2.1-r0 of
# Alpine 3.24; remove once a rebuilt base image ships the fix (Dependabot updates the digest).
RUN apk upgrade --no-cache brotli-libs
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY --chmod=755 backup.sh /usr/local/bin/trybun-backup
# The rclone remote `objects` comes from environment variables only (compose.yaml).
ENV RCLONE_CONFIG=/dev/null
# Runs as root: it reads `.env`, which only its owner on the host may read.
ENTRYPOINT ["trybun-backup"]
CMD ["schedule"]
