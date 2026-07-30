-- CreateTable
CREATE TABLE "client_stage_messages" (
    "stage" "DealStageType" NOT NULL,
    "textBody" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "client_stage_messages_pkey" PRIMARY KEY ("stage")
);
