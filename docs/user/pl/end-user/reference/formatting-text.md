---
title: Formatowanie tekstu
description: Markdown, którego możesz używać w opisach, komentarzach i notatkach wewnętrznych, pasek narzędzi i jego skróty klawiszowe.
---

Opisy, komentarze i notatki wewnętrzne pisze się w Markdownie, tak jak na GitHubie. Pisz na karcie **Pisz** i wybierz **Podgląd**, aby zobaczyć tekst dokładnie tak, jak będzie wyglądał po zapisaniu.

## Pasek narzędzi i skróty

Pasek narzędzi nad tekstem dodaje formatowanie za Ciebie: zaznacz tekst i wybierz przycisk albo wybierz przycisk i pisz. Ponowne wybranie tego samego przycisku usuwa formatowanie. Na Macu używaj Cmd zamiast Ctrl.

| Przycisk | Co robi | Skrót |
|---|---|---|
| Nagłówek | Zamienia wiersz w nagłówek | – |
| Pogrubienie | `**pogrubienie**` | Ctrl+B |
| Kursywa | `_kursywa_` | Ctrl+I |
| Cytat | `> ` przed każdym wierszem | Ctrl+Shift+. |
| Kod | `` `kod` `` albo blok kodu, gdy zaznaczenie obejmuje kilka wierszy | Ctrl+E |
| Link | `[tekst](url)` – wpisz adres w miejsce `url` | Ctrl+K |
| Lista punktowana | `- ` przed każdym wierszem | Ctrl+Shift+8 |
| Lista numerowana | `1. `, `2. `, … przed wierszami | Ctrl+Shift+7 |
| Lista zadań | `- [ ] ` przed każdym wierszem | Ctrl+Shift+L |
| Dołącz pliki | Wybiera pliki do dołączenia, jeśli formularz na to pozwala | – |

Ctrl+Z cofa zmianę z paska narzędzi tak samo jak pisanie. Na telefonie rzadziej używane przyciski są w menu **Więcej formatowania**.

## Składnia Markdown

| Piszesz | Otrzymujesz |
|---|---|
| `## Nagłówek` | Nagłówek (od `#` do `######`) |
| `**pogrubienie**`, `_kursywa_`, `~~przekreślenie~~` | **pogrubienie**, _kursywa_, ~~przekreślenie~~ |
| `- element` albo `1. element` | Listę punktowaną albo numerowaną |
| `- [ ] zadanie`, `- [x] zrobione` | Listę zadań z polami wyboru |
| `> cytat` | Cytat |
| `` `kod` `` | Kod w tekście |
| ` ```ts ` … ` ``` ` w osobnych wierszach | Blok kodu; z językiem, np. `ts`, `sql` albo `json`, jest kolorowany |
| `[tekst](https://example.com)` | Link; sam adres strony też staje się linkiem |
| `\| a \| b \|` z wierszem `\|---\|---\|` poniżej | Tabelę |
| `tekst[^1]` i `[^1]: przypis` | Przypis |

## Czego Trybun nie pokazuje

- **Znaczniki HTML**, np. `<details>` albo `<kbd>`, nie są pokazywane; tekst między nimi tak.
- **Linki** działają tylko z adresami `http`, `https` i `mailto` oraz z adresami w Trybunie; każdy inny link jest pokazywany jako zwykły tekst.
- **Obrazy** są pokazywane tylko dla plików dołączonych do tego samego zgłoszenia. Każdy inny obraz, np. z innej strony internetowej, jest pokazywany jako link z jego opisem.
- **Pola wyboru** list zadań pokazują stan; aby zaznaczyć pole, edytuj tekst.
- W **e-mailach** obrazy są zawsze linkami, kod nie jest kolorowany, a zadania wyglądają jak ☐ i ☑.
