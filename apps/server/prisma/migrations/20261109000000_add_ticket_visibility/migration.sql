-- CreateEnum
CREATE TYPE "ticket_visibility" AS ENUM ('only_me', 'my_organization', 'all_customers');

-- CreateEnum
CREATE TYPE "ticket_sharing_request" AS ENUM ('none', 'pending', 'rejected');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "sharing_refusal_reason" TEXT,
ADD COLUMN     "sharing_request" "ticket_sharing_request" NOT NULL DEFAULT 'none',
ADD COLUMN     "visibility" "ticket_visibility" NOT NULL DEFAULT 'only_me';

-- CreateIndex
CREATE INDEX "tickets_project_id_visibility_idx" ON "tickets"("project_id", "visibility");


-- Existing tickets get `only_me` and `none`, the meaning they already have (S1-05 Q2), so the
-- constraints below hold for every row.

-- `my_organization` needs the organization snapshot it names (§5.1).
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_visibility_organization" CHECK (
  "visibility" <> 'my_organization' OR "organization_id" IS NOT NULL
);

-- An approval clears the request: a shared ticket has no request (§5.2).
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sharing_request_not_shared" CHECK (
  "sharing_request" = 'none' OR "visibility" <> 'all_customers'
);

-- Tickets of the team and of integrations are visible to the team only (§5.4, S1-11 Q6).
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_visibility_user_source" CHECK (
  "source" = 'user' OR ("visibility" = 'only_me' AND "sharing_request" = 'none')
);

-- The refusal reason is set exactly while the request is `rejected` (S1-11 Q8).
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sharing_refusal_reason_rejected" CHECK (
  ("sharing_request" = 'rejected') = ("sharing_refusal_reason" IS NOT NULL)
);

-- The pending requests of a project, for the "Pending sharing approvals" view (S1-13).
CREATE INDEX "tickets_project_id_pending_sharing_idx" ON "tickets"("project_id") WHERE "sharing_request" = 'pending';
