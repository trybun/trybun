---
title: Zmień domyślny język i strefę czasową
description: Zmień język i strefę czasową, których Trybun używa dla osób, które nie wybrały własnych.
---

Domyślnego języka używają strony logowania, e-maile i wszyscy, których języka przeglądarki Trybun nie obsługuje; domyślna strefa czasowa pokazuje daty i godziny, dopóki ktoś nie ustawi własnej. `./trybun install` ustawia oba. Każda osoba może nadal wybrać własny język i strefę czasową w menu konta i jego **Ustawieniach konta**.

1. Na serwerze otwórz plik `.env` w folderze instalacji.
2. Zmień zmienne:

   ```sh
   TRYBUN_DEFAULT_LANGUAGE=pl
   TRYBUN_DEFAULT_TIME_ZONE=Europe/Warsaw
   ```

   Język to `en` albo `pl`; strefa czasowa to nazwa IANA, np. `Europe/Warsaw` albo `UTC`.

3. Zastosuj zmianę:

   ```sh
   docker compose up -d --wait
   ```
