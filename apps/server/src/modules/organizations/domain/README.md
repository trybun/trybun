# Blocklist of public mail domains

`public-mail-domains.json` is the blocklist of public mail domains of organizations (§7.3): a domain on it, e.g. `gmail.com`, cannot be added to an organization (`organization.domain_public`). `email-domains.ts` reads it.

- **Source:** [`free-email-domains`](https://github.com/Kikobeats/free-email-domains) (MIT License), `domains.json` of version `1.15.9` (31,163 domains, lower-case ASCII). It also lists disposable domains, which an Administrator never adds either.
- **Update** with the dependencies (Rule 10), with a version older than the release-age cooldown of seven days:

  ```sh
  npm pack free-email-domains@<version> --pack-destination /tmp \
    && tar -xzf /tmp/free-email-domains-<version>.tgz -C /tmp package/domains.json \
    && cp /tmp/package/domains.json apps/server/src/modules/organizations/domain/public-mail-domains.json \
    && pnpm exec prettier --write apps/server/src/modules/organizations/domain/public-mail-domains.json
  ```

  Then update the version and the number of domains above.
