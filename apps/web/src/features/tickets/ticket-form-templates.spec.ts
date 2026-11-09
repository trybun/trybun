import { ticketTypeSchema, type TicketPriority, type TicketType } from '@trybun/contracts/tickets';
import { CATALOGUES, LOCALES } from '@trybun/i18n/catalogues';
import { describe, expect, it } from 'vitest';
import {
  isUntouchedDescription,
  nextDescription,
  nextPriority,
  normalizeDescription,
  type TicketTemplates,
} from './ticket-form-templates.js';

const TEMPLATES: TicketTemplates = CATALOGUES.en.tickets.templates;
const BUG = TEMPLATES.bug;
const TASK = TEMPLATES.task;

describe('nextDescription', () => {
  it.each<[string, string, TicketType, TicketType, string]>([
    ['empty', '', 'task', 'bug', BUG],
    ['only whitespace', ' \n\t\n', 'task', 'bug', BUG],
    ['unchanged', TASK, 'task', 'bug', BUG],
    ['unchanged with a trailing newline', `${TASK}\n`, 'task', 'bug', BUG],
    ['unchanged with Windows line endings', TASK.replaceAll('\n', '\r\n'), 'task', 'bug', BUG],
    [
      'unchanged with spaces at the ends of lines',
      TASK.replaceAll('\n', '  \n'),
      'task',
      'bug',
      BUG,
    ],
    ['edited', `${TASK}\nExport the invoices`, 'task', 'bug', `${TASK}\nExport the invoices`],
    ['the template of another type', BUG, 'task', 'question', BUG],
    ['edited and restored exactly', TASK, 'task', 'feature', TEMPLATES.feature],
  ])('%s: keeps the text or inserts the next template (§3.4)', (_, current, from, to, expected) => {
    expect(nextDescription(current, from, to, TEMPLATES)).toBe(expected);
  });

  it('compares within the language the template was inserted in (Q4)', () => {
    const polish = CATALOGUES.pl.tickets.templates;

    expect(nextDescription(polish.task, 'task', 'bug', polish)).toBe(polish.bug);
    expect(nextDescription(polish.task, 'task', 'bug', TEMPLATES)).toBe(polish.task);
  });
});

describe('nextPriority', () => {
  it.each<[string, TicketPriority, TicketType, TicketType, TicketPriority]>([
    ['the default of the previous type', 'normal', 'task', 'question', 'low'],
    ['the default of a question', 'low', 'question', 'bug', 'normal'],
    ['the default of both types', 'normal', 'task', 'bug', 'normal'],
    ['chosen by the person', 'high', 'task', 'question', 'high'],
    ['chosen and equal to the next default', 'low', 'task', 'question', 'low'],
    ['chosen as normal for a question', 'normal', 'question', 'task', 'normal'],
  ])('%s: follows the type only while it is its default (Q3)', (_, current, from, to, expected) => {
    expect(nextPriority(current, from, to)).toBe(expected);
  });
});

describe('the templates of the catalogues', () => {
  it.each(LOCALES)('give every type a structure with headings in %s (§3.4)', (locale) => {
    const templates = CATALOGUES[locale].tickets.templates;
    for (const type of ticketTypeSchema.options) {
      expect(templates[type]).toMatch(/^## /);
      // A template counts as untouched as inserted, so a type change replaces it.
      expect(isUntouchedDescription(templates[type], type, templates)).toBe(true);
      expect(normalizeDescription(templates[type])).toBe(templates[type]);
    }
  });
});
