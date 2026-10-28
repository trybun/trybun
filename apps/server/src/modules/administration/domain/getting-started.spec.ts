import { describe, expect, it } from 'vitest';
import { gettingStartedItems } from './getting-started.js';

describe('gettingStartedItems', () => {
  it.each([
    [
      {
        hasProject: false,
        hasOrganization: false,
        isGithubSignInConfigured: false,
        isSmtpConfigured: false,
        isBackupStorageConfigured: false,
      },
      [false, false, false, false, false],
    ],
    [
      {
        hasProject: true,
        hasOrganization: true,
        isGithubSignInConfigured: true,
        isSmtpConfigured: false,
        isBackupStorageConfigured: false,
      },
      [true, true, true, false, false],
    ],
    [
      {
        hasProject: false,
        hasOrganization: false,
        isGithubSignInConfigured: false,
        isSmtpConfigured: true,
        isBackupStorageConfigured: false,
      },
      [false, false, false, true, false],
    ],
    [
      {
        hasProject: false,
        hasOrganization: false,
        isGithubSignInConfigured: false,
        isSmtpConfigured: false,
        isBackupStorageConfigured: true,
      },
      [false, false, false, false, true],
    ],
  ])('ticks the items of %j', (state, done) => {
    const items = gettingStartedItems(state);

    expect(items.map((item) => item.id)).toEqual([
      'create_project',
      'configure_github_sign_in',
      'create_organization',
      'configure_email',
      'configure_backup_storage',
    ]);
    expect(items.map((item) => item.isDone)).toEqual(done);
  });
});
