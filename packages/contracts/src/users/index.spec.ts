import { describe, expect, it } from 'vitest';
import {
  currentUserActionSchema,
  languageSchema,
  timeZoneSchema,
  userKindSchema,
  userStateSchema,
} from './index.js';

describe('user enums', () => {
  it.each([
    [userKindSchema, ['team', 'end_user']],
    [userStateSchema, ['invited', 'active', 'deactivated', 'anonymized']],
    [languageSchema, ['en', 'pl']],
    [currentUserActionSchema, ['open_administration']],
  ])('lists the glossary codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('timeZoneSchema', () => {
  it.each([
    ['Europe/Warsaw', true],
    ['UTC', true],
    ['Mars/Olympus_Mons', false],
    ['', false],
  ])('%s is valid: %s', (value, isValid) => {
    expect(timeZoneSchema.safeParse(value).success).toBe(isValid);
  });
});
