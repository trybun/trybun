---
title: Skonfiguruj e-mail
description: Połącz Trybun z serwerem SMTP, aby wysyłał e-maile, także linki do resetu hasła.
---

Trybun wysyła e-maile przez wybrany serwer SMTP – Twojego dostawcę poczty albo usługę e-maili transakcyjnych. Dopóki go nie skonfigurujesz, Trybun nie wysyła e-maili, a linki z zaproszeniami trzeba przekazywać ręcznie. Te same ustawienia wykorzystuje logowanie (reset hasła, weryfikacja adresu e-mail).

1. Na serwerze otwórz plik `.env` w folderze instalacji.
2. Ustaw zmienne sekcji **E-mail**:

   ```sh
   TRYBUN_SMTP_HOST=smtp.example.com
   TRYBUN_SMTP_PORT=587
   TRYBUN_SMTP_SECURITY=starttls
   TRYBUN_SMTP_USER=trybun@example.com
   TRYBUN_SMTP_PASSWORD=…
   TRYBUN_MAIL_FROM=trybun@example.com
   ```

   `TRYBUN_SMTP_SECURITY` to `starttls` (port 587), `tls` (port 465) albo `none`. `TRYBUN_MAIL_FROM` to adres nadawcy i jest wymagany.

3. Zastosuj zmianę:

   ```sh
   docker compose up -d --wait
   ```

Pozycja **Skonfiguruj e-mail** w **Administracja** › **Pierwsze kroki** zaznacza się, gdy tylko ustawiono `TRYBUN_SMTP_HOST`.
