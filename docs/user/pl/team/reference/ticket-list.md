---
title: Lista zgłoszeń
description: Zgłoszenia wszystkich Twoich projektów na jednej liście – widoki, filtry, sortowanie, zaznaczanie i akcje zbiorcze z ich wynikami.
views: ['/tickets']
---

Wybierz **Zgłoszenia** w nawigacji głównej, aby otworzyć listę zgłoszeń wszystkich Twoich projektów. Widzisz na niej te zgłoszenia, które widzisz w [widoku zgłoszenia](ticket-view.md); wybierz tytuł zgłoszenia – na telefonie jego kartę – aby je otworzyć.

## Tabela i karty

Na tablecie i komputerze lista jest tabelą z kolumnami **ID** (identyfikator), **Tytuł**, **Status**, **Priorytet**, **Typ**, **Przypisany**, **Projekt**, **Organizacja** i **Zaktualizowano** (jak dawno zgłoszenie się zmieniło). Na tablecie kolumny **Typ**, **Projekt** i **Organizacja** są ukryte, a kolumna **Organizacja** pojawia się dopiero, gdy istnieją organizacje.

Na telefonie każde zgłoszenie jest kartą z identyfikatorem, tytułem, statusem, priorytetem i osobą przypisaną oraz polem wyboru, które je zaznacza.

Lista pokazuje 50 zgłoszeń; **Pokaż więcej** na jej końcu wczytuje kolejne 50. Lista nie pokazuje opisów: otwórz zgłoszenie, aby przeczytać jego opis i pliki.

## Widoki

Widoki nad listą – karty na tablecie i komputerze, lista do wyboru na telefonie – obejmują wszystkie Twoje projekty. Widok to zestaw filtrów z własną kolejnością:

| Widok | Pokazuje | Kolejność |
|---|---|---|
| **Moje otwarte zgłoszenia** | Zgłoszenia przypisane do Ciebie, które nie są zamknięte | Priorytet, od najwyższego |
| **Triage** | Zgłoszenia w statusie **Nowe** albo **Do analizy** | Od najstarszych |
| **Krytyczne** | Zgłoszenia z priorytetem **Krytyczny**, które nie są zamknięte | Od ostatnio zmienionych |
| **Nieprzypisane** | Zgłoszenia bez osoby przypisanej, które nie są zamknięte – także te, których osoba przypisana została dezaktywowana albo usunięta z projektu | Priorytet, od najwyższego |
| **Oczekujące udostępnienia** | Zgłoszenia, których autor prosi o udostępnienie wszystkim klientom, w dowolnym statusie | Od najstarszych |

**Zgłoszenia** otwiera widok **Moje otwarte zgłoszenia**. „Nie są zamknięte” oznacza każdy status oprócz **Zakończone**, **Odrzucone** i **Duplikat**.

Gdy zmienisz filtr, żaden widok nie jest już zaznaczony: lista pokazuje **Filtr niestandardowy**. Wybierz widok ponownie, aby wrócić do jego filtrów.

## Filtry

Wybierz **Dodaj filtr** i wybierz pole – na telefonie pola otwierają się na dole ekranu. Pole otwiera własną listę wartości z polem wyszukiwania u góry: wpisz fragment nazwy – w przypadku projektu także fragment jego klucza – aby zawęzić listę, i wybierz potrzebne wartości. Każda zaznaczona lub odznaczona wartość działa od razu, a lista zostaje otwarta na kolejne wybory; zamknij ją klawiszem Esc, wybierając miejsce poza nią albo – na telefonie – przyciskiem **Gotowe**, a przyciskiem **Filtry** wróć tam do listy pól.

Wybrane wartości są na początku listy. Projekty, organizacje i osoby są wyszukiwane spośród wszystkich, które widzisz; gdy jest ich więcej, niż pokazuje lista, widać „Wpisz, aby znaleźć więcej”.

