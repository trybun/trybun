---
title: Change the maximum file size
description: Change how large a file people can attach to a ticket.
---

A file attached to a ticket can be up to 25 MB by default. The limit applies to everyone and to every new upload; files attached earlier stay as they are.

1. On the server, open `.env` in the folder of the installation.
2. Set the variable, or remove the `#` in front of it:

   ```sh
   TRYBUN_ATTACHMENT_MAX_SIZE_MB=50
   ```

   The limit is a whole number of megabytes from 1 to 100. Larger files cannot be checked for malware completely.

3. Apply the change:

   ```sh
   docker compose up -d --wait
   ```
