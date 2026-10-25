-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entries_created_at_idx" ON "audit_log_entries"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_entries_target_type_target_id_idx" ON "audit_log_entries"("target_type", "target_id");

-- The audit log is immutable (§13.5): entries are only ever inserted.
CREATE FUNCTION "audit_log_entries_refuse_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'The audit log is immutable: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER "audit_log_entries_immutable_rows"
    BEFORE UPDATE OR DELETE ON "audit_log_entries"
    FOR EACH ROW EXECUTE FUNCTION "audit_log_entries_refuse_change"();

CREATE TRIGGER "audit_log_entries_immutable_table"
    BEFORE TRUNCATE ON "audit_log_entries"
    FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_entries_refuse_change"();
