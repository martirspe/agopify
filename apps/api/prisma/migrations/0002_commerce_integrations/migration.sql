-- CreateEnum
CREATE TYPE "CommercePlatform" AS ENUM ('MAGENTO', 'WOOCOMMERCE', 'SHOPIFY', 'PRESTASHOP');

-- CreateEnum
CREATE TYPE "CommerceIntegrationStatus" AS ENUM ('AVAILABLE', 'CONNECTING', 'CONNECTED', 'SYNCING', 'ERROR', 'REAUTH_REQUIRED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "CommerceAuthType" AS ENUM ('OAUTH2', 'OAUTH1A', 'API_TOKEN', 'API_KEY', 'BASIC');

-- CreateEnum
CREATE TYPE "CommerceSyncType" AS ENUM ('INITIAL', 'INCREMENTAL', 'EVENT', 'RECONCILIATION', 'INVENTORY');

-- CreateEnum
CREATE TYPE "CommerceSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommerceResourceType" AS ENUM ('PRODUCT', 'VARIANT', 'CATEGORY', 'MEDIA', 'INVENTORY');

-- CreateEnum
CREATE TYPE "CommerceWebhookStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "CommerceIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" "CommercePlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "status" "CommerceIntegrationStatus" NOT NULL DEFAULT 'CONNECTING',
    "authenticationType" "CommerceAuthType" NOT NULL,
    "encryptedCredentials" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "syncSettings" JSONB NOT NULL DEFAULT '{}',
    "externalStoreId" TEXT,
    "externalStoreName" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceIntegrationResource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "resourceType" "CommerceResourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "internalId" TEXT,
    "externalUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceIntegrationResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSyncExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "syncType" "CommerceSyncType" NOT NULL,
    "status" "CommerceSyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "createdItems" INTEGER NOT NULL DEFAULT 0,
    "updatedItems" INTEGER NOT NULL DEFAULT 0,
    "unchangedItems" INTEGER NOT NULL DEFAULT 0,
    "skippedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceSyncExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSyncExecutionItem" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "resourceType" "CommerceResourceType" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceSyncExecutionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceWebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processingStatus" "CommerceWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "CommerceWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommerceIntegration_tenantId_platform_idx" ON "CommerceIntegration"("tenantId", "platform");

-- CreateIndex
CREATE INDEX "CommerceIntegration_tenantId_status_idx" ON "CommerceIntegration"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceIntegration_tenantId_platform_name_key" ON "CommerceIntegration"("tenantId", "platform", "name");

-- CreateIndex
CREATE INDEX "CommerceIntegrationResource_tenantId_integrationId_idx" ON "CommerceIntegrationResource"("tenantId", "integrationId");

-- CreateIndex
CREATE INDEX "CommerceIntegrationResource_tenantId_internalId_idx" ON "CommerceIntegrationResource"("tenantId", "internalId");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceIntegrationResource_integrationId_resourceType_externalId_key" ON "CommerceIntegrationResource"("integrationId", "resourceType", "externalId");

-- CreateIndex
CREATE INDEX "CommerceSyncExecution_tenantId_integrationId_createdAt_idx" ON "CommerceSyncExecution"("tenantId", "integrationId", "createdAt");

-- CreateIndex
CREATE INDEX "CommerceSyncExecution_tenantId_status_idx" ON "CommerceSyncExecution"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CommerceSyncExecutionItem_executionId_status_idx" ON "CommerceSyncExecutionItem"("executionId", "status");

-- CreateIndex
CREATE INDEX "CommerceWebhookEvent_tenantId_processingStatus_receivedAt_idx" ON "CommerceWebhookEvent"("tenantId", "processingStatus", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceWebhookEvent_integrationId_externalEventId_key" ON "CommerceWebhookEvent"("integrationId", "externalEventId");

-- AddForeignKey
ALTER TABLE "CommerceIntegration" ADD CONSTRAINT "CommerceIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceIntegrationResource" ADD CONSTRAINT "CommerceIntegrationResource_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CommerceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSyncExecution" ADD CONSTRAINT "CommerceSyncExecution_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CommerceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSyncExecutionItem" ADD CONSTRAINT "CommerceSyncExecutionItem_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "CommerceSyncExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceWebhookEvent" ADD CONSTRAINT "CommerceWebhookEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CommerceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
