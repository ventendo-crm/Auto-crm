-- CreateTable
CREATE TABLE "fcm_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fcm_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fcm_devices_token_key" ON "fcm_devices"("token");

-- CreateIndex
CREATE INDEX "fcm_devices_userId_idx" ON "fcm_devices"("userId");

-- AddForeignKey
ALTER TABLE "fcm_devices" ADD CONSTRAINT "fcm_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
