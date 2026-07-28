-- CreateTable
CREATE TABLE "user_calculator_settings" (
    "userId" TEXT NOT NULL,
    "presets" JSONB NOT NULL DEFAULT '[]',
    "exportLogoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_calculator_settings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_calculator_settings" ADD CONSTRAINT "user_calculator_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
