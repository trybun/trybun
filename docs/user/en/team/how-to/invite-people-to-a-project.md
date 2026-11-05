---
title: Invite people to a project
description: Invite a team member or an end user to a project by their e-mail address, copy the invitation link, and resend or revoke a pending invitation.
---

Project managers invite people to their projects; the Administrator invites people to every project. An invitation is a link that works once and is valid for 7 days. Trybun does not send it by e-mail yet: you copy the link and send it to the person yourself.

## Invite someone

1. Select **Projects**, open the project, then the **Members** tab.
2. Select **Add member**, then **By e-mail address**.
3. Enter the person's **E-mail address** and choose the **Role**:
   - **Developer** or **Project manager** for a member of your team. Team members sign in with GitHub, so GitHub sign-in must be configured first ([configure GitHub sign-in](../../administrator/how-to/configure-github-sign-in.md)).
   - **End user** for a person on the customer side who reports tickets.
4. Read the line under the form. It tells you what will happen before anything is sent:
   - **This person gets an invitation link.**
   - **This person will join the organization X.** – an end user whose e-mail domain belongs to an organization that has this project joins that organization when they accept, and reaches the project through it.
   - **This person already has an account and gets the access at once.** – no invitation is needed.
   - Otherwise it says why the person cannot be added, for example because the address belongs to an account of the other kind or to a deactivated account.
5. Select **Invite** (or **Add**, when the person already has an account).
6. In **Invitation created**, select **Copy link** and send the link to the person, for example in a chat or an e-mail. Only this link works, and it is shown only now.

The person opens the link and accepts the invitation ([accept an invitation](../../end-user/how-to/accept-an-invitation.md)).

## Pending invitations

Invitations that have not been accepted yet are listed under **Pending invitations** on the **Members** tab, with the address, the role, who invited the person and when the link expires.

- **Copy new link** – creates a new link after a confirmation; the old link stops working. The new link is valid for 7 days. Use it when the person lost the link or it expired.
- **Revoke** – the link stops working. You can invite the person again later.

An invitation is also revoked when its project is archived or the person's account is deactivated.

## Several invitations of one person

A person can hold invitations to several projects before accepting any. Each link grants only its own project and role. Once the person has an account, a further link works only when they are signed in with that account.

See also: [manage project members](manage-project-members.md), [project settings](../reference/project-settings.md).
