import { describe, expect, it } from 'vitest';
import { gettingStartedItems } from './getting-started.js';

describe('gettingStartedItems', () => {
  it.each([
    [{ isGithubSignInConfigured: false, isSmtpConfigured: false }, [false, false]],
    [{ isGithubSignInConfigured: true, isSmtpConfigured: false }, [true, false]],
    [{ isGithubSignInConfigured: false, isSmtpConfigured: true }, [false, true]],
  ])('ticks the items of %j', (state, done) => {
    const items = gettingStartedItems(state);

    expect(items.map((item) => item.id)).toEqual(['configure_github_sign_in', 'configure_email']);
    expect(items.map((item) => item.isDone)).toEqual(done);
  });
});
