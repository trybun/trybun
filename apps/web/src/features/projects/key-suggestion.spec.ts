import { describe, expect, it } from 'vitest';
import { normalizeKeyInput, suggestKey } from './key-suggestion.js';

describe('suggestKey', () => {
  it.each([
    ['ERP', 'ERP'],
    ['erp', 'ERP'],
    ['Customer Portal', 'CP'],
    ['Customer self-service portal', 'CSSP'],
    ['One two three four five', 'OTTF'],
    ['Helpdesk', 'HELP'],
    ['Łódź office', 'LO'],
    ['Zażółć', 'ZAZO'],
    ['2026 roadmap', 'ROAD'],
    ['A', 'A'],
    ['ERP 2', 'E2'],
    ['', ''],
    ['  —  ', ''],
  ])('suggests for %j the key %j', (name, key) => {
    expect(suggestKey(name)).toBe(key);
  });
});

describe('normalizeKeyInput', () => {
  it.each([
    ['erp', 'ERP'],
    ['e r-p', 'ERP'],
    ['a1b2', 'A1B2'],
  ])('shows %j as %j', (value, shown) => {
    expect(normalizeKeyInput(value)).toBe(shown);
  });
});
