---
title: Zarządzaj organizacjami
description: Zgrupuj użytkowników końcowych firmy klienta w organizacji, z jej domenami e-mail, projektami, do których ma dostęp, i członkami.
views: ['/admin/organizations', '/admin/organizations/[organizationId]']
---

Organizacja to firma klienta: jej domeny e-mail, projekty, do których ma dostęp, i jej członkowie, czyli użytkownicy końcowi firmy. Organizacje są opcjonalne – Trybun działa bez nich. Zarządza nimi tylko Administrator.

## Utwórz organizację

1. Otwórz **Administrację**, potem **Organizacje**, i wybierz **Nowa organizacja**.
2. Wpisz **Nazwę**. Musi być unikalna wśród wszystkich organizacji, aktywnych i zarchiwizowanych, bez względu na wielkość liter.
3. Opcjonalnie dodaj **Domeny e-mail** firmy, np. `firma.pl`.
4. Wybierz **Utwórz organizację**. Organizacja się otworzy.

## Domeny e-mail

Domeny wskazują, które adresy e-mail należą do firmy. Domena pasuje dokładnie – `firma.pl` nie obejmuje `oddzial.firma.pl`; subdomenę dodaj jako osobną domenę. Domena należy tylko do jednej organizacji, także gdy ta organizacja jest zarchiwizowana. Nie można dodać publicznych domen poczty, takich jak `gmail.com`, bo ich użytkownicy nie są jedną firmą.

Dodanie ani usunięcie domeny nigdy nie dodaje ani nie usuwa członków.

## Projekty

W sekcji **Projekty** dodaj projekty, do których organizacja ma dostęp, albo je usuń. Dodawać i usuwać można tylko aktywne projekty. Ustawienia projektu pokazują organizacje, które mają do niego dostęp.

## Członkowie

1. W sekcji **Członkowie** wpisz adres e-mail istniejącego użytkownika końcowego i wybierz **Dodaj członka**.
2. Jeśli osoba należy już do innej organizacji, Trybun najpierw pyta: użytkownik końcowy należy tylko do jednej organizacji, a przeniesienie zmienia, które zgłoszenia widzi. Potwierdź, aby ją przenieść.

Członkowie zespołu nigdy nie należą do organizacji. Aby usunąć członka, wybierz **Usuń** obok niego; komunikat przez chwilę oferuje **Cofnij**. Usunięcie z organizacji zachowuje konto osoby i projekty, do których dodano ją osobiście.

## Zarchiwizuj, przywróć i usuń

- **Zarchiwizuj organizację** sprawia, że jest tylko do odczytu, dopóki jej nie przywrócisz: nie można zmienić jej nazwy, domen, projektów ani członków. Jej domeny pozostają zarezerwowane.
- **Przywróć organizację z archiwum** przywraca ją.
- **Usuń organizację** usuwa ją razem z domenami, dostępem do projektów i członkostwami; członkowie zachowują konta. Tego nie można cofnąć. Organizacji ze zgłoszeniami nie można usunąć – zamiast tego ją zarchiwizuj.