Każdy filtr może mieć kilka wartości: zgłoszenie pasuje, gdy ma jedną z wartości filtru, i to dla wszystkich filtrów naraz.

| Filtr | Wartości |
|---|---|
| **Projekt** | Twoje projekty, aktywne i zarchiwizowane |
| **Organizacja** | Organizacje z dostępem do jednego z Twoich projektów oraz brak organizacji; widoczny dopiero, gdy istnieją organizacje |
| **Typ** | **Błąd**, **Funkcjonalność**, **Zadanie**, **Pytanie**, **Nie ustawiono** |
| **Status** | Statusy, pogrupowane jak w widoku zgłoszenia; **Otwarte** wybiera każdy status, który nie jest zamknięty |
| **Priorytet** | **Niski**, **Normalny**, **Wysoki**, **Krytyczny** |
| **Przypisany** | **Ja**, **Nieprzypisane** i członkowie projektów wybranych w filtrze **Projekt** – najpierw wybierz projekt, aby znaleźć osoby |
| **Źródło** | **Użytkownik** (z portalu), **Developer** (zespół), a **Integracja** dopiero, gdy jakieś zgłoszenie z niej pochodzi |
| **Prośba o udostępnienie** | **Oczekująca**, **Odmówiona** |

Aktywne filtry są widoczne obok **Dodaj filtr** jako etykiety z pierwszą wartością i liczbą pozostałych, na przykład „Status: Nowe +1”. Wybierz etykietę, aby zmienić jej wartości, jej **×**, aby usunąć ten filtr, albo **Wyczyść filtry**, aby usunąć wszystkie; bez filtrów lista pokazuje każde zgłoszenie, które widzisz.

Widok, filtry i kolejność są częścią adresu strony, więc zostają po odświeżeniu i możesz je udostępnić jako link – na przykład `/tickets?view=triage`. Lista bez żadnego filtru ma adres `/tickets?view=custom`. Gdy link wskazuje coś, czego nie widzisz – na przykład projekt, którego nie jesteś już członkiem – jego etykieta pokazuje „Nieznany” i nie pasuje do żadnego zgłoszenia; usuń ją, a pozostałe wartości nadal obowiązują.

## Sortowanie

Na tablecie i komputerze wybierz nagłówek kolumny **ID**, **Status**, **Priorytet** albo **Zaktualizowano**, aby posortować według niej, i wybierz go ponownie, aby odwrócić kolejność. Na telefonie wybierz kolejność w polu **Sortuj**, które oferuje też datę utworzenia. Zgłoszenia o tej samej wartości są ułożone według ostatniej zmiany. Statusy są sortowane w kolejności przepływu pracy, od **Nowe**; identyfikatory według projektu, a potem numeru. Zmiana kolejności nie zmienia widoku.

## Zaznaczanie

Zaznacz pole wyboru zgłoszenia, aby je zaznaczyć; pole wyboru w nagłówku tabeli zaznacza wszystkie wczytane zgłoszenia. Możesz zaznaczyć najwyżej 100 zgłoszeń – wtedy pozostałe pola wyboru są nieaktywne z podpowiedzią „Jednorazowo możesz zmienić najwyżej 100 zgłoszeń.”. Zmiana widoku, filtru albo kolejności usuwa zaznaczenie.

Gdy zaznaczysz zgłoszenie, pasek pokazuje, ile zgłoszeń jest zaznaczonych, oraz **Status**, **Priorytet**, **Przypisany** i **Wyczyść zaznaczenie**. Na telefonie jest on na dole ekranu. Zobacz [Zmień wiele zgłoszeń naraz](../how-to/change-many-tickets-at-once.md).

## Akcje zbiorcze

