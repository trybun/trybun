# Password blocklist of the sign-in

`trybun.txt` is the blocklist of the password policy of the realm (`passwordBlacklist(trybun.txt)` in [`../realm/trybun.yaml`](../realm/trybun.yaml), §7.4, §13.5): common and breached passwords that the length rule alone would let through. Keycloak reads it from `/opt/keycloak/data/password-blacklists/` (mounted by `compose.yaml`) and refuses a password whose lower-case form is in the list.

- **Source:** [SecLists](https://github.com/danielmiessler/SecLists) (MIT License), `Passwords/Common-Credentials/Pwdb_top-1000000.txt` at commit `ab068333d7d44a9376e2037b0ed7d2e8ca5c6610`.
- **Content:** the passwords of 15 to 64 characters (the length rule of the policy), in lower case, without duplicates, in the order of the source (most common first) – 5,329 entries; OWASP ASVS 5.0 asks for at least the 3,000 most common passwords that meet the policy.
- **Update** with the dependencies (Rule 10): replace the commit below with the latest one of SecLists and run

  ```sh
  curl -sSL https://raw.githubusercontent.com/danielmiessler/SecLists/<commit>/Passwords/Common-Credentials/Pwdb_top-1000000.txt \
    | node -e 'const seen = new Set(); for (const line of require("node:fs").readFileSync(0, "utf8").split("\n")) { const password = line.replace(/\r$/, "").toLowerCase(); if ([...password].length >= 15 && [...password].length <= 64) seen.add(password); } process.stdout.write([...seen].join("\n") + "\n");' \
    > docker/keycloak/password-blocklists/trybun.txt
  ```

  Keycloak reads the file at start-up: `docker compose up -d --wait` restarts it with the new list.
