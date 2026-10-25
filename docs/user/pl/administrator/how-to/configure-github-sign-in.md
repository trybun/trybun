---
title: Skonfiguruj logowanie przez GitHub
description: Pozwól członkom zespołu logować się kontami GitHub przez aplikację OAuth GitHub.
---

Członkowie zespołu logują się przez GitHub, co łączy też ich konta z GitHubem na potrzeby przypisywania zgłoszeń. Dopóki logowanie przez GitHub nie jest skonfigurowane, jako członek zespołu może się zalogować tylko pierwszy Administrator, a zapraszanie członków zespołu nie jest możliwe.

1. Na GitHubie otwórz **Settings** › **Developer settings** › **OAuth Apps** › **New OAuth App** – swojej organizacji albo własnego konta.
2. Wypełnij:
   - **Homepage URL**: `https://<Twoja domena>`
   - **Authorization callback URL**: `https://<Twoja domena>/auth/realms/trybun/broker/github/endpoint`
3. Wybierz **Register application**, a potem **Generate a new client secret**.
4. Na serwerze ustaw identyfikator klienta i sekret w pliku `.env` w folderze instalacji:

   ```sh
   TRYBUN_GITHUB_CLIENT_ID=…
   TRYBUN_GITHUB_CLIENT_SECRET=…
   ```

5. Zastosuj zmianę:

   ```sh
   docker compose up -d --wait
   ```

Strona logowania proponuje teraz GitHub, a pozycja **Skonfiguruj logowanie przez GitHub** w **Administracja** › **Pierwsze kroki** jest zaznaczona. Członkowie zespołu nadal konfigurują uwierzytelnianie dwuskładnikowe przy pierwszym logowaniu.
