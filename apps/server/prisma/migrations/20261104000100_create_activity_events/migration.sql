-- CreateEnum
CREATE TYPE "activity_event_source" AS ENUM ('system');

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "actor_id" UUID,
    "automatic_source" "activity_event_source",
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_events_ticket_id_id_idx" ON "activity_events"("ticket_id", "id");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The activity history is immutable (§4.5): events are only ever inserted. The one delete that
-- passes is the one cascaded from the deletion of its ticket by undoing an import (§12.5, §17.2):
-- the cascade runs after the ticket row is gone, while every other delete finds the ticket.
CREATE FUNCTION "activity_events_refuse_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF NOT EXISTS (SELECT 1 FROM "tickets" WHERE "id" = OLD."ticket_id") THEN
            RETURN OLD;
        END IF;
    END IF;
    RAISE EXCEPTION 'The activity history is immutable: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER "activity_events_immutable_rows"
    BEFORE UPDATE OR DELETE ON "activity_events"
    FOR EACH ROW EXECUTE FUNCTION "activity_events_refuse_change"();

CREATE TRIGGER "activity_events_immutable_table"
    BEFORE TRUNCATE ON "activity_events"
    FOR EACH STATEMENT EXECUTE FUNCTION "activity_events_refuse_change"();
