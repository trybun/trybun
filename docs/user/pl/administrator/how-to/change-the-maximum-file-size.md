---
title: Zmień maksymalny rozmiar pliku
description: Zmień, jak duży plik można dołączyć do zgłoszenia.
---

Plik dołączony do zgłoszenia może domyślnie mieć do 25 MB. Limit obowiązuje wszystkich i każde nowe przesłanie; wcześniej dołączone pliki pozostają bez zmian.

1. Na serwerze otwórz plik `.env` w folderze instalacji.
2. Ustaw zmienną albo usuń `#` przed nią:

   ```sh
   TRYBUN_ATTACHMENT_MAX_SIZE_MB=50
   ```

   Limit to liczba całkowita megabajtów od 1 do 100. Większych plików nie da się w pełni sprawdzić pod kątem złośliwego oprogramowania.

3. Zastosuj zmianę:

   ```sh
   docker compose up -d --wait
   ```
