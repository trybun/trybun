---
title: Configure GitHub sign-in
description: Let team members sign in with their GitHub accounts through a GitHub OAuth app.
---

Team members sign in with GitHub, which also links their accounts to GitHub for issue assignment. Until GitHub sign-in is configured, only the first Administrator can sign in as a team member, and inviting team members is not possible.

1. On GitHub, open **Settings** › **Developer settings** › **OAuth Apps** › **New OAuth App** – of your organization or of your own account.
2. Fill in:
   - **Homepage URL**: `https://<your domain>`
   - **Authorization callback URL**: `https://<your domain>/auth/realms/trybun/broker/github/endpoint`
3. Select **Register application**, then **Generate a new client secret**.
4. On the server, set the client ID and the secret in `.env` in the folder of the installation:

   ```sh
   TRYBUN_GITHUB_CLIENT_ID=…
   TRYBUN_GITHUB_CLIENT_SECRET=…
   ```

5. Apply the change:

   ```sh
   docker compose up -d --wait
   ```

The sign-in page now offers GitHub, and the item **Configure GitHub sign-in** of **Administration** › **Getting started** is ticked. Team members still set up two-factor authentication at their first sign-in.
