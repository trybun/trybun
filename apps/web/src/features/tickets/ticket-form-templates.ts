import {
  TICKET_TYPE_DEFAULT_PRIORITY,
  type TicketPriority,
  type TicketType,
} from '@trybun/contracts/tickets';

/**
 * The description templates of the team in one language (§3.4): the catalogue texts
 * `tickets.templates.<type>` until S1-17 manages them (S1-10 Q1).
 */
export type TicketTemplates = Readonly<Record<TicketType, string>>;

/**
 * A description as the replacement rule compares it (S1-10 Q3): one kind of line ending, no
 * whitespace at the end of a line or of the text, so an editor that adds a final newline has not
 * changed it.
 */
export function normalizeDescription(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/** Whether a description is empty or still the template of its type: nobody has written in it. */
export function isUntouchedDescription(
  description: string,
  type: TicketType,
  templates: TicketTemplates,
): boolean {
  const normalized = normalizeDescription(description);
  return normalized === '' || normalized === normalizeDescription(templates[type]);
}

/**
 * The description after the type of the full form changed (§3.4, S1-10 Q3): the template of the
 * next type while the description is empty or equals the template of the previous type, else the
 * person's text, never overwritten. The comparison has no hidden state, so a template edited and
 * restored exactly is replaced again. `templates` are those of the language the form inserted
 * (Q4), so a language switch while the form is open changes nothing.
 */
export function nextDescription(
  current: string,
  previousType: TicketType,
  nextType: TicketType,
  templates: TicketTemplates,
): string {
  return isUntouchedDescription(current, previousType, templates) ? templates[nextType] : current;
}

/**
 * The priority after the type of the full form changed (§3.4, S1-10 Q3): the default of the next
 * type while the priority is the default of the previous type, else the priority the person chose.
 */
export function nextPriority(
  current: TicketPriority,
  previousType: TicketType,
  nextType: TicketType,
): TicketPriority {
  return current === TICKET_TYPE_DEFAULT_PRIORITY[previousType]
    ? TICKET_TYPE_DEFAULT_PRIORITY[nextType]
    : current;
}
