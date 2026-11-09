-- S1-12 Q13: the reasons now live in comments (copied by the previous migration).
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_rejection_reason_rejected";

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "rejection_reason";
