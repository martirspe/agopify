-- CreateTable
CREATE TABLE "ConsoleAssistantPreference" (
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsoleAssistantPreference_pkey" PRIMARY KEY ("userId","tenantId")
);

-- CreateTable
CREATE TABLE "ConsoleAssistantConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsoleAssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsoleAssistantPreference_tenantId_idx" ON "ConsoleAssistantPreference"("tenantId");

-- CreateIndex
CREATE INDEX "ConsoleAssistantConversation_userId_tenantId_updatedAt_idx" ON "ConsoleAssistantConversation"("userId", "tenantId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ConsoleAssistantConversation_tenantId_idx" ON "ConsoleAssistantConversation"("tenantId");

-- AddForeignKey
ALTER TABLE "ConsoleAssistantPreference" ADD CONSTRAINT "ConsoleAssistantPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleAssistantPreference" ADD CONSTRAINT "ConsoleAssistantPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleAssistantConversation" ADD CONSTRAINT "ConsoleAssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleAssistantConversation" ADD CONSTRAINT "ConsoleAssistantConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
