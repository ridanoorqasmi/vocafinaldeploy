-- CreateTable
CREATE TABLE "public"."plan_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billing_interval" TEXT NOT NULL DEFAULT 'month',
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "stripe_price_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_features" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "feature_type" TEXT NOT NULL,
    "limit_value" INTEGER,
    "boolean_value" BOOLEAN,
    "enum_value" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_quotas" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "quota_type" TEXT NOT NULL,
    "quota_limit" INTEGER NOT NULL,
    "quota_used" INTEGER NOT NULL DEFAULT 0,
    "quota_overage" INTEGER NOT NULL DEFAULT 0,
    "reset_date" TIMESTAMP(3) NOT NULL,
    "last_reset_date" TIMESTAMP(3),
    "overage_rate_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_events" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "tokens_consumed" INTEGER,
    "cost_cents" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_alerts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "quota_type" TEXT NOT NULL,
    "threshold_percentage" INTEGER,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_changes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "from_plan_id" TEXT,
    "to_plan_id" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "change_timing" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proration_credit" INTEGER NOT NULL DEFAULT 0,
    "proration_charge" INTEGER NOT NULL DEFAULT 0,
    "net_charge" INTEGER NOT NULL DEFAULT 0,
    "effective_date" TIMESTAMP(3),
    "reason" TEXT,
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."emergency_usage_pools" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "pool_type" TEXT NOT NULL,
    "total_allocated" INTEGER NOT NULL,
    "used_amount" INTEGER NOT NULL DEFAULT 0,
    "cost_per_unit" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "justification" TEXT,
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_usage_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_flags" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "feature_category" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "access_level" TEXT NOT NULL DEFAULT 'restricted',
    "usage_limit" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."business_feature_overrides" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "expires_at" TIMESTAMP(3),
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_feature_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_rollups" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "quota_type" TEXT NOT NULL,
    "usage_date" TIMESTAMP(3) NOT NULL,
    "total_usage" INTEGER NOT NULL,
    "unique_users" INTEGER NOT NULL DEFAULT 0,
    "peak_hourly_usage" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_forecasts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "quota_type" TEXT NOT NULL,
    "forecast_date" TIMESTAMP(3) NOT NULL,
    "predicted_usage" INTEGER NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "model_version" TEXT NOT NULL DEFAULT 'v1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."overage_charges" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "quota_type" TEXT NOT NULL,
    "overage_amount" INTEGER NOT NULL,
    "rate_per_unit" INTEGER NOT NULL,
    "total_charge_cents" INTEGER NOT NULL,
    "billing_period_start" TIMESTAMP(3) NOT NULL,
    "billing_period_end" TIMESTAMP(3) NOT NULL,
    "stripe_invoice_item_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overage_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_recommendations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "current_plan_id" TEXT NOT NULL,
    "recommended_plan_id" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "savings_potential" INTEGER,
    "upgrade_cost" INTEGER,
    "reasoning" JSONB NOT NULL,
    "is_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_taking_agents" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "launchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_taking_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_taking_menu_items" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_taking_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_taking_operating_hours" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_taking_operating_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_taking_policies" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_taking_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_taking_locations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_taking_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_plan_id_feature_key_key" ON "public"."plan_features"("plan_id", "feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "usage_quotas_business_id_quota_type_key" ON "public"."usage_quotas"("business_id", "quota_type");

-- CreateIndex
CREATE INDEX "usage_events_business_id_idx" ON "public"."usage_events"("business_id");

-- CreateIndex
CREATE INDEX "usage_events_event_type_idx" ON "public"."usage_events"("event_type");

-- CreateIndex
CREATE INDEX "usage_events_created_at_idx" ON "public"."usage_events"("created_at");

-- CreateIndex
CREATE INDEX "usage_alerts_business_id_idx" ON "public"."usage_alerts"("business_id");

-- CreateIndex
CREATE INDEX "usage_alerts_alert_type_idx" ON "public"."usage_alerts"("alert_type");

-- CreateIndex
CREATE INDEX "usage_alerts_triggered_at_idx" ON "public"."usage_alerts"("triggered_at");

-- CreateIndex
CREATE INDEX "plan_changes_business_id_idx" ON "public"."plan_changes"("business_id");

-- CreateIndex
CREATE INDEX "plan_changes_status_idx" ON "public"."plan_changes"("status");

-- CreateIndex
CREATE INDEX "plan_changes_effective_date_idx" ON "public"."plan_changes"("effective_date");

-- CreateIndex
CREATE INDEX "emergency_usage_pools_business_id_idx" ON "public"."emergency_usage_pools"("business_id");

