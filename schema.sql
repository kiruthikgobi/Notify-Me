
-- ========================================================
-- FLEETGUARD SaaS: DATABASE ENHANCEMENTS
-- ========================================================

-- 1. Extend Compliance Records for Document-Specific Alerts
ALTER TABLE IF EXISTS compliance_records 
  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_days_before INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS last_alert_sent_date DATE;

-- 2. Ensure existing records have defaults
UPDATE compliance_records SET alert_enabled = true WHERE alert_enabled IS NULL;
UPDATE compliance_records SET alert_days_before = 15 WHERE alert_days_before IS NULL;

-- 3. Vehicle Manufacturers Table
CREATE TABLE IF NOT EXISTS vehicle_makes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 4. Vehicle Limit Enforcement (Previously Implemented)
CREATE OR REPLACE FUNCTION public.enforce_vehicle_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT COALESCE(plan, 'FREE'), subscription_expiry 
  INTO v_plan, v_expiry 
  FROM tenants 
  WHERE id = NEW.tenant_id
  FOR SHARE; 
  
  IF v_plan = 'PRO' AND (v_expiry IS NOT NULL AND v_expiry < NOW()) THEN
    v_plan := 'FREE';
  END IF;

  IF v_plan = 'FREE' THEN
    SELECT COUNT(*) INTO v_count FROM vehicles WHERE tenant_id = NEW.tenant_id;
    IF (TG_OP = 'INSERT' AND v_count >= 5) OR (TG_OP = 'UPDATE' AND OLD.tenant_id != NEW.tenant_id AND v_count >= 5) THEN
      RAISE EXCEPTION 'Free plan allows only 5 vehicles. Subscribe to Pro to add unlimited vehicles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_vehicle_limit ON vehicles;
CREATE TRIGGER tr_enforce_vehicle_limit
  BEFORE INSERT OR UPDATE OF tenant_id ON vehicles
  FOR EACH ROW EXECUTE PROCEDURE public.enforce_vehicle_limit();
