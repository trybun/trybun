import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.pl) }));

const { default: TicketsLayout } = await import('./layout.js');

type Layout = ReactElement<{ messages: Record<string, unknown>; children: ReactElement[] }>;

describe('TicketsLayout', () => {
  it('mounts the toast region of the ticket views after the page', async () => {
    const element = (await TicketsLayout({ children: <h1>ERP-12</h1> })) as Layout;

    expect(element.props.children[1]).toMatchObject({ type: LazyToaster });
  });

  it('passes the texts of the ticket views to the browser', async () => {
    const element = (await TicketsLayout({ children: <h1>ERP-12</h1> })) as Layout;

    expect(element.props.messages).toMatchObject({
      tickets: CATALOGUES.pl.tickets,
      attachments: CATALOGUES.pl.attachments,
      errors: CATALOGUES.pl.errors,
      appShell: CATALOGUES.pl.appShell,
    });
    expect(Object.keys(element.props.messages)).not.toContain('projects');
  });
});
