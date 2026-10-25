-- AlterTable: the idle timeout of the account kind (§14.4). Sessions that exist already get the
-- shortest one, of the team.
ALTER TABLE "sessions"
    ADD COLUMN "idle_timeout_seconds" INTEGER NOT NULL DEFAULT 1800,
    ADD COLUMN "idle_expires_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 minutes';

ALTER TABLE "sessions"
    ALTER COLUMN "idle_timeout_seconds" DROP DEFAULT,
    ALTER COLUMN "idle_expires_at" DROP DEFAULT;
