---
title: Odtwórz kopię zapasową
description: Przywróć Trybun do stanu z kopii zapasowej – po nieudanej aktualizacji, po pomyłce albo na nowym serwerze.
---

Kopia zapasowa zawiera obie bazy danych (także konta logowania), zapisane pliki i konfigurację: plik `.env` i pliki pakietu wdrożeniowego. Jej odtworzenie zastępuje je wszystkie i uruchamia wersję Trybunu, z której pochodzi kopia. Wszystko, co zmieniło się po jej utworzeniu, przepada.

## Na tym samym serwerze

1. W folderze instalacji wyświetl listę kopii zapasowych:

   ```sh
   ./trybun backup list
   ```

2. Odtwórz wybraną kopię po jej identyfikatorze albo najnowszą – bez identyfikatora:

   ```sh
   ./trybun restore 1a2b3c4d
   ```

3. Potwierdź, wpisując `y`. Trybun zatrzymuje się, odtwarza kopię zapasową i uruchamia ponownie.

Po nieudanej aktualizacji sama aktualizacja wypisuje polecenie, które odtwarza kopię zapasową utworzoną tuż przed nią, np. `./trybun restore 1a2b3c4d`.

## Na nowym serwerze

Potrzebujesz pakietu wdrożeniowego dowolnego wydania, kopii pliku `.env` przechowywanej poza starym serwerem i kopii zapasowych w zewnętrznym magazynie S3 ([skonfiguruj miejsce na kopie zapasowe](configure-backup-storage.md)).

1. Przygotuj serwer jak do instalacji: Docker Engine z wtyczką Compose, domena wskazująca na nowy serwer, otwarte porty 80 i 443.
2. Rozpakuj pakiet wdrożeniowy i skopiuj przechowany plik `.env` do jego folderu:

   ```sh
   tar -xzf trybun-<version>.tar.gz
   cd trybun-<version>
   cp ~/trybun.env .env
   chmod 600 .env
   ```

3. Odtwórz najnowszą kopię zapasową z magazynu S3:

   ```sh
   ./trybun restore
   ```

   Gdy załączone pliki są przechowywane w zewnętrznym magazynie S3, odtwarzanie zadaje drugie pytanie, bo ich folder wciąż należy do starego serwera: „The storage folder … belongs to another Trybun server. Replace its content? [y/N]”. Odpowiedz `y`, gdy stary serwer przepadł. Odpowiedz `n`, dopóki stary serwer działa: `y` zastąpiłoby jego załączone pliki plikami z kopii zapasowej. Aby przetestować odtwarzanie, postępuj zamiast tego według sekcji „Przetestuj odtwarzanie, gdy instalacja działa” poniżej.

   Odtwarzanie pyta też, zanim zastąpi folder z plikami, ale bez znacznika serwera Trybun, bo może on należeć do innej aplikacji: „The storage folder … holds objects but no Trybun marker. Replace its content? [y/N]”. Dla pustego folderu nie pada żadne pytanie.

Użytkownicy logują się swoimi hasłami i kodami uwierzytelniania dwuskładnikowego tak jak wcześniej. Jeśli plik `.env` przepadł, uruchom `./trybun install` na nowym serwerze, ustaw w nowym pliku `.env` zmienną `TRYBUN_BACKUP_PASSPHRASE` i zmienne `TRYBUN_BACKUP_S3_*` starej instalacji i uruchom `./trybun restore`; przywróci on także stary plik `.env`.

## Przetestuj odtwarzanie, gdy instalacja działa

Przynajmniej raz na kwartał przetestuj odtwarzanie na osobnym serwerze, tak jak opisuje sekcja „Na nowym serwerze”, ale z opcją `--test`. Odtwarzanie testowe opróżnia `TRYBUN_BACKUP_S3_URL` w odtworzonym pliku `.env`, więc serwer testowy nie tworzy kopii zapasowych w zewnętrznym magazynie S3 i nie narusza kopii instalacji; aby tworzyć jego kopie poza serwerem, ustaw w `TRYBUN_BACKUP_S3_URL` jego własne repozytorium, nigdy repozytorium instalacji.

- Gdy załączone pliki są przechowywane w SeaweedFS na serwerze (domyślnie), odtwórz kopię poleceniem:

  ```sh
  ./trybun restore --test
  ```

- Gdy są przechowywane w zewnętrznym magazynie S3, odtworzony plik `.env` wskazuje na folder testowanej instalacji, więc odtwórz pliki do osobnego folderu. Bez niego opcja `--test` zostaje odrzucona.
  1. W magazynie utwórz pusty kubełek albo folder poza folderami z `TRYBUN_S3_URL` i `TRYBUN_BACKUP_S3_URL`, do którego może zapisywać klucz dostępu z pliku `.env` (`TRYBUN_S3_ACCESS_KEY_ID`).
  2. Odtwórz kopię do niego:

     ```sh
     ./trybun restore --test --storage-url https://s3.example.com/my-bucket-restore-test
     ```

     Odtworzony plik `.env` używa tego folderu, a folder instalacji pozostaje bez zmian. Dla pustego folderu nie pada drugie pytanie; jeśli mimo to się pojawi, odpowiedz `n`. Odtwarzanie odmawia folderu, który zawiera folder instalacji albo kopii zapasowych lub leży w jednym z nich.

Następnie zaloguj się z uwierzytelnianiem dwuskładnikowym i sprawdź, czy są Twoje dane i pliki. Potem usuń folder testowy w zewnętrznym magazynie.
