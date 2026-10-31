-- AlterTable
ALTER TABLE "SalesAgent" ADD COLUMN IF NOT EXISTS "aiRuntimeMode" TEXT NOT NULL DEFAULT 'ai_core';
