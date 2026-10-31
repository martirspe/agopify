-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('START', 'GROW', 'SCALE', 'LEAD', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPERADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'TIKTOK_LIVE');

-- CreateEnum
CREATE TYPE "ChannelConnectionMode" AS ENUM ('COEXISTENCE', 'NEW_WABA_NUMBER');

-- CreateEnum
CREATE TYPE "ChannelHealthStatus" AS ENUM ('CONNECTED', 'DEGRADED', 'DISCONNECTED', 'PENDING');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageAuthorType" AS ENUM ('BUYER', 'SALES_AGENT', 'HUMAN_OPERATOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'FULFILLING', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentFlow" AS ENUM ('BILLING_SUBSCRIPTION', 'COMMERCE_CHECKOUT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeReviewStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "KnowledgeSource" AS ENUM ('MANUAL', 'PASTE_IMPORT', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "KnowledgeTopic" AS ENUM ('GENERAL', 'SHIPPING', 'RETURNS', 'PAYMENTS', 'HOURS', 'ABOUT');

-- CreateEnum
CREATE TYPE "StorefrontStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('BUSINESS', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PRODUCT', 'SERVICE', 'DIGITAL');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WEB', 'WHATSAPP', 'INSTAGRAM', 'MANUAL', 'TIKTOK_LIVE');

-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING', 'BUY_X_GET_Y');

-- CreateEnum
CREATE TYPE "CouponMethod" AS ENUM ('CODE', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'CATEGORY', 'BRAND', 'LINE', 'PRODUCTS');

-- CreateEnum
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('HELD', 'CONFIRMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "JourneyStage" AS ENUM ('DISCOVER', 'RECOMMEND', 'CLOSE', 'SUPPORT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "platformRole" "PlatformRole",
    "termsVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'PE',
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "planTier" "PlanTier" NOT NULL DEFAULT 'GROW',
    "planTrial" BOOLEAN NOT NULL DEFAULT true,
    "planExpiresAt" TIMESTAMP(3) DEFAULT (now() + '14 days'::interval),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionSettings" (
    "tenantId" TEXT NOT NULL,
    "recoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappTemplate" TEXT,
    "whatsappLanguage" TEXT NOT NULL DEFAULT 'es_PE',
    "delaysMinutes" INTEGER[] DEFAULT ARRAY[15, 120, 1440]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "RecoveryCart" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emailConsentAt" TIMESTAMP(3),
    "whatsappConsentAt" TIMESTAMP(3),
    "consentVersion" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "RecoveryDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBehaviorEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreBehaviorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chats" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageMonth" (
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "editorTexts" INTEGER NOT NULL DEFAULT 0,
    "editorImages" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageMonth_pkey" PRIMARY KEY ("tenantId","periodStart")
);

-- CreateTable
CREATE TABLE "TenantIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'AGENT',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSlugRedirect" (
    "slug" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSlugRedirect_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "MerchantPaymentAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercadopago',
    "accessTokenEnc" TEXT NOT NULL,
    "webhookSecretEnc" TEXT,
    "publicKey" TEXT NOT NULL,
    "liveMode" BOOLEAN NOT NULL DEFAULT false,
    "externalUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "method" "CouponMethod" NOT NULL DEFAULT 'CODE',
    "label" TEXT NOT NULL,
    "note" TEXT,
    "kind" "CouponKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "maxDiscountCents" INTEGER,
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "maxApplications" INTEGER,
    "minSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "minItems" INTEGER NOT NULL DEFAULT 0,
    "scope" "CouponScope" NOT NULL DEFAULT 'ALL',
    "targets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applyToSets" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER,
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storefront" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "StorefrontStatus" NOT NULL DEFAULT 'DRAFT',
    "displayName" TEXT NOT NULL,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "heroImageUrl" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#0b0d12',
    "accentColor" TEXT NOT NULL DEFAULT '#5b8cff',
    "whatsappPhone" TEXT,
    "contactEmail" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerType" "SellerType" NOT NULL DEFAULT 'BUSINESS',
    "legalName" TEXT,
    "ruc" TEXT,
    "legalAddress" TEXT,
    "dni" TEXT,
    "legalDistrict" TEXT,
    "complaintsBookUrl" TEXT,
    "dataBankCode" TEXT,
    "exchangeDays" INTEGER NOT NULL DEFAULT 0,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "freeShippingFromCents" INTEGER,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pickupAddress" TEXT,
    "shippingOriginUbigeo" TEXT,
    "carrierRates" JSONB,
    "industry" TEXT NOT NULL DEFAULT 'general',
    "template" TEXT NOT NULL DEFAULT 'classic',
    "themeVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "themeDraftTemplate" TEXT,
    "themeDraftVersion" TEXT,
    "templateCopy" JSONB,
    "templateContent" JSONB,
    "templateDraft" JSONB,
    "templatePublishAt" TIMESTAMP(3),
    "customDomain" TEXT,
    "customDomainStatus" TEXT,
    "customDomainProviderId" TEXT,
    "customDomainCheckedAt" TIMESTAMP(3),
    "metaPixelId" TEXT,
    "ga4MeasurementId" TEXT,

    CONSTRAINT "Storefront_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "template" TEXT,
    "themeVersion" TEXT,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "platform" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetTenantId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAgent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "companyDescription" TEXT,
    "audienceDescription" TEXT,
    "rulesText" TEXT,
    "communicationStyle" TEXT,
    "personalityPreset" TEXT,
    "salesStyle" TEXT,
    "responseLength" TEXT NOT NULL DEFAULT 'balanced',
    "useEmojis" BOOLEAN NOT NULL DEFAULT true,
    "emojiPalette" TEXT,
    "wordsToAvoid" TEXT,
    "initialMessage" TEXT,
    "purchaseConfirmMessage" TEXT,
    "handoffMessage" TEXT,
    "pauseOnHandoff" BOOLEAN NOT NULL DEFAULT true,
    "neverOfferDiscount" BOOLEAN NOT NULL DEFAULT true,
    "neverInventShipping" BOOLEAN NOT NULL DEFAULT true,
    "catalogOnlyFacts" BOOLEAN NOT NULL DEFAULT true,
    "salesTechniques" TEXT[] DEFAULT ARRAY['discovery', 'benefits', 'objections', 'alternative_close', 'cross_sell']::TEXT[],
    "objectionHandling" TEXT,
    "promptMode" TEXT NOT NULL DEFAULT 'guided',
    "customPrompt" TEXT,
    "aiRuntimeMode" TEXT NOT NULL DEFAULT 'ai_core',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeFaq" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "topic" "KnowledgeTopic" NOT NULL DEFAULT 'GENERAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "KnowledgeSource" NOT NULL DEFAULT 'MANUAL',
    "reviewStatus" "KnowledgeReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "JourneyStage" NOT NULL DEFAULT 'DISCOVER',
    "scriptText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSignupSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "accessTokenEnc" TEXT,
    "channelId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSignupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "connectionMode" "ChannelConnectionMode",
    "healthStatus" "ChannelHealthStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "displayName" TEXT,
    "metadata" JSONB,
    "lastActiveAt" TIMESTAMP(3),
    "salesAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionShort" TEXT,
    "descriptionFull" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryId" TEXT,
    "attributeValues" JSONB,
    "basePriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "kind" "ProductKind" NOT NULL DEFAULT 'PRODUCT',
    "durationMinutes" INTEGER,
    "serviceMode" TEXT,
    "digitalAccessUrl" TEXT,
    "digitalInstructions" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "stockUnlimited" BOOLEAN NOT NULL DEFAULT true,
    "stockQty" INTEGER,
    "isPublishedOnStore" BOOLEAN NOT NULL DEFAULT false,
    "compareAtPriceCents" INTEGER,
    "brand" TEXT,
    "sku" TEXT,
    "line" TEXT,
    "details" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "option1Name" TEXT,
    "option1Value" TEXT,
    "option2Name" TEXT,
    "option2Value" TEXT,
    "option3Name" TEXT,
    "option3Value" TEXT,
    "priceCents" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "stockQty" INTEGER,
    "imageUrl" TEXT,
    "options" JSONB,
    "combinationKey" TEXT,
    "priceInherited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'PRODUCT',
    "parentId" TEXT,
    "attributes" JSONB NOT NULL,

    CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "alt" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalThreadId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "agentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "markedAsSale" BOOLEAN NOT NULL DEFAULT false,
    "markedUnattended" BOOLEAN NOT NULL DEFAULT false,
    "lastInboundAt" TIMESTAMP(3),
    "salesState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "authorType" "MessageAuthorType" NOT NULL,
    "body" TEXT NOT NULL,
    "externalId" TEXT,
    "inboundKey" TEXT,
    "enginePending" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesEngineTurn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "inboundIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "response" JSONB,
    "trace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesEngineTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesCustomerMemory" (
    "tenantId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCustomerMemory_pkey" PRIMARY KEY ("tenantId","customerKey")
);

-- CreateTable
CREATE TABLE "SalesSearchJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesSearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaygroundSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Prueba del vendedor',
    "salesState" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaygroundSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaygroundMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "authorType" "MessageAuthorType" NOT NULL,
    "body" TEXT NOT NULL,
    "toolTraces" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaygroundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" "OrderChannel" NOT NULL DEFAULT 'MANUAL',
    "code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "couponCode" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerDocument" TEXT,
    "delivery" JSONB,
    "serviceNote" TEXT,
    "checkoutKey" TEXT,
    "requestHash" TEXT,
    "publicToken" TEXT,
    "stockState" TEXT NOT NULL DEFAULT 'none',
    "expiresAt" TIMESTAMP(3),
    "paymentState" TEXT,
    "paymentKey" TEXT,
    "paymentHash" TEXT,
    "paymentMethod" TEXT,
    "paymentDetail" TEXT,
    "cancelReason" TEXT,
    "trackingCode" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'pending',
    "emailClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "key" TEXT NOT NULL,
    "tenantId" TEXT,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "title" TEXT NOT NULL,
    "handle" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "allocations" JSONB,
    "fulfillment" JSONB,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "flow" "PaymentFlow" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mercadopago',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "externalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "rawPayload" JSONB,
    "planTier" "PlanTier",
    "planMonths" INTEGER,
    "chatPackSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LiveIntegration" (
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT,
    "healthStatus" "ChannelHealthStatus" NOT NULL DEFAULT 'PENDING',
    "credentialsEncrypted" TEXT,
    "accountId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "oauthStateHash" TEXT,
    "oauthExpiresAt" TIMESTAMP(3),
    "accessExpiresAt" TIMESTAMP(3),
    "refreshExpiresAt" TIMESTAMP(3),
    "responseMode" TEXT NOT NULL DEFAULT 'HUMAN_APPROVAL',
    "reservationSeconds" INTEGER NOT NULL DEFAULT 300,
    "maxReservationsPerSession" INTEGER NOT NULL DEFAULT 500,
    "lastCheckedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveIntegration_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "LiveCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'TIKTOK_LIVE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mode" TEXT NOT NULL DEFAULT 'LIVE_LIQUIDATION',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "salesAgentId" TEXT,
    "reservationSeconds" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveOffer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "livePriceCents" INTEGER NOT NULL,
    "allocatedStock" INTEGER NOT NULL,
    "claimedQty" INTEGER NOT NULL DEFAULT 0,
    "maxPerCustomer" INTEGER NOT NULL DEFAULT 2,
    "durationSeconds" INTEGER NOT NULL DEFAULT 3600,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LiveOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentOfferId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "line" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "conversationId" TEXT,
    "intent" TEXT,
    "reservationId" TEXT,
    "suggestedReply" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "RecoveryCart_tenantId_expiresAt_idx" ON "RecoveryCart"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "RecoveryCart_expiresAt_idx" ON "RecoveryCart"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCart_tenantId_sessionHash_key" ON "RecoveryCart"("tenantId", "sessionHash");

-- CreateIndex
CREATE INDEX "RecoveryDelivery_tenantId_status_dueAt_idx" ON "RecoveryDelivery"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "RecoveryDelivery_status_dueAt_idx" ON "RecoveryDelivery"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryDelivery_cartId_revision_step_channel_key" ON "RecoveryDelivery"("cartId", "revision", "step", "channel");

-- CreateIndex
CREATE INDEX "StoreBehaviorEvent_tenantId_sessionHash_createdAt_idx" ON "StoreBehaviorEvent"("tenantId", "sessionHash", "createdAt");

-- CreateIndex
CREATE INDEX "StoreBehaviorEvent_createdAt_idx" ON "StoreBehaviorEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPack_paymentId_key" ON "ChatPack"("paymentId");

-- CreateIndex
CREATE INDEX "ChatPack_tenantId_periodStart_idx" ON "ChatPack"("tenantId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "TenantIntegration_tenantId_key_key" ON "TenantIntegration"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MemberInvite_tokenHash_key" ON "MemberInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "MemberInvite_tenantId_acceptedAt_idx" ON "MemberInvite"("tenantId", "acceptedAt");

-- CreateIndex
CREATE INDEX "StoreSlugRedirect_tenantId_createdAt_idx" ON "StoreSlugRedirect"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantPaymentAccount_tenantId_provider_key" ON "MerchantPaymentAccount"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "CouponRedemption"("couponId", "status");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_customerKey_idx" ON "CouponRedemption"("couponId", "customerKey");

-- CreateIndex
CREATE UNIQUE INDEX "Storefront_tenantId_key" ON "Storefront"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Storefront_customDomain_key" ON "Storefront"("customDomain");

-- CreateIndex
CREATE INDEX "Storefront_templatePublishAt_idx" ON "Storefront"("templatePublishAt");

-- CreateIndex
CREATE INDEX "StorefrontVersion_tenantId_replacedAt_idx" ON "StorefrontVersion"("tenantId", "replacedAt");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actorUserId_createdAt_idx" ON "PlatformAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesAgent_tenantId_idx" ON "SalesAgent"("tenantId");

-- CreateIndex
CREATE INDEX "KnowledgeFaq_tenantId_isPublished_reviewStatus_idx" ON "KnowledgeFaq"("tenantId", "isPublished", "reviewStatus");

-- CreateIndex
CREATE INDEX "KnowledgeFaq_tenantId_topic_idx" ON "KnowledgeFaq"("tenantId", "topic");

-- CreateIndex
CREATE INDEX "JourneyTemplate_tenantId_isActive_idx" ON "JourneyTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSignupSession_stateHash_key" ON "WhatsAppSignupSession"("stateHash");

-- CreateIndex
CREATE INDEX "WhatsAppSignupSession_tenantId_userId_expiresAt_idx" ON "WhatsAppSignupSession"("tenantId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Channel_tenantId_type_idx" ON "Channel"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Channel_externalId_idx" ON "Channel"("externalId");

-- CreateIndex
CREATE INDEX "Channel_salesAgentId_idx" ON "Channel"("salesAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_tenantId_type_externalId_key" ON "Channel"("tenantId", "type", "externalId");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_categoryId_idx" ON "Product"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_tenantId_isPublishedOnStore_idx" ON "Product"("tenantId", "isPublishedOnStore");

-- CreateIndex
CREATE INDEX "Product_tenantId_isAvailable_sortOrder_updatedAt_idx" ON "Product"("tenantId", "isAvailable", "sortOrder", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_handle_key" ON "Product"("tenantId", "handle");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_combinationKey_key" ON "ProductVariant"("productId", "combinationKey");

-- CreateIndex
CREATE INDEX "CatalogCategory_parentId_idx" ON "CatalogCategory"("parentId");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_idx" ON "ProductMedia"("productId");

-- CreateIndex
CREATE INDEX "ProductMedia_sourceHash_idx" ON "ProductMedia"("sourceHash");

-- CreateIndex
CREATE INDEX "ProductComponent_componentId_idx" ON "ProductComponent"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComponent_setId_componentId_key" ON "ProductComponent"("setId", "componentId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_status_idx" ON "Conversation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_markedUnattended_idx" ON "Conversation"("tenantId", "markedUnattended");

-- CreateIndex
CREATE INDEX "Conversation_channelId_idx" ON "Conversation"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_channelId_externalThreadId_key" ON "Conversation"("channelId", "externalThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_inboundKey_key" ON "Message"("inboundKey");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_enginePending_createdAt_idx" ON "Message"("enginePending", "createdAt");

-- CreateIndex
CREATE INDEX "SalesEngineTurn_tenantId_conversationId_createdAt_idx" ON "SalesEngineTurn"("tenantId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesEngineTurn_status_updatedAt_idx" ON "SalesEngineTurn"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SalesCustomerMemory_tenantId_expiresAt_idx" ON "SalesCustomerMemory"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "SalesSearchJob_availableAt_idx" ON "SalesSearchJob"("availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesSearchJob_tenantId_documentType_sourceId_key" ON "SalesSearchJob"("tenantId", "documentType", "sourceId");

-- CreateIndex
CREATE INDEX "PlaygroundSession_tenantId_updatedAt_idx" ON "PlaygroundSession"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "PlaygroundMessage_sessionId_createdAt_idx" ON "PlaygroundMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentKey_key" ON "Order"("paymentKey");

-- CreateIndex
CREATE INDEX "Order_tenantId_status_idx" ON "Order"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Order_tenantId_channel_idx" ON "Order"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "Order_stockState_expiresAt_idx" ON "Order"("stockState", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_code_key" ON "Order"("tenantId", "code");

-- CreateIndex
CREATE INDEX "PaymentEvent_orderId_createdAt_idx" ON "PaymentEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_orderId_idx" ON "OrderItem"("productId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_tenantId_flow_status_idx" ON "Payment"("tenantId", "flow", "status");

-- CreateIndex
CREATE INDEX "RateLimitHit_expiresAt_idx" ON "RateLimitHit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveIntegration_oauthStateHash_key" ON "LiveIntegration"("oauthStateHash");

-- CreateIndex
CREATE INDEX "LiveCampaign_tenantId_status_createdAt_idx" ON "LiveCampaign"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveCampaign_tenantId_id_key" ON "LiveCampaign"("tenantId", "id");

-- CreateIndex
CREATE INDEX "LiveOffer_tenantId_campaignId_sortOrder_idx" ON "LiveOffer"("tenantId", "campaignId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LiveOffer_tenantId_id_key" ON "LiveOffer"("tenantId", "id");

-- CreateIndex
CREATE INDEX "LiveSession_tenantId_status_startedAt_idx" ON "LiveSession"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_tenantId_id_key" ON "LiveSession"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LiveReservation_orderId_key" ON "LiveReservation"("orderId");

-- CreateIndex
CREATE INDEX "LiveReservation_tenantId_sessionId_customerKey_offerId_stat_idx" ON "LiveReservation"("tenantId", "sessionId", "customerKey", "offerId", "status");

-- CreateIndex
CREATE INDEX "LiveReservation_tenantId_status_expiresAt_idx" ON "LiveReservation"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "LiveReservation_status_expiresAt_idx" ON "LiveReservation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveReservation_tenantId_idempotencyKey_key" ON "LiveReservation"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LiveEvent_tenantId_sessionId_createdAt_idx" ON "LiveEvent"("tenantId", "sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveEvent_tenantId_externalEventId_key" ON "LiveEvent"("tenantId", "externalEventId");

-- AddForeignKey
ALTER TABLE "ConversionSettings" ADD CONSTRAINT "ConversionSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCart" ADD CONSTRAINT "RecoveryCart_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryDelivery" ADD CONSTRAINT "RecoveryDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryDelivery" ADD CONSTRAINT "RecoveryDelivery_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "RecoveryCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBehaviorEvent" ADD CONSTRAINT "StoreBehaviorEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatPack" ADD CONSTRAINT "ChatPack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageMonth" ADD CONSTRAINT "AiUsageMonth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantIntegration" ADD CONSTRAINT "TenantIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSlugRedirect" ADD CONSTRAINT "StoreSlugRedirect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPaymentAccount" ADD CONSTRAINT "MerchantPaymentAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storefront" ADD CONSTRAINT "Storefront_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorefrontVersion" ADD CONSTRAINT "StorefrontVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAgent" ADD CONSTRAINT "SalesAgent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFaq" ADD CONSTRAINT "KnowledgeFaq_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyTemplate" ADD CONSTRAINT "JourneyTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppSignupSession" ADD CONSTRAINT "WhatsAppSignupSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_salesAgentId_fkey" FOREIGN KEY ("salesAgentId") REFERENCES "SalesAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEngineTurn" ADD CONSTRAINT "SalesEngineTurn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesEngineTurn" ADD CONSTRAINT "SalesEngineTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesCustomerMemory" ADD CONSTRAINT "SalesCustomerMemory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesSearchJob" ADD CONSTRAINT "SalesSearchJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaygroundSession" ADD CONSTRAINT "PlaygroundSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaygroundMessage" ADD CONSTRAINT "PlaygroundMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaygroundSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveIntegration" ADD CONSTRAINT "LiveIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveCampaign" ADD CONSTRAINT "LiveCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveCampaign" ADD CONSTRAINT "LiveCampaign_salesAgentId_fkey" FOREIGN KEY ("salesAgentId") REFERENCES "SalesAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveOffer" ADD CONSTRAINT "LiveOffer_tenantId_campaignId_fkey" FOREIGN KEY ("tenantId", "campaignId") REFERENCES "LiveCampaign"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveOffer" ADD CONSTRAINT "LiveOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveOffer" ADD CONSTRAINT "LiveOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_tenantId_campaignId_fkey" FOREIGN KEY ("tenantId", "campaignId") REFERENCES "LiveCampaign"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReservation" ADD CONSTRAINT "LiveReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReservation" ADD CONSTRAINT "LiveReservation_tenantId_sessionId_fkey" FOREIGN KEY ("tenantId", "sessionId") REFERENCES "LiveSession"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReservation" ADD CONSTRAINT "LiveReservation_tenantId_offerId_fkey" FOREIGN KEY ("tenantId", "offerId") REFERENCES "LiveOffer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReservation" ADD CONSTRAINT "LiveReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveEvent" ADD CONSTRAINT "LiveEvent_tenantId_sessionId_fkey" FOREIGN KEY ("tenantId", "sessionId") REFERENCES "LiveSession"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

