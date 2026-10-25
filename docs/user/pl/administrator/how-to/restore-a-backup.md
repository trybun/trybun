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

Użytkownicy logują się swoimi hasłami i kodami uwierzytelniania dwuskładnikowego tak jak wcześniej. Jeśli plik `.env` przepadł, uruchom `./trybun install` na nowym serwerze, ustaw w nowym pliku `.env` zmienną `TRYBUN_BACKUP_PASSPHRASE` i zmienne `TRYBUN_BACKUP_S3_*` starej instalacji i uruchom `./trybun restore`; przywróci on także stary plik `.env`.
