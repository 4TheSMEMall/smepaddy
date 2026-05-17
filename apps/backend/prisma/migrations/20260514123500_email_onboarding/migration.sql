-- Add an email-first onboarding state while keeping existing phone users valid.
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'AUTH_PENDING';

ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'AUTH_PENDING';

WITH ranked_users AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY LOWER("email")
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "User"
  WHERE "email" IS NOT NULL
)
UPDATE "User"
SET "email" = NULL
WHERE "id" IN (
  SELECT "id"
  FROM ranked_users
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
