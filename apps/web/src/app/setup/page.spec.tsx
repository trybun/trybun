import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

const { default: SetupPage } = await import('./page.js');
const { PublicHeader } = await import('../../features/app-shell/components/public-header.js');

describe('SetupPage', () => {
  it('shows the Trybun header above the wizard, like the other public pages', async () => {
    const page = await SetupPage();
    const [header, main] = (page.props as { children: ReactElement[] }).children;

    expect(header?.type).toBe(PublicHeader);
    expect(main?.type).toBe('main');
  });
});
