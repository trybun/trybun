/** The team ticket view of a ticket, by its identifier such as `ERP-12` (§3.2). */
export function ticketHref(identifier: string): string {
  return `/tickets/${identifier}`;
}

/** The full ticket form of the team (§3.3), optionally with the project it is opened from. */
export function newTicketHref(projectId?: string): string {
  return projectId === undefined ? '/tickets/new' : `/tickets/new?projectId=${projectId}`;
}
