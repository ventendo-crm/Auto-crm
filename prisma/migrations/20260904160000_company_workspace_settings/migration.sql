-- AlterTable
ALTER TABLE "deals" ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "type" SET DATA TYPE TEXT USING "type"::text;

-- CreateTable
CREATE TABLE "company_workspace_settings" (
    "companyId" TEXT NOT NULL,
    "stageLabels" JSONB NOT NULL DEFAULT '{}',
    "clientVisibleStages" JSONB NOT NULL DEFAULT '[]',
    "dealTabs" JSONB NOT NULL DEFAULT '{}',
    "dealFields" JSONB NOT NULL DEFAULT '{}',
    "customDealFields" JSONB NOT NULL DEFAULT '[]',
    "documentTypes" JSONB NOT NULL DEFAULT '[]',
    "additionalOptionGroups" JSONB NOT NULL DEFAULT '[]',
    "modules" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_workspace_settings_pkey" PRIMARY KEY ("companyId")
);

-- AddForeignKey
ALTER TABLE "company_workspace_settings" ADD CONSTRAINT "company_workspace_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
