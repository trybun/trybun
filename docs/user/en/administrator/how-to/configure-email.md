---
title: Configure e-mail
description: Connect Trybun to an SMTP server, so that it sends e-mail, including password resets.
---

Trybun sends e-mail through an SMTP server of your choice – your mail provider or a transactional e-mail service. Until it is configured, Trybun sends no e-mail and invitation links have to be passed on by hand. The same settings are used by the sign-in (password reset, e-mail verification).

1. On the server, open `.env` in the folder of the installation.
2. Set the variables of the **E-mail** section:

   ```sh
   TRYBUN_SMTP_HOST=smtp.example.com
   TRYBUN_SMTP_PORT=587
   TRYBUN_SMTP_SECURITY=starttls
   TRYBUN_SMTP_USER=trybun@example.com
   TRYBUN_SMTP_PASSWORD=…
   TRYBUN_MAIL_FROM=trybun@example.com
   ```

   `TRYBUN_SMTP_SECURITY` is `starttls` (port 587), `tls` (port 465) or `none`. `TRYBUN_MAIL_FROM` is the sender address and is required.

3. Apply the change:

   ```sh
   docker compose up -d --wait
   ```

The item **Configure e-mail** of **Administration** › **Getting started** is ticked as soon as `TRYBUN_SMTP_HOST` is set.