| Akcja | Wybór |
|---|---|
| **Status** | Każdy status oprócz **Duplikat**, który wymaga osobnego oryginalnego zgłoszenia dla każdego zgłoszenia. **Odrzucone** prosi o jeden powód, dodawany do każdego zgłoszenia jako Twój komentarz publiczny |
| **Priorytet** | **Niski**, **Normalny**, **Wysoki**, **Krytyczny** |
| **Przypisany** | **Przypisz do mnie**, **Nieprzypisane**; gdy wszystkie zaznaczone zgłoszenia należą do jednego projektu, w którym możesz przypisywać osoby, także osoby, które można w nim przypisać |

Akcja jest dostępna, gdy pozwala na nią co najmniej jedno zaznaczone zgłoszenie. Każde zgłoszenie jest zmieniane osobno, według zasad [widoku zgłoszenia](ticket-view.md): zgłoszenie, którego nie możesz zmienić, nie zostaje zmienione, a pozostałe tak. Zmiany zbiorcze nie mają opcji **Cofnij**.

## Wyniki

Gdy wszystkie zgłoszenia zostały zmienione, informuje o tym komunikat, na przykład „Zaktualizowano 20 zgłoszeń”. Status **Zakończone** w projekcie, który prosi zgłaszających o potwierdzenie rozwiązania, liczy się jako zmiana; komunikat dodaje, ile zgłoszeń czeka na potwierdzenie zgłaszającego.

W przeciwnym razie okno – na telefonie na dole ekranu – podaje, ile zgłoszeń zmieniono, na przykład „Zaktualizowano 19 z 20 zgłoszeń”, i wymienia każde niezmienione zgłoszenie z identyfikatorem, tytułem i powodem:

| Powód | Znaczenie |
|---|---|
| „Zmienione przez kogoś innego – odśwież, aby zobaczyć najnowszą wersję” | Ktoś zmienił zgłoszenie po wczytaniu listy |
| „Nie masz uprawnień do wykonania tej czynności” | Twoja rola nie pozwala na tę zmianę zgłoszenia, na przykład na przypisanie innej osoby przez Developera |
| „Już niedostępne” | Nie widzisz już zgłoszenia, na przykład dlatego, że usunięto Cię z jego projektu |
| „Projekt jest zarchiwizowany” | Projekt zgłoszenia jest zarchiwizowany i tylko do odczytu |
| Komunikat reguły, na przykład „Przypisać można tylko aktywnych członków zespołu projektu.” | Zmiana narusza regułę projektu zgłoszenia |

Niezmienione zgłoszenia pozostają zaznaczone. **Odśwież i ponów** wczytuje listę ponownie i powtarza zmianę dla nich; zgłoszenie, którego nie ma już na liście, przestaje być zaznaczone, a wynik podaje, ile takich było.

## Oczekujące udostępnienia

W widoku **Oczekujące udostępnienia** każde zgłoszenie ma przyciski **Zatwierdź udostępnienie** i **Odmów udostępnienia**, jeśli pozwala na nie Twoja rola:

- **Zatwierdź udostępnienie** prosi o potwierdzenie i podaje link do zgłoszenia: najpierw sprawdź jego opis i pliki, bo po udostępnieniu zobaczy je każdy klient projektu. Zatwierdzenie nie ma opcji **Cofnij**.
- **Odmów udostępnienia** prosi o **Powód**, który trafia do zgłoszenia jako Twój komentarz publiczny.

Po każdej z tych decyzji zgłoszenie znika z widoku. Jeśli ktoś z zespołu zdecydował wcześniej, Trybun pokaże „Ta prośba o udostępnienie została już rozpatrzona.”. Zobacz [Udostępnij zgłoszenie wszystkim klientom](../how-to/share-a-ticket-with-all-customers.md).

## Gdy lista jest pusta

Lista podaje powód, na przykład „Nie masz przypisanych otwartych zgłoszeń.” w widoku **Moje otwarte zgłoszenia**, „Żadna prośba o udostępnienie nie czeka na zatwierdzenie.” w widoku **Oczekujące udostępnienia** albo „Żadne zgłoszenie nie pasuje do tych filtrów.” z przyciskiem **Wyczyść filtry** dla Twoich własnych filtrów.
