-- CreateEnum
CREATE TYPE "ticket_type" AS ENUM ('bug', 'feature', 'task', 'question');

-- CreateEnum
CREATE TYPE "ticket_source" AS ENUM ('user', 'developer', 'integration');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('new', 'triage', 'todo', 'in_progress', 'in_verification', 'waiting_for_requester', 'done', 'rejected', 'duplicate');

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "ticket_type",
    "source" "ticket_source" NOT NULL,
    "priority" "ticket_priority" NOT NULL DEFAULT 'normal',
    "status" "ticket_status" NOT NULL,
    "organization_id" UUID,
    "requester_id" UUID NOT NULL,
    "assignee_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_number_counters" (
    "project_id" UUID NOT NULL,
    "last_number" INTEGER NOT NULL,

    CONSTRAINT "ticket_number_counters_pkey" PRIMARY KEY ("project_id")
);

-- CreateIndex
CREATE INDEX "tickets_assignee_id_idx" ON "tickets"("assignee_id");

-- CreateIndex
CREATE INDEX "tickets_requester_id_idx" ON "tickets"("requester_id");

-- CreateIndex
CREATE INDEX "tickets_organization_id_idx" ON "tickets"("organization_id");

-- CreateIndex
CREATE INDEX "tickets_created_at_id_idx" ON "tickets"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_project_id_number_key" ON "tickets"("project_id", "number");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_number_counters" ADD CONSTRAINT "ticket_number_counters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ticket numbers start at 1 (§17.2): they come from the counter, which starts at 1.
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_number_positive" CHECK ("number" >= 1);
ALTER TABLE "ticket_number_counters" ADD CONSTRAINT "ticket_number_counters_last_number_positive" CHECK ("last_number" >= 1);
