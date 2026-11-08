/** The team ticket view of a ticket, by its identifier such as `ERP-12` (§3.2). */
export function ticketHref(identifier: string): string {
  return `/tickets/${identifier}`;
}
