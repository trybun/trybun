-- CreateEnum
CREATE TYPE "invitation_target" AS ENUM ('project', 'organization', 'administrator');

-- AlterEnum
ALTER TYPE "project_role" ADD VALUE 'end_user';

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target" "invitation_target" NOT NULL,
    "project_id" UUID,
    "role" "project_role",
    "organization_id" UUID,
    "invited_by_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_user_id_idx" ON "invitations"("user_id");

-- CreateIndex
CREATE INDEX "invitations_project_id_idx" ON "invitations"("project_id");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- CreateIndex
CREATE INDEX "invitations_created_at_id_idx" ON "invitations"("created_at", "id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A `project` invitation has its project and role, an `organization` invitation its organization
-- and no project, an `administrator` invitation neither; only a `project` invitation with role
-- `end_user` may name the organization matched by the e-mail domain (§7.3, §7.4).
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_target_check" CHECK (
  CASE "target"
    WHEN 'project' THEN "project_id" IS NOT NULL AND "role" IS NOT NULL
      AND ("organization_id" IS NULL OR "role"::text = 'end_user')
    WHEN 'organization' THEN "organization_id" IS NOT NULL AND "project_id" IS NULL AND "role" IS NULL
    WHEN 'administrator' THEN "project_id" IS NULL AND "role" IS NULL AND "organization_id" IS NULL
  END
);

-- E-mail addresses are stored normalized – trimmed and lower-cased (§7.4) – so the unique index
-- compares them case-insensitively and a lookup by address is an exact, indexed match.
UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized_check" CHECK ("email" = lower(btrim("email")));
