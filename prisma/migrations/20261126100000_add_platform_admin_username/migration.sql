ALTER TABLE "PlatformAdmin"
ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "PlatformAdmin_username_key"
ON "PlatformAdmin"("username");