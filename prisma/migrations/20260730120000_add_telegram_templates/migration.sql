-- CreateTable
CREATE TABLE "telegram_templates" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "telegram_templates_pkey" PRIMARY KEY ("key")
);
