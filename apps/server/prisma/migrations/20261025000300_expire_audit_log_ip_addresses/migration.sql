-- The IP address of an audit log entry is removed after 14 days (§13.2, §13.5). The row trigger
-- allows exactly this change – the IP set to NULL, every other column unchanged – and still
-- refuses every other update and every delete. TRUNCATE stays refused by its own trigger.
CREATE FUNCTION "audit_log_entries_refuse_change_except_ip_expiry"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE'
        AND OLD.ip_address IS NOT NULL
        AND NEW.ip_address IS NULL
        AND to_jsonb(NEW) - 'ip_address' = to_jsonb(OLD) - 'ip_address'
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The audit log is immutable: % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER "audit_log_entries_immutable_rows" ON "audit_log_entries";

CREATE TRIGGER "audit_log_entries_immutable_rows"
    BEFORE UPDATE OR DELETE ON "audit_log_entries"
    FOR EACH ROW EXECUTE FUNCTION "audit_log_entries_refuse_change_except_ip_expiry"();
