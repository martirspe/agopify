-- Idempotent guards for DBs that missed additive migrations before a squash baseline.
-- Safe to re-run. Does not drop or rewrite existing data.

-- SalesAgent.aiRuntimeMode (AI Core default path)
ALTER TABLE "SalesAgent" ADD COLUMN IF NOT EXISTS "aiRuntimeMode" TEXT NOT NULL DEFAULT 'ai_core';

-- Knowledge FAQ topics + TEMPLATE source
DO $$ BEGIN
  CREATE TYPE "KnowledgeTopic" AS ENUM ('GENERAL', 'SHIPPING', 'RETURNS', 'PAYMENTS', 'HOURS', 'ABOUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "KnowledgeSource" ADD VALUE IF NOT EXISTS 'TEMPLATE';

ALTER TABLE "KnowledgeFaq" ADD COLUMN IF NOT EXISTS "topic" "KnowledgeTopic" NOT NULL DEFAULT 'GENERAL';

CREATE INDEX IF NOT EXISTS "KnowledgeFaq_tenantId_topic_idx" ON "KnowledgeFaq"("tenantId", "topic");
