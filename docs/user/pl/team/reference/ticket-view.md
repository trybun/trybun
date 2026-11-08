---
title: Widok zgłoszenia
description: Części zgłoszenia dla zespołu – tytuł, opis, pliki, pola i aktywność – oraz jak zmiany są zapisywane i cofane.
views: ['/tickets/[identifier]']
---

Zgłoszenie otwiera się pod swoim identyfikatorem, na przykład `/tickets/ERP-12`. Na komputerze jego pola są w panelu po prawej stronie; na telefonie i tablecie – w sekcji **Szczegóły** pod tytułem, a na telefonie każde pole otwiera swoje opcje na dole ekranu.

Możesz zmieniać tylko to, na co pozwala Twoja rola; wszystko inne jest wyświetlane jako tekst. W zarchiwizowanym projekcie całe zgłoszenie jest tylko do odczytu, o czym informuje komunikat.

## Nagłówek

- **Identyfikator**, na przykład `ERP-12`, z przyciskiem, który go kopiuje.
- **Tytuł**. Wybierz **Edytuj tytuł**, zmień go i wybierz **Zapisz** albo naciśnij **Enter**; **Anuluj** lub **Esc** zostawia dotychczasowy tytuł.
- Kto i kiedy utworzył zgłoszenie oraz skąd ono pochodzi: **Użytkownik** (z portalu), **Developer** (zespół) albo **Integracja**.

## Opis i pliki

Opis jest wyświetlany ze sformatowaniem ([formatowanie tekstu](../../end-user/reference/formatting-text.md)). Wybierz **Edytuj**, aby go zmienić, a potem **Zapisz**. Jeśli wybierzesz **Anuluj** albo opuścisz stronę z niezapisanym tekstem – przez link albo przyciskiem Wstecz przeglądarki lub telefonu – Trybun najpierw zapyta „Odrzucić zmiany?”. Pliki zgłoszenia są wymienione pod opisem ([dołącz pliki](../../end-user/how-to/attach-files.md)).

## Pola

| Pole | Znaczenie i sposób zmiany |
|---|---|
| **Status** | Status wewnętrzny, pogrupowany na **Początkowe**, **Aktywne**, **Wstrzymane** i **Zamknięte**; zgłoszenie oczekujące na zgłaszającego pokazuje też powód – **Oczekuje na informacje** albo **Oczekuje na potwierdzenie**. Zobacz **Statusy** poniżej |
| **Przypisany** | Kto pracuje nad zgłoszeniem. Zobacz **Przypisywanie** poniżej |
| **Typ** | **Błąd**, **Funkcjonalność**, **Zadanie** albo **Pytanie**; **Nie ustawiono** dla zgłoszenia z portalu, którego nikt jeszcze nie sklasyfikował. Zmiana typu nigdy nie zmienia opisu |
| **Priorytet** | **Niski**, **Normalny**, **Wysoki** albo **Krytyczny** |
| **Projekt** | Projekt zgłoszenia; nie można go zmienić |
| **Zgłaszający** | Kto wysłał zgłoszenie |
| **Organizacja** | Organizacja zgłaszającego, wyświetlana tylko wtedy, gdy istnieje |
| **Utworzono**, **Zaktualizowano** | Kiedy zgłoszenie utworzono i kiedy ostatnio zmieniono, w Twojej strefie czasowej |

## Zapisywanie i cofanie

Typ, priorytet i osoba przypisana zapisują się od razu po wybraniu wartości. Komunikat potwierdza zmianę i oferuje **Cofnij**, które przywraca poprzednią wartość – to osobna zmiana, która także pojawia się w aktywności. Po ustawieniu typu zgłoszenia, które miało typ **Nie ustawiono**, nie ma opcji **Cofnij**.

Tytuł i opis zapisują się dopiero po wybraniu **Zapisz**.

Jeśli w międzyczasie ktoś inny zmienił zgłoszenie, Trybun o tym informuje i ponownie wyświetla zgłoszenie; wpisany tekst zostaje w polu, więc możesz go zapisać jeszcze raz. **Cofnij**, które nie jest już możliwe – na przykład dlatego, że poprzedniej osoby nie można już przypisać – pokazuje powód i nie jest ponawiane.

## Przypisywanie

- **Kierownik projektu i Administrator**: wybierz dowolną osobę, którą można przypisać w projekcie – wyszukaj ją po nazwie lub loginie GitHub. **Przypisz do mnie** jest pierwszą opcją, gdy Ciebie także można przypisać, a **Nieprzypisane** – ostatnią.
- **Developer**: **Przypisz do mnie** przypisuje zgłoszenie do Ciebie, także gdy jest przypisane do kogoś innego; **Usuń moje przypisanie** usuwa Cię z niego. Developer nie może przypisywać innych osób. Przejęcie zgłoszenia od innej osoby nie ma opcji **Cofnij**.

## Statusy

Nowy status wybierz w polu **Status**:

- **Odrzucone** wymaga podania powodu.
- **Duplikat** wymaga podania **Oryginalnego zgłoszenia** z tego samego projektu – wpisz jego identyfikator, na przykład `ERP-7` albo samo `7`, sprawdź jego tytuł i wybierz **Oznacz jako duplikat**.
- **Zakończone** w projekcie, który prosi zgłaszających o potwierdzenie rozwiązania ([ustawienia projektu](project-settings.md)), przenosi zgłoszenie do statusu **Oczekuje na zgłaszającego** z komunikatem „Poprosiliśmy zgłaszającego o potwierdzenie rozwiązania problemu. Zgłoszenie zamknie się automatycznie po 7 dniach.”

Zmiana między statusami, które nie są zamknięte, oferuje **Cofnij**. Zamknięcie lub ponowne otwarcie zgłoszenia, **Odrzucone**, **Duplikat**, **Zakończone**, które czeka na potwierdzenie, oraz wyjście ze stanu **Oczekuje na potwierdzenie** nie mają opcji **Cofnij**.

## Aktywność

**Aktywność** pokazuje wszystko, co działo się ze zgłoszeniem, od najstarszych wpisów: kto je utworzył oraz każdą zmianę tytułu, opisu, typu, priorytetu, osoby przypisanej, statusu i plików, z poprzednią i nową wartością. Zmiany automatyczne zamiast osoby pokazują **System**; osoba, której konto usunięto, jest wyświetlana jako **Usunięty użytkownik**. **Pokaż więcej** na końcu wczytuje kolejne wpisy.

Włącz **Ukryj zdarzenia**, aby ukryć te wpisy. Trybun zapamiętuje ten wybór na Twoim koncie, więc obowiązuje on na każdym urządzeniu.
