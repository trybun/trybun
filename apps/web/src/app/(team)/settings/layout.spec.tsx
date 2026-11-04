import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.en) }));

const { default: SettingsLayout } = await import('./layout.js');

type Layout = ReactElement<{ messages: Record<string, unknown>; children: ReactElement[] }>;

describe('SettingsLayout', () => {
  it('passes the texts of the settings to the browser and mounts the toasts', async () => {
    const element = (await SettingsLayout({ children: <h1>Account settings</h1> })) as Layout;

    expect(element.props.children[1]).toMatchObject({ type: LazyToaster });
    expect(element.props.messages).toMatchObject({
      users: CATALOGUES.en.users,
      languages: CATALOGUES.en.languages,
      errors: CATALOGUES.en.errors,
    });
    expect(Object.keys(element.props.messages)).not.toContain('administration');
  });
});
