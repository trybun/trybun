---
title: Set up Trybun after installation
description: Create the first Administrator account in the first-run wizard, sign in with two-factor authentication and work through the getting-started checklist.
views: ['/admin']
---

After `./trybun install` has started Trybun, it prints a **setup link**. The link creates the first Administrator account – the only account that does not need an invitation. It works once and expires after 24 hours.

## Create the Administrator account

1. Open the setup link in a browser.
2. Enter your first name, last name, e-mail address and a password. Select the eye icon to check what you typed.
3. Choose your own language and time zone. They start with the defaults of the system, which the page also shows.
4. Select **Create Administrator account**.

If the page says that the link is invalid or has expired, run this command in the folder of the installation on the server and open the new link:

```sh
./trybun setup-token
```

A new link replaces every earlier one. Once the Administrator account exists, the setup page only offers to sign in.

## Sign in for the first time

1. Select **Sign in** and enter your e-mail address and password.
2. Trybun asks you to set up **two-factor authentication**: scan the QR code with an authenticator app (for example FreeOTP, Google Authenticator or Microsoft Authenticator) and enter the code it shows.

From now on you sign in with your password and a code from the app. This account keeps working even when GitHub sign-in is unavailable, so keep its password and authenticator app safe.

## Work through the getting-started checklist

After the first sign-in, Trybun opens **Administration** › **Getting started**. Each item shows whether it is done and links to a page that explains it. Items tick themselves as soon as their setting exists – you never tick them by hand:

- [Configure GitHub sign-in](../how-to/configure-github-sign-in.md) – team members sign in with GitHub; required before you can invite the team.
- [Configure e-mail](../how-to/configure-email.md) – without an SMTP server Trybun sends no e-mail.

You find **Administration** in the side navigation on a tablet or a computer, and in the account menu on a phone.

## If you mistype the password

The password is the one you entered in the wizard. If you cannot sign in with it, reset it in the Keycloak administration console, which is reachable only through an SSH tunnel to the server: user `admin`, password `TRYBUN_KEYCLOAK_ADMIN_PASSWORD` from `.env`, realm `trybun`, **Users** › your account › **Credentials** › **Reset password**.
