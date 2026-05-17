-- Store FCM device tokens per business profile for push notifications.

CREATE TABLE "DeviceToken" (
    "id"                TEXT    NOT NULL,
    "businessProfileId" TEXT    NOT NULL,
    "token"             TEXT    NOT NULL,
    "platform"          TEXT    NOT NULL DEFAULT 'web',
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_businessProfileId_isActive_idx" ON "DeviceToken"("businessProfileId", "isActive");

ALTER TABLE "DeviceToken"
    ADD CONSTRAINT "DeviceToken_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
