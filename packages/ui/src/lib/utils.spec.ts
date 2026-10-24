import { describe, expect, it } from 'vitest';
import { cn } from './utils.js';

describe('cn', () => {
  it.each([
    [
      'a text size and a text colour',
      ['text-sm', 'text-muted-foreground'],
      'text-sm text-muted-foreground',
    ],
    [
      'a text size and a semantic colour',
      ['text-xs', 'text-destructive'],
      'text-xs text-destructive',
    ],
    ['two text sizes', ['text-sm', 'text-base'], 'text-base'],
    ['two text colours', ['text-foreground', 'text-brand-accent'], 'text-brand-accent'],
    ['two background tokens', ['bg-primary', 'bg-success'], 'bg-success'],
    ['a class name passed last', ['h-11 px-3', 'px-4'], 'h-11 px-4'],
  ])('merges %s', (_case, classes, expected) => {
    expect(cn(...classes)).toBe(expected);
  });
});
