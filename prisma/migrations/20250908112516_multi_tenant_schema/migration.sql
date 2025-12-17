-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('QUERY', 'ORDER', 'INTEGRATION', 'API_CALL', 'STORAGE');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'CANCELLED', 'EXPIRED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "QueryLogStatus" AS ENUM ('SUCCESS', 'ERROR', 'TIMEOUT', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'TRIAL',
    "phone" TEXT,
    "website" TEXT,
    "description" TEXT,
    "logo" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_hours" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "image" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "allergens" TEXT[],
    "calories" INTEGER,
    "prepTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metrics" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "UsageType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "response" TEXT,
    "status" "QueryLogStatus" NOT NULL DEFAULT 'SUCCESS',
    "responseTime" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerContact" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "powerups" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "powerupName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "powerups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_policies" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "deliveryZones" JSONB NOT NULL,
    "timings" TEXT,
    "refundPolicy" TEXT,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "business_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_integrations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stripeKey" TEXT,
    "twilioSid" TEXT,
    "twilioToken" TEXT,
    "emailProvider" TEXT NOT NULL DEFAULT 'gmail',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "business_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_email_key" ON "businesses"("email");

-- CreateIndex
CREATE INDEX "businesses_slug_idx" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_status_idx" ON "businesses"("status");

-- CreateIndex
CREATE INDEX "businesses_email_idx" ON "businesses"("email");

-- CreateIndex
CREATE INDEX "businesses_deletedAt_idx" ON "businesses"("deletedAt");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_businessId_email_key" ON "users"("businessId", "email");

-- CreateIndex
CREATE INDEX "locations_businessId_idx" ON "locations"("businessId");

-- CreateIndex
CREATE INDEX "locations_deletedAt_idx" ON "locations"("deletedAt");

-- CreateIndex
CREATE INDEX "operating_hours_locationId_idx" ON "operating_hours"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_locationId_dayOfWeek_key" ON "operating_hours"("locationId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "categories_businessId_idx" ON "categories"("businessId");

-- CreateIndex
CREATE INDEX "categories_sortOrder_idx" ON "categories"("sortOrder");

-- CreateIndex
CREATE INDEX "categories_deletedAt_idx" ON "categories"("deletedAt");

-- CreateIndex
CREATE INDEX "menu_items_businessId_idx" ON "menu_items"("businessId");

-- CreateIndex
CREATE INDEX "menu_items_categoryId_idx" ON "menu_items"("categoryId");

-- CreateIndex
CREATE INDEX "menu_items_isAvailable_idx" ON "menu_items"("isAvailable");

-- CreateIndex
CREATE INDEX "menu_items_deletedAt_idx" ON "menu_items"("deletedAt");

-- CreateIndex
CREATE INDEX "policies_businessId_idx" ON "policies"("businessId");

-- CreateIndex
CREATE INDEX "policies_type_idx" ON "policies"("type");

-- CreateIndex
CREATE INDEX "policies_deletedAt_idx" ON "policies"("deletedAt");

-- CreateIndex
CREATE INDEX "knowledge_base_businessId_idx" ON "knowledge_base"("businessId");

-- CreateIndex
CREATE INDEX "knowledge_base_category_idx" ON "knowledge_base"("category");

-- CreateIndex
CREATE INDEX "knowledge_base_isActive_idx" ON "knowledge_base"("isActive");

-- CreateIndex
CREATE INDEX "knowledge_base_deletedAt_idx" ON "knowledge_base"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_status_idx" ON "api_keys"("status");

-- CreateIndex
CREATE INDEX "api_keys_deletedAt_idx" ON "api_keys"("deletedAt");

-- CreateIndex
CREATE INDEX "subscriptions_businessId_idx" ON "subscriptions"("businessId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_currentPeriodEnd_idx" ON "subscriptions"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "usage_metrics_businessId_idx" ON "usage_metrics"("businessId");

-- CreateIndex
CREATE INDEX "usage_metrics_type_idx" ON "usage_metrics"("type");

-- CreateIndex
CREATE INDEX "usage_metrics_date_idx" ON "usage_metrics"("date");

-- CreateIndex
CREATE INDEX "query_logs_businessId_idx" ON "query_logs"("businessId");

-- CreateIndex
CREATE INDEX "query_logs_status_idx" ON "query_logs"("status");

-- CreateIndex
CREATE INDEX "query_logs_createdAt_idx" ON "query_logs"("createdAt");

-- CreateIndex
CREATE INDEX "menus_businessId_idx" ON "menus"("businessId");

-- CreateIndex
CREATE INDEX "menus_available_idx" ON "menus"("available");

-- CreateIndex
CREATE INDEX "menus_deletedAt_idx" ON "menus"("deletedAt");

-- CreateIndex
CREATE INDEX "orders_businessId_idx" ON "orders"("businessId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");

-- CreateIndex
CREATE INDEX "powerups_businessId_idx" ON "powerups"("businessId");

-- CreateIndex
CREATE INDEX "powerups_enabled_idx" ON "powerups"("enabled");

-- CreateIndex
CREATE INDEX "powerups_deletedAt_idx" ON "powerups"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "business_policies_businessId_key" ON "business_policies"("businessId");

-- CreateIndex
CREATE INDEX "business_policies_businessId_idx" ON "business_policies"("businessId");

-- CreateIndex
CREATE INDEX "business_policies_deletedAt_idx" ON "business_policies"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "business_integrations_businessId_key" ON "business_integrations"("businessId");

-- CreateIndex
CREATE INDEX "business_integrations_businessId_idx" ON "business_integrations"("businessId");

-- CreateIndex
CREATE INDEX "business_integrations_deletedAt_idx" ON "business_integrations"("deletedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "powerups" ADD CONSTRAINT "powerups_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_policies" ADD CONSTRAINT "business_policies_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_integrations" ADD CONSTRAINT "business_integrations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
