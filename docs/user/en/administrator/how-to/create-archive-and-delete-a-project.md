---
title: Create, archive and delete a project
description: Create a project with its key, archive it to make it read-only, restore it from the archive, or delete it for good.
views: ['/projects']
---

Only the Administrator creates, archives, unarchives and deletes projects.

## Create a project

1. Select **Projects** in the navigation, then **New project**.
2. Enter the **Name**. Trybun suggests the **Key** from the name until you edit it yourself; the letters you type are shown in upper case.
3. Check the **Key**: 2–10 capital letters or digits, starting with a letter (for example `ERP`). It must be unique among all projects, active and archived. You can change it in the project settings only until the first ticket of the project, because it is part of ticket identifiers such as `ERP-12`.
4. Select **Create project**.

The settings of the new project open on **Members**, where you [add the team](../../team/how-to/manage-project-members.md).

## Archive a project

1. Select **Projects** and open the project – a row opens its settings.
2. Open **Danger zone** and select **Archive project**.

A message offers **Undo** for a moment. An archived project is read-only for everyone, including the Administrator: every page of it shows "This project is archived and read-only.". It leaves the navigation and the **Active** tab of the list and stays on the **Archived** tab.

## Unarchive a project

1. Select **Projects**, switch to the **Archived** tab and open the project.
2. Open **Danger zone** and select **Unarchive project**.

## Delete a project

Only an active project without tickets can be deleted – unarchive an archived one first. A project that has ever had a ticket cannot be deleted, so that its ticket identifiers are never used again; archive it instead.

1. Open the project, then **Danger zone** and select **Delete project**.
2. Type the key of the project to confirm.
3. Select **Delete project**.

Deleting cannot be undone. It removes the memberships of the project; its key can be used again afterwards.

See also: [project settings](../../team/reference/project-settings.md).
