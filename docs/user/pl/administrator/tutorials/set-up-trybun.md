---
title: Konfiguracja Trybuna po instalacji
description: Utwórz pierwsze konto Administratora w kreatorze pierwszego uruchomienia, zaloguj się z uwierzytelnianiem dwuskładnikowym i przejdź listę pierwszych kroków.
views: ['/admin']
---

Gdy `./trybun install` uruchomi Trybun, wypisuje **link konfiguracyjny**. Link tworzy pierwsze konto Administratora – jedyne konto, które nie wymaga zaproszenia. Działa jeden raz i wygasa po 24 godzinach.

## Utwórz konto Administratora

1. Otwórz link konfiguracyjny w przeglądarce.
2. Wpisz imię, nazwisko, adres e-mail i hasło o długości co najmniej 15 znaków – dobrze sprawdza się fraza z kilku słów; nie może być Twoim adresem e-mail ani popularnym hasłem ([wybierz hasło](../../end-user/how-to/choose-a-password.md)). Wybierz ikonę oka, aby sprawdzić, co wpisano.
3. Wybierz swój język i strefę czasową. Na początku mają wartości domyślne systemu, które strona też pokazuje.
4. Wybierz **Utwórz konto Administratora**.

Jeśli strona informuje, że link jest nieprawidłowy lub wygasł, uruchom to polecenie w folderze instalacji na serwerze i otwórz nowy link:

```sh
./trybun setup-token
```

Nowy link zastępuje wszystkie wcześniejsze. Gdy konto Administratora już istnieje, strona konfiguracji proponuje tylko logowanie.

## Zaloguj się pierwszy raz

1. Wybierz **Zaloguj się** i wpisz adres e-mail oraz hasło.
2. Trybun poprosi o skonfigurowanie **uwierzytelniania dwuskładnikowego**: zeskanuj kod QR aplikacją uwierzytelniającą (np. FreeOTP, Google Authenticator lub Microsoft Authenticator) i wpisz pokazany w niej kod.

Od teraz logujesz się hasłem i kodem z aplikacji. To konto działa także wtedy, gdy logowanie przez GitHub jest niedostępne, więc chroń jego hasło i aplikację uwierzytelniającą.

## Przejdź listę pierwszych kroków

Po pierwszym logowaniu Trybun otwiera **Administracja** › **Pierwsze kroki**. Każda pozycja pokazuje, czy jest gotowa, i prowadzi do strony, która ją wyjaśnia. Pozycje zaznaczają się same, gdy tylko istnieje ich ustawienie – nigdy nie zaznaczasz ich ręcznie:

- [Utwórz projekt](../how-to/create-archive-and-delete-a-project.md) – zgłoszenia żyją w projektach; pozycja zaznacza się, gdy istnieje jakikolwiek projekt.
- [Skonfiguruj logowanie przez GitHub](../how-to/configure-github-sign-in.md) – członkowie zespołu logują się przez GitHub; wymagane, zanim zaprosisz zespół.
- [Skonfiguruj e-mail](../how-to/configure-email.md) – bez serwera SMTP Trybun nie wysyła e-maili.
- [Skonfiguruj miejsce na kopie zapasowe](../how-to/configure-backup-storage.md) – bez magazynu S3 w innej lokalizacji codzienne kopie zapasowe zostają na serwerze i przepadną razem z nim.

**Administrację** znajdziesz w bocznej nawigacji na tablecie lub komputerze, a na telefonie w menu konta.

## Jeśli pomylisz hasło

Hasło to to, które wpisano w kreatorze. Jeśli nie możesz się nim zalogować, zresetuj je w konsoli administracyjnej Keycloak, dostępnej tylko przez tunel SSH do serwera: użytkownik `admin`, hasło `TRYBUN_KEYCLOAK_ADMIN_PASSWORD` z `.env`, realm `trybun`, **Users** › Twoje konto › **Credentials** › **Reset password**.
