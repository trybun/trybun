---
title: Manage organizations
description: Group the end users of a customer company in an organization, with its e-mail domains, the projects it may access and its members.
views: ['/admin/organizations', '/admin/organizations/[organizationId]']
---

An organization is a customer company: its e-mail domains, the projects it may access and its members, the end users of the company. Organizations are optional – Trybun works without them. Only the Administrator manages them.

## Create an organization

1. Open **Administration**, then **Organizations**, and select **New organization**.
2. Enter the **Name**. It must be unique among all organizations, active and archived, regardless of letter case.
3. Optionally enter the **E-mail domains** of the company, separated by commas, for example `company.com, company.pl`.
4. Select **Create organization**. The organization opens.

## E-mail domains

Under **E-mail domains**, enter a domain and select **Add domain**, or select **Remove** next to one.

The domains tell which e-mail addresses belong to the company. A domain matches exactly – `company.com` does not cover `pl.company.com`; add a subdomain as a domain of its own. A domain belongs to one organization only, also while that organization is archived. Public mail domains such as `gmail.com` cannot be added, because their users are not one company.

Adding or removing a domain never adds or removes members.

## Projects

Under **Projects**, add the projects the organization may access, or remove them. Only active projects can be added or removed. The settings of a project list the organizations with access to it.

## Members

1. Under **Members**, enter the e-mail address of an existing end user and select **Add member**.
2. If the person already belongs to another organization, Trybun asks first: an end user belongs to one organization only, and moving them changes which tickets they can see. Confirm to move them.

Team members never belong to organizations. To remove a member, select **Remove** next to them; a message offers **Undo** for a moment. Removing someone from the organization keeps their account and the projects they were added to personally.

## Archive, unarchive and delete

Open the organization:

- **Archive organization**, under **Danger zone**, makes it read-only until you unarchive it: its name, domains, projects and members cannot be changed. Its domains stay reserved.
- **Unarchive organization**, in the banner of an archived organization, restores it. Archiving also offers **Undo** for a moment.
- **Delete organization**, under **Danger zone**, removes it with its domains, project access and memberships; the members keep their accounts. It cannot be undone. An organization with tickets cannot be deleted – archive it instead.
