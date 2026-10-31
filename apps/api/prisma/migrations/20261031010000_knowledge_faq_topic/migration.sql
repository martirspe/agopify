-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "KnowledgeTopic" AS ENUM ('GENERAL', 'SHIPPING', 'RETURNS', 'PAYMENTS', 'HOURS', 'ABOUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "KnowledgeSource" ADD VALUE IF NOT EXISTS 'TEMPLATE';

-- AlterTable
ALTER TABLE "KnowledgeFaq" ADD COLUMN IF NOT EXISTS "topic" "KnowledgeTopic" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KnowledgeFaq_tenantId_topic_idx" ON "KnowledgeFaq"("tenantId", "topic");
