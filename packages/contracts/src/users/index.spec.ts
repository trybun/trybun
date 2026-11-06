import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  currentUserActionSchema,
  languageSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  timeZoneSchema,
  userKindSchema,
  userStateSchema,
} from './index.js';

describe('user enums', () => {
  it.each([
    [userKindSchema, ['team', 'end_user']],
    [userStateSchema, ['invited', 'active', 'deactivated', 'anonymized']],
    [languageSchema, ['en', 'pl']],
    [currentUserActionSchema, ['open_administration', 'create_project', 'create_organization']],
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

describe('password policy', () => {
  // The policy Keycloak applies on installation and update (§7.4, §15.5).
  const realm = readFileSync(
    join(import.meta.dirname, '../../../../docker/keycloak/realm/trybun.yaml'),
    'utf8',
  );
  const policy = /^passwordPolicy: (.+)$/m.exec(realm)?.[1] ?? '';

  it('has the lengths of the realm', () => {
    expect(policy).toContain(`length(${PASSWORD_MIN_LENGTH.toString()})`);
    expect(policy).toContain(`maxLength(${PASSWORD_MAX_LENGTH.toString()})`);
  });

  it.each([
    [14, false],
    [15, true],
    [64, true],
    [65, false],
  ])('a password of %i characters is accepted: %s', (length, isValid) => {
    expect(passwordSchema.safeParse('a'.repeat(length)).success).toBe(isValid);
  });
});
