import { describe, expect, it } from 'vitest';
import { gettingStartedItems } from './getting-started.js';

describe('gettingStartedItems', () => {
  it.each([
    [
      {
        isGithubSignInConfigured: false,
        isSmtpConfigured: false,
        isBackupStorageConfigured: false,
      },
      [false, false, false],
    ],
    [
      { isGithubSignInConfigured: true, isSmtpConfigured: false, isBackupStorageConfigured: false },
      [true, false, false],
    ],
    [
      { isGithubSignInConfigured: false, isSmtpConfigured: true, isBackupStorageConfigured: false },
      [false, true, false],
    ],
    [
      { isGithubSignInConfigured: false, isSmtpConfigured: false, isBackupStorageConfigured: true },
      [false, false, true],
    ],
  ])('ticks the items of %j', (state, done) => {
    const items = gettingStartedItems(state);

    expect(items.map((item) => item.id)).toEqual([
      'configure_github_sign_in',
      'configure_email',
      'configure_backup_storage',
    ]);
    expect(items.map((item) => item.isDone)).toEqual(done);
  });
});
