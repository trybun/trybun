-- Further identifiers and non-personal values of an audit log entry, typed per action (§13.5).
-- The row trigger of 20261025000300 compares every column except the IP address, so `details`
-- stays immutable without a change of the trigger.
ALTER TABLE "audit_log_entries" ADD COLUMN "details" JSONB;
