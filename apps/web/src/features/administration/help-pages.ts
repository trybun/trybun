import type { GettingStartedItemId } from '@trybun/contracts/administration';

/**
 * The help page that explains each item of the getting-started checklist (§15.6): the settings
 * live in `.env`, which the browser cannot change.
 */
export const GETTING_STARTED_HELP: Record<GettingStartedItemId, string> = {
  create_project: 'administrator/how-to/create-archive-and-delete-a-project',
  configure_github_sign_in: 'administrator/how-to/configure-github-sign-in',
  configure_email: 'administrator/how-to/configure-email',
  configure_backup_storage: 'administrator/how-to/configure-backup-storage',
};
