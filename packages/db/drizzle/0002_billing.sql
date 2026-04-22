-- Billing-Skeleton (Phase 7) — fügt Subscription-Felder zur tenants-Tabelle hinzu.
-- Stripe-Felder sind nullable; Tenants ohne Stripe-Anbindung laufen im "demo"-Plan.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'demo',                -- demo | trial | active | past_due | cancelled
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS tenants_plan_idx ON tenants(plan);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_uq ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- price_monthly per tenant_features wird zur Abrechnungsbasis (existiert schon im Schema).
-- Wir tragen Default-Preise ein, falls noch nicht gesetzt:
UPDATE tenant_features SET price_monthly = CASE feature_key
  WHEN 'm1.datanorm'         THEN 9
  WHEN 'm2.ids_connect'      THEN 19
  WHEN 'm3.maintenance'      THEN 15
  WHEN 'm4.planning'         THEN 12
  WHEN 'm5.calculation'      THEN 10
  WHEN 'm6.warehouse'        THEN 15
  WHEN 'm7.funding'          THEN 19
  WHEN 'm8.heat_load'        THEN 9
  WHEN 'm9.manufacturer_api' THEN 19
  WHEN 'm10.datev'           THEN 15
  WHEN 'm11.sepa'            THEN 12
  WHEN 'm12.flow_ai'         THEN 29
  WHEN 'm13.checklists'      THEN 9
  WHEN 'm14.kanban'          THEN 9
  ELSE 0
END
WHERE price_monthly IS NULL;
