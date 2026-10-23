-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "keycloak_user_id" TEXT NOT NULL,
    "keycloak_session_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_keycloak_user_id_idx" ON "sessions"("keycloak_user_id");

-- CreateIndex
CREATE INDEX "sessions_keycloak_session_id_idx" ON "sessions"("keycloak_session_id");

