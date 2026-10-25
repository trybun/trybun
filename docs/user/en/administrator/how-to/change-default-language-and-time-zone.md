---
title: Change the default language and time zone
description: Change the language and time zone Trybun uses for people who have not chosen their own.
---

The default language is used by the sign-in pages, by e-mail and by everyone whose browser language Trybun does not support; the default time zone shows dates and times until a person sets their own. `./trybun install` sets both. Each person can still choose their own language in the account menu.

1. On the server, open `.env` in the folder of the installation.
2. Change the variables:

   ```sh
   TRYBUN_DEFAULT_LANGUAGE=pl
   TRYBUN_DEFAULT_TIME_ZONE=Europe/Warsaw
   ```

   The language is `en` or `pl`; the time zone is an IANA name such as `Europe/Warsaw` or `UTC`.

3. Apply the change:

   ```sh
   docker compose up -d --wait
   ```
