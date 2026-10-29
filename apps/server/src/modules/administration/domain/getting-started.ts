import type { GettingStartedItem } from '@trybun/contracts/administration';

/** What the getting-started checklist reads (§15.6); later tasks add their records and settings. */
export interface GettingStartedState {
  /** Any project exists, active or archived (§3.1). */
  hasProject: boolean;
  /** Any organization exists, active or archived (§7.3). */
  hasOrganization: boolean;
  isGithubSignInConfigured: boolean;
  isSmtpConfigured: boolean;
  isBackupStorageConfigured: boolean;
}

/**
 * The getting-started checklist of the Administrator panel (§15.6), in its order. An item is done
 * exactly when its setting exists, so it is never ticked while the setting is missing.
 */
export function gettingStartedItems(state: GettingStartedState): GettingStartedItem[] {
  return [
    { id: 'create_project', isDone: state.hasProject, isOptional: false },
    // Required before team members can be invited (§15.5).
    { id: 'configure_github_sign_in', isDone: state.isGithubSignInConfigured, isOptional: false },
    // Organizations are optional; the system works without them (§7.3).
    { id: 'create_organization', isDone: state.hasOrganization, isOptional: true },
    { id: 'configure_email', isDone: state.isSmtpConfigured, isOptional: false },
    // Without it the backups stay on the server (§15.2).
    {
      id: 'configure_backup_storage',
      isDone: state.isBackupStorageConfigured,
      isOptional: false,
    },
  ];
}
