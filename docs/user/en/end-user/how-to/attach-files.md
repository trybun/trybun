---
title: Attach files
description: Add screenshots, logs and documents to a ticket, see whether they were checked, and delete them.
---

A screenshot, a log or a document shows the team the problem the way you see it. You attach files when you [report a problem](report-a-problem.md).

## Add files

In **Description** of the form **Create ticket**, add files in one of these ways:

- drag them onto the field;
- paste them, for example a screenshot you copied;
- select **Attach files** in the toolbar of the field and choose them.

You can add at most 10 files at once. Each file is uploaded straight away and appears in the list below the field, first as **Uploading…**, then as **Checking…** while Trybun checks it for malware. You do not need to wait: you can submit the ticket while files are still being checked.

Trybun also adds a reference to each file to the text of the description. In **Preview**, an image is shown in its place and any other file is a link.

## Which files you can attach

- Images: PNG, JPEG, GIF, WebP
- Documents: PDF, DOCX, XLSX, PPTX, ODT, ODS
- Text: TXT, LOG, CSV, JSON
- Archives: ZIP

A file can be up to 25 MB, unless your Administrator has set a different limit. Trybun checks what a file contains, not only its name: a file whose content does not match its extension is refused, and so are password-protected ZIP archives and PDF files, because they cannot be checked. A refused file is not added; a message names the file and the reason.

Trybun removes the location and other photo details (EXIF) from images.

## Remove a file before submitting

Select the bin icon (**Delete**) next to the file in the list below the field. The file is deleted at once, and its reference disappears from the description.

Files you add but never submit are deleted automatically after 24 hours. If that happens while the form is still open, the file leaves the form and a message names it.

## Open the files of a ticket

A ticket shows its files below the description, each with its name and size, and a thumbnail for an image. Select a file to open it: an image opens in the browser, any other file is downloaded.

Everyone who sees the ticket – you and the team – sees its files.

Each file that cannot be opened shows why:

- **Checking…** – Trybun is still checking the file for malware. The state changes by itself, usually within a few seconds.
- **File removed: malware detected** – the check found malware, so the file was deleted.
- **File removed: could not be checked** – the file could not be checked completely, for example because its unpacked content is too large or an image cannot be read, so the file was deleted to keep everyone safe.

## Delete a file

You can delete the files you attached yourself; the team can delete files as well.

1. Open the ticket from **My tickets**.
2. Select the bin icon (**Delete**) next to the file.
3. Confirm. A deleted file cannot be restored.

You cannot delete files when the project is archived or when you no longer have access to the project. You can still open them.

## See it in the history

When a file is added to an existing ticket or a file is deleted, the history of the ticket shows it, for example "Anna added the file screenshot.png" or "Jan deleted the file log.txt". Files attached while creating the ticket appear only in its list of files.
