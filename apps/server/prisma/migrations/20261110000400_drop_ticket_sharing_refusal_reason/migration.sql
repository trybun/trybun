-- S1-12 Q14: the refusal reasons now live in comments (copied by the previous migration).
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_sharing_refusal_reason_rejected";

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "sharing_refusal_reason";
