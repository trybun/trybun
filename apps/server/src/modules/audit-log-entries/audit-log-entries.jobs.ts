/** Queue of the recurring work of the audit log (§17.1). */
export const AUDIT_LOG_ENTRIES_QUEUE = 'audit-log-entries';

/**
 * Recurring job removing the IP addresses of entries older than 14 days (§13.2); also its
 * scheduler ID.
 */
export const AUDIT_LOG_IP_EXPIRY_JOB = 'audit-log-entries-ip-expiry';