-- CreateIndex
CREATE INDEX "emergency_usage_pools_expires_at_idx" ON "public"."emergency_usage_pools"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_plan_id_feature_key_key" ON "public"."feature_flags"("plan_id", "feature_key");

-- CreateIndex
CREATE INDEX "business_feature_overrides_business_id_idx" ON "public"."business_feature_overrides"("business_id");

-- CreateIndex
CREATE INDEX "business_feature_overrides_feature_key_idx" ON "public"."business_feature_overrides"("feature_key");

-- CreateIndex
CREATE INDEX "business_feature_overrides_expires_at_idx" ON "public"."business_feature_overrides"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "usage_rollups_business_id_quota_type_usage_date_key" ON "public"."usage_rollups"("business_id", "quota_type", "usage_date");

-- CreateIndex
CREATE INDEX "usage_forecasts_business_id_idx" ON "public"."usage_forecasts"("business_id");

-- CreateIndex
CREATE INDEX "usage_forecasts_forecast_date_idx" ON "public"."usage_forecasts"("forecast_date");

-- CreateIndex
CREATE INDEX "overage_charges_business_id_idx" ON "public"."overage_charges"("business_id");

-- CreateIndex
CREATE INDEX "overage_charges_billing_period_start_billing_period_end_idx" ON "public"."overage_charges"("billing_period_start", "billing_period_end");

-- CreateIndex
CREATE INDEX "overage_charges_status_idx" ON "public"."overage_charges"("status");

-- CreateIndex
CREATE INDEX "plan_recommendations_business_id_idx" ON "public"."plan_recommendations"("business_id");

-- CreateIndex
CREATE INDEX "plan_recommendations_current_plan_id_idx" ON "public"."plan_recommendations"("current_plan_id");

-- CreateIndex
CREATE INDEX "plan_recommendations_recommended_plan_id_idx" ON "public"."plan_recommendations"("recommended_plan_id");

-- CreateIndex
CREATE INDEX "order_taking_agents_businessId_idx" ON "public"."order_taking_agents"("businessId");

-- CreateIndex
CREATE INDEX "order_taking_agents_isActive_idx" ON "public"."order_taking_agents"("isActive");

-- CreateIndex
CREATE INDEX "order_taking_menu_items_agentId_idx" ON "public"."order_taking_menu_items"("agentId");

-- CreateIndex
CREATE INDEX "order_taking_operating_hours_agentId_idx" ON "public"."order_taking_operating_hours"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "order_taking_operating_hours_agentId_dayOfWeek_key" ON "public"."order_taking_operating_hours"("agentId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "order_taking_policies_agentId_idx" ON "public"."order_taking_policies"("agentId");

-- CreateIndex
CREATE INDEX "order_taking_policies_type_idx" ON "public"."order_taking_policies"("type");

-- CreateIndex
CREATE INDEX "order_taking_locations_agentId_idx" ON "public"."order_taking_locations"("agentId");

-- AddForeignKey
ALTER TABLE "public"."plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plan_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_quotas" ADD CONSTRAINT "usage_quotas_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_events" ADD CONSTRAINT "usage_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_alerts" ADD CONSTRAINT "usage_alerts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_changes" ADD CONSTRAINT "plan_changes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_changes" ADD CONSTRAINT "plan_changes_from_plan_id_fkey" FOREIGN KEY ("from_plan_id") REFERENCES "public"."plan_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_changes" ADD CONSTRAINT "plan_changes_to_plan_id_fkey" FOREIGN KEY ("to_plan_id") REFERENCES "public"."plan_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."emergency_usage_pools" ADD CONSTRAINT "emergency_usage_pools_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flags" ADD CONSTRAINT "feature_flags_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plan_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."business_feature_overrides" ADD CONSTRAINT "business_feature_overrides_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_rollups" ADD CONSTRAINT "usage_rollups_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage_forecasts" ADD CONSTRAINT "usage_forecasts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."overage_charges" ADD CONSTRAINT "overage_charges_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_recommendations" ADD CONSTRAINT "plan_recommendations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_taking_agents" ADD CONSTRAINT "order_taking_agents_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_taking_menu_items" ADD CONSTRAINT "order_taking_menu_items_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."order_taking_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_taking_operating_hours" ADD CONSTRAINT "order_taking_operating_hours_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."order_taking_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_taking_policies" ADD CONSTRAINT "order_taking_policies_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."order_taking_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_taking_locations" ADD CONSTRAINT "order_taking_locations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."order_taking_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
