-- CreateEnum
CREATE TYPE "ticket_waiting_reason" AS ENUM ('information', 'confirmation');

-- CreateEnum
CREATE TYPE "ticket_relation_kind" AS ENUM ('duplicate_of');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "closed_at" TIMESTAMPTZ(3),
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "status_before_waiting" "ticket_status",
ADD COLUMN     "waiting_reason" "ticket_waiting_reason",
ADD COLUMN     "waiting_since" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ticket_relations" (
    "id" UUID NOT NULL,
    "kind" "ticket_relation_kind" NOT NULL,
    "source_ticket_id" UUID NOT NULL,
    "target_ticket_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_relations_source_ticket_id_idx" ON "ticket_relations"("source_ticket_id");

-- CreateIndex
CREATE INDEX "ticket_relations_target_ticket_id_idx" ON "ticket_relations"("target_ticket_id");

-- AddForeignKey
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_source_ticket_id_fkey" FOREIGN KEY ("source_ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_target_ticket_id_fkey" FOREIGN KEY ("target_ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- S1-05 creates tickets only in their initial status (§4.3), so no existing ticket is terminal,
-- waiting or rejected, and the constraints below hold for every row.

-- A waiting ticket always has its reason, the status before waiting and the start of the wait,
-- and no other ticket has them (§4.3).
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_waiting_fields" CHECK (
  ("status" = 'waiting_for_requester') = ("waiting_reason" IS NOT NULL)
  AND ("waiting_reason" IS NULL) = ("status_before_waiting" IS NULL)
  AND ("waiting_reason" IS NULL) = ("waiting_since" IS NULL)
);

-- The closing time is set exactly while the status is terminal.
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closed_at_terminal" CHECK (
  ("status" IN ('done', 'rejected', 'duplicate')) = ("closed_at" IS NOT NULL)
);

-- The rejection reason is set exactly while the status is `rejected`.
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_rejection_reason_rejected" CHECK (
  ("status" = 'rejected') = ("rejection_reason" IS NOT NULL)
);

-- One `duplicate_of` per duplicate (§3.5); a ticket never relates to itself.
CREATE UNIQUE INDEX "ticket_relations_duplicate_of_source_key" ON "ticket_relations"("source_ticket_id") WHERE "kind" = 'duplicate_of';
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_not_self" CHECK ("source_ticket_id" <> "target_ticket_id");
