# ghcr.io/trybun/postgres: PostgreSQL with pgvector and the Polish full-text dictionary (§14.4).
# Base image pinned to a digest (§2.10).
ARG BASE_IMAGE=pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0

FROM ${BASE_IMAGE} AS dictionary
# Hunspell dictionary of sjp.pl, used under its Apache-2.0 licence option. sjp.pl keeps only the
# latest archive online, so the archive is kept in the repository; it is updated by replacing the
# file and its checksum with the archive of https://sjp.pl/sl/en/.
ARG DICTIONARY=sjp-hunspell-pl-20260901
ARG DICTIONARY_SHA256=47a5ab02cf3def374994b1b03efd9fed2de868349b8ddcebac281b484353d157
COPY ${DICTIONARY}.zip /tmp/
RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip \
  && echo "${DICTIONARY_SHA256}  /tmp/${DICTIONARY}.zip" | sha256sum -c - \
  && mkdir /dictionary && cd /dictionary \
  && unzip -q /tmp/${DICTIONARY}.zip pl_PL.zip && unzip -q pl_PL.zip \
  # PostgreSQL reads dictionary files in UTF-8.
  && iconv -f ISO-8859-2 -t UTF-8 pl_PL.aff | sed 's/^SET ISO8859-2/SET UTF-8/' > polish.affix \
  && iconv -f ISO-8859-2 -t UTF-8 pl_PL.dic > polish.dict

FROM ${BASE_IMAGE}
COPY --from=dictionary /dictionary/polish.affix /dictionary/polish.dict /dictionary/README_pl_PL.txt /usr/share/postgresql/18/tsearch_data/
# Run once, when the data volume is initialized.
COPY initdb/ /docker-entrypoint-initdb.d/
