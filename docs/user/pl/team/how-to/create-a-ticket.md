---
title: Utwórz zgłoszenie
description: Utwórz zgłoszenie w pełnym formularzu, z szablonem opisu dla jego typu i osobą przypisaną.
views: ['/tickets/new']
---

1. Wybierz **Nowe zgłoszenie** w nagłówku. Na telefonie to ikona plusa.
2. W polu **Projekt** wybierz projekt zgłoszenia. Jeśli możesz tworzyć zgłoszenia tylko w jednym projekcie, jest on już wybrany. Lista zawiera tylko aktywne projekty, w których możesz tworzyć zgłoszenia; gdy nie ma żadnego, formularz wyświetla komunikat „Nie możesz jeszcze tworzyć zgłoszeń w żadnym projekcie”.
3. Wybierz **Typ**: **Błąd**, **Nowa funkcja**, **Zadanie** (domyślnie) albo **Pytanie**.
4. W polu **Tytuł** opisz zgłoszenie jednym zdaniem.
5. Uzupełnij **Opis**. Na początku zawiera szablon typu – nagłówki takie jak **Kroki do odtworzenia** dla błędu albo listę kontrolną **Kryteria akceptacji** dla nowej funkcji. Tekst możesz formatować: zobacz [Formatowanie tekstu](../../end-user/reference/formatting-text.md). Opcjonalnie dołącz pliki: przeciągnij je na opis, wklej je albo wybierz **Dołącz pliki** ([dołącz pliki](../../end-user/how-to/attach-files.md)).
6. Sprawdź **Priorytet**. Zmienia się razem z typem – **Niski** dla pytania, **Normalny** dla pozostałych – dopóki nie wybierzesz go sam.
7. Opcjonalnie wybierz osobę w polu **Osoba przypisana**:
   - Jako kierownik projektu lub Administrator wyszukaj osobę po nazwie lub loginie GitHub albo wybierz **Przypisz do mnie**. Lista zawiera tylko osoby, które można przypisać w tym projekcie.
   - Jako developer zaznacz **Przypisz do mnie** – developer może przypisywać zgłoszenia tylko do siebie.
8. Wybierz **Utwórz zgłoszenie**.

Nowe zgłoszenie otworzy się w [widoku zgłoszenia](../reference/ticket-view.md), a komunikat potwierdzi jego identyfikator, na przykład „Utworzono zgłoszenie ERP-12”.

## Szablony

Każdy typ ma własny szablon:

| Typ | Szablon |
|---|---|
| **Błąd** | Problem, Kroki do odtworzenia, Oczekiwany wynik, Faktyczny wynik, Środowisko |
| **Nowa funkcja** | Cel, Proponowane rozwiązanie, Kryteria akceptacji (lista kontrolna) |
| **Zadanie** | Zakres prac, Kryteria ukończenia (lista kontrolna) |
| **Pytanie** | Pytanie, Kontekst |

Szablon jest w języku Twojego konta (**Ustawienia konta**). Dopóki opis jest pusty albo nadal dokładnie odpowiada szablonowi, wybór innego typu zastępuje go szablonem tego typu. Gdy coś w nim napiszesz, Twój tekst nigdy nie zostanie zastąpiony. Szablon jest wstawiany tylko przy tworzeniu zgłoszenia: zmiana typu istniejącego zgłoszenia nie zmienia jego opisu.

## Opuszczanie formularza

Jeśli opuścisz formularz po wpisaniu tytułu lub opisu, Trybun najpierw zapyta „Odrzucić zmiany?”. Wybierz **Edytuj dalej**, aby wrócić do formularza.
