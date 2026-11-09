-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('quarantine', 'available', 'infected', 'rejected');

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "attachment_status" NOT NULL DEFAULT 'quarantine',
    "uploaded_by_id" UUID NOT NULL,
    "ticket_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_ticket_id_created_at_id_idx" ON "attachments"("ticket_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The file name keeps 1–255 characters after its normalization, and a size is never negative (§13.3).
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_file_name_length" CHECK (char_length("file_name") BETWEEN 1 AND 255);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_size_not_negative" CHECK ("size" >= 0);

-- The purge of drafts finds the attachments linked to no ticket by their age (ADR 0008).
CREATE INDEX "attachments_draft_created_at_idx" ON "attachments"("created_at") WHERE "ticket_id" IS NULL;

-- The recovery of lost scans finds the attachments still in quarantine by their last update (Q10).
CREATE INDEX "attachments_quarantine_updated_at_idx" ON "attachments"("updated_at") WHERE "status" = 'quarantine';
