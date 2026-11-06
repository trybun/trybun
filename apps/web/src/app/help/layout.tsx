import type { ReactNode } from 'react';
import { AccountShell } from '../../features/app-shell/components/account-shell.js';

/**
 * The help pages (§2.3), outside the route groups: the same addresses for every reader, in the
 * shell of the reader's account kind – the portal for end users, the team's views for the team
 * (§18.5, change specification of S1-09, Q2).
 */
export default function HelpLayout({ children }: { children: ReactNode }) {
  return <AccountShell shell="reader">{children}</AccountShell>;
}
