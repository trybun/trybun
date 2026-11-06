import type { ReactNode } from 'react';
import { AccountShell } from '../../features/app-shell/components/account-shell.js';

/**
 * The views of the team inside the application shell (§2.9). An end user who opens one goes to its
 * portal counterpart (§5.7).
 */
export default function TeamLayout({ children }: { children: ReactNode }) {
  return <AccountShell shell="team">{children}</AccountShell>;
}
