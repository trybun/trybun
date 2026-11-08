import { MY_TICKETS_HREF, PORTAL_HREF } from '../app-shell/navigation.js';

/** The home of a project in the portal: **Create ticket** and its "My tickets" (§5.7). */
export function portalProjectHref(projectId: string): string {
  return `${PORTAL_HREF}/projects/${projectId}`;
}

/** The simplified ticket form of a project (§3.3). */
export function newTicketHref(projectId: string): string {
  return `${portalProjectHref(projectId)}/tickets/new`;
}

/** "My tickets", across projects or of one project (§5.7). */
export function myTicketsHref(projectId?: string): string {
  return projectId === undefined
    ? MY_TICKETS_HREF
    : `${MY_TICKETS_HREF}?${new URLSearchParams({ projectId }).toString()}`;
}

/** A ticket in the portal, by its identifier such as `ERP-12` (§3.2). */
export function portalTicketHref(identifier: string): string {
  return `${MY_TICKETS_HREF}/${identifier}`;
}

/** The confirmation page of the resolution answer (§4.3, Q14). */
export function resolutionConfirmationHref(
  identifier: string,
  answer: 'solved' | 'not_solved',
): string {
  return `${portalTicketHref(identifier)}/resolution-confirmation?${new URLSearchParams({ answer }).toString()}`;
}

/** The Account settings of end users (§13.1, Q17). */
export const PORTAL_SETTINGS_HREF = `${PORTAL_HREF}/settings`;
