import type { ReactNode } from 'react';
import { AccountShell } from '../../features/app-shell/components/account-shell.js';

/**
 * The end-user portal inside the application shell (§5.7, §18.5). A team member who opens one of
 * its routes goes to the team counterpart.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <AccountShell shell="portal">{children}</AccountShell>;
}
