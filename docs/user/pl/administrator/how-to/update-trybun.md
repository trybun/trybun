---
title: Zaktualizuj Trybun
description: Zainstaluj nowe wydanie jednym poleceniem, z kopią zapasową utworzoną przed jakąkolwiek zmianą.
---

1. Sprawdź wersję na [stronie wydań](https://github.com/trybun/trybun/releases) i przeczytaj jej opis.
2. W folderze instalacji na serwerze uruchom aktualizację z numerem wersji:

   ```sh
   ./trybun update 1.4.1
   ```

Polecenie pobiera pakiet wdrożeniowy wydania i sprawdza jego sumę kontrolną, pokazuje zmiany od zainstalowanej wersji i – przy nowej wersji MAJOR, która może wymagać kroków ręcznych – prosi o potwierdzenie. Następnie pobiera nowe obrazy, tworzy kopię zapasową obu baz danych, zapisanych plików i konfiguracji, zastępuje pliki pakietu wdrożeniowego (plik `.env` pozostaje bez zmian), migruje bazy danych, stosuje konfigurację logowania i uruchamia nową wersję.

Jeśli nie uda się pobrać obrazów albo utworzyć kopii zapasowej, aktualizacja zatrzymuje się, zanim cokolwiek zmieni. Jeśli nowa wersja się nie uruchomi, polecenie wypisuje jedno polecenie, które przywraca poprzednią wersję z danymi sprzed aktualizacji, na przykład:

```sh
./trybun restore 1a2b3c4d
```

Do poprzedniej wersji wraca się tylko przez odtworzenie kopii zapasowej: migracje mogły już zmienić bazy danych ([odtwórz kopię zapasową](restore-a-backup.md)).

Po aktualizacji folder zachowuje swoją nazwę, np. `trybun-1.4.0`.
