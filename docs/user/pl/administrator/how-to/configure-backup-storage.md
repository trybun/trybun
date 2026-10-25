---
title: Skonfiguruj miejsce na kopie zapasowe
description: Przechowuj codzienne kopie zapasowe w magazynie S3 w innej lokalizacji, aby przetrwały utratę serwera.
---

Trybun codziennie tworzy kopię zapasową obu baz danych, zapisanych plików i swojej konfiguracji, zaszyfrowaną hasłem kopii zapasowych. Dopóki nie skonfigurujesz miejsca na kopie zapasowe, są one przechowywane tylko na samym serwerze i przepadną razem z nim. Nadaje się dowolny magazyn zgodny z S3 w innej lokalizacji, np. bucket Twojego dostawcy chmury w innym regionie.

1. Utwórz bucket na kopie zapasowe i klucz dostępu, który może go odczytywać i zapisywać.
2. Na serwerze otwórz plik `.env` w folderze instalacji i ustaw zmienne sekcji **Backups**:

   ```sh
   TRYBUN_BACKUP_S3_URL=https://s3.eu-central-1.amazonaws.com/my-bucket/trybun
   TRYBUN_BACKUP_S3_ACCESS_KEY_ID=…
   TRYBUN_BACKUP_S3_SECRET_ACCESS_KEY=…
   TRYBUN_BACKUP_S3_REGION=eu-central-1
   ```

   `TRYBUN_BACKUP_S3_URL` to adres bucketu, po którym może nastąpić folder. Ustaw region, jeśli Twój dostawca go wymaga.

3. Zastosuj zmianę:

   ```sh
   docker compose up -d --wait
   ```

   Jeśli magazyn jest nieosiągalny albo hasło nie otwiera kopii zapasowych, które już w nim są, polecenie kończy się błędem; `docker compose logs backup` podaje przyczynę.

4. Utwórz pierwszą kopię zapasową od razu, zamiast czekać do nocy:

   ```sh
   ./trybun backup
   ```

Przechowuj kopię pliku `.env` i hasła kopii zapasowych poza serwerem: dzięki nim pakiet wdrożeniowy odtworzy Trybun na nowym serwerze ([odtwórz kopię zapasową](restore-a-backup.md)).

Codzienna kopia zapasowa powstaje o 03:00 UTC; `TRYBUN_BACKUP_TIME` zmienia godzinę. Zachowywane są kopie zapasowe z ostatnich 30 dni; `TRYBUN_BACKUP_KEEP_DAILY` zmienia liczbę dni.

Pozycja **Skonfiguruj miejsce na kopie zapasowe** w **Administracja** › **Pierwsze kroki** zaznacza się, gdy tylko ustawiono `TRYBUN_BACKUP_S3_URL`.
