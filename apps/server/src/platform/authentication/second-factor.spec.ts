import { describe, expect, it } from 'vitest';
import { isSecondFactorSatisfied } from './second-factor.js';

describe('isSecondFactorSatisfied', () => {
  it.each([
    ['team', ['pwd', 'otp'], true],
    ['team', ['otp'], true],
    ['team', ['hwk'], true],
    ['team', ['pwd'], false],
    ['team', [], false],
    ['end_user', ['pwd'], true],
    ['end_user', [], true],
  ] as const)('%s with amr %j: %s', (userKind, amr, expected) => {
    expect(isSecondFactorSatisfied(userKind, amr)).toBe(expected);
  });
});
