-- CreateEnum
CREATE TYPE "organization_state" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "state" "organization_state" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_domains" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_projects" (
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_projects_pkey" PRIMARY KEY ("organization_id","project_id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "organizations_name_id_idx" ON "organizations"("name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_domains_domain_key" ON "organization_domains"("domain");

-- CreateIndex
CREATE INDEX "organization_domains_organization_id_idx" ON "organization_domains"("organization_id");

-- CreateIndex
CREATE INDEX "organization_projects_project_id_idx" ON "organization_projects"("project_id");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_projects" ADD CONSTRAINT "organization_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_projects" ADD CONSTRAINT "organization_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Names are unique case-insensitively across active and archived organizations (§7.3); Prisma does
-- not model an index on an expression.
CREATE UNIQUE INDEX "organizations_name_lower_key" ON "organizations"(lower("name"));
