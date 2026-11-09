-- CreateEnum
CREATE TYPE "comment_kind" AS ENUM ('public', 'internal');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "comment_id" UUID;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "description_edited_at" TIMESTAMPTZ(3),
ADD COLUMN     "description_edited_by_id" UUID;

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "kind" "comment_kind" NOT NULL,
    "audience" "ticket_visibility",
    "audience_organization_id" UUID,
    "body" TEXT NOT NULL,
    "edited_at" TIMESTAMPTZ(3),
    "edited_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_mentions" (
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "comment_id" UUID,
    "body" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "written_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_ticket_id_id_idx" ON "comments"("ticket_id", "id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "comments_audience_organization_id_idx" ON "comments"("audience_organization_id");

-- CreateIndex
CREATE INDEX "comment_mentions_user_id_idx" ON "comment_mentions"("user_id");

-- CreateIndex
CREATE INDEX "content_revisions_ticket_id_id_idx" ON "content_revisions"("ticket_id", "id");

-- CreateIndex
CREATE INDEX "content_revisions_comment_id_id_idx" ON "content_revisions"("comment_id", "id");

-- CreateIndex
CREATE INDEX "content_revisions_author_id_idx" ON "content_revisions"("author_id");

-- CreateIndex
CREATE INDEX "attachments_comment_id_created_at_id_idx" ON "attachments"("comment_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_description_edited_by_id_fkey" FOREIGN KEY ("description_edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_audience_organization_id_fkey" FOREIGN KEY ("audience_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A public comment keeps its audience, an internal note has none; the organization is set exactly
-- for `my_organization` (§5.2, S1-12).
ALTER TABLE "comments" ADD CONSTRAINT "comments_audience_kind" CHECK (("kind" = 'public') = ("audience" IS NOT NULL));
ALTER TABLE "comments" ADD CONSTRAINT "comments_audience_organization" CHECK (("audience" IS NOT DISTINCT FROM 'my_organization') = ("audience_organization_id" IS NOT NULL));
ALTER TABLE "comments" ADD CONSTRAINT "comments_body_length" CHECK (char_length("body") BETWEEN 1 AND 65536);
ALTER TABLE "comments" ADD CONSTRAINT "comments_edited_fields" CHECK (("edited_at" IS NULL) = ("edited_by_id" IS NULL));

-- The last edit of a description keeps its time and its editor together (§6.1).
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_description_edited_fields" CHECK (("description_edited_at" IS NULL) = ("description_edited_by_id" IS NULL));

-- A revision belongs to exactly one text: a description or a comment (S1-12).
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_one_parent" CHECK (num_nonnulls("ticket_id", "comment_id") = 1);

-- An attachment has one parent, a ticket or a comment (S1-12 Q16).
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_parent" CHECK (num_nonnulls("ticket_id", "comment_id") <= 1);

-- A draft is linked to neither a ticket nor a comment; the purge finds the drafts by their age.
DROP INDEX "attachments_draft_created_at_idx";
CREATE INDEX "attachments_draft_created_at_idx" ON "attachments"("created_at") WHERE "ticket_id" IS NULL AND "comment_id" IS NULL;
