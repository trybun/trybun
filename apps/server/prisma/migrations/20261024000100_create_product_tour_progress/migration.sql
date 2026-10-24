-- CreateEnum
CREATE TYPE "product_tour_status" AS ENUM ('completed', 'skipped');

-- CreateTable
CREATE TABLE "product_tour_progresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tour_id" TEXT NOT NULL,
    "tour_version" INTEGER NOT NULL,
    "status" "product_tour_status" NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_tour_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_tour_progresses_user_id_tour_id_key" ON "product_tour_progresses"("user_id", "tour_id");

-- AddForeignKey
ALTER TABLE "product_tour_progresses" ADD CONSTRAINT "product_tour_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
