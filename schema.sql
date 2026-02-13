-- ========================================================
-- FLEETGUARD SaaS: COMPREHENSIVE DATABASE CORE (V2.1)
-- ========================================================

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'FREE',
  status TEXT DEFAULT 'ACTIVE',
  subscription_expiry TIMESTAMP WITH TIME ZONE,
  last_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'TENANT_ADMIN',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  type TEXT DEFAULT 'Truck',
  added_date DATE DEFAULT CURRENT_DATE,
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Compliance Records Table
CREATE TABLE IF NOT EXISTS compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  expiry_date DATE,
  last_renewed_date DATE,
  document_name TEXT,
  document_url TEXT,
  alert_enabled BOOLEAN DEFAULT true,
  alert_days_before INTEGER DEFAULT 15,
  last_alert_sent_date DATE,
  is_draft BOOLEAN DEFAULT false,
  sent_reminders INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Automation Configuration Table
CREATE TABLE IF NOT EXISTS automation_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  recipients TEXT[] DEFAULT '{}',
  default_thresholds INTEGER[] DEFAULT '{30, 15, 7, 3, 1}',
  enabled BOOLEAN DEFAULT true,
  email_template JSONB DEFAULT '{"subject": "⚠️ Vehicle Document Expiry Reminder", "body": "Standard reminder template content..."}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Vehicle Manufacturers Table
CREATE TABLE IF NOT EXISTS vehicle_makes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 7. Notification Logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_reg TEXT,
  doc_type TEXT,
  recipient TEXT,
  status TEXT DEFAULT 'SENT',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- CLEANUP OLD POLICIES
DO $$ 
DECLARE 
  pol RECORD;
BEGIN 
  FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ========================================================
-- RLS HELPER: RECURSION-PROOF JWT LOOKUP
-- ========================================================
-- Extracts tenant_id from user_metadata in the JWT. 
-- This is much faster and prevents recursion loops.
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'user_metadata' ->> 'tenant_id')::uuid;
$$ LANGUAGE sql STABLE;

-- ========================================================
-- GLOBAL POLICIES
-- ========================================================

-- Profiles
CREATE POLICY "Profiles_Self_Access" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Profiles_Tenant_Access" ON profiles FOR SELECT USING (tenant_id = get_auth_tenant_id());

-- Tenants
CREATE POLICY "Tenants_Tenant_Access" ON tenants FOR SELECT USING (id = get_auth_tenant_id());

-- Data Tables
CREATE POLICY "Vehicles_Tenant_Isolation" ON vehicles FOR ALL USING (tenant_id = get_auth_tenant_id());
CREATE POLICY "Compliance_Tenant_Isolation" ON compliance_records FOR ALL USING (tenant_id = get_auth_tenant_id());
CREATE POLICY "Automation_Tenant_Isolation" ON automation_config FOR ALL USING (tenant_id = get_auth_tenant_id());
CREATE POLICY "Makes_Tenant_Isolation" ON vehicle_makes FOR ALL USING (tenant_id = get_auth_tenant_id());
CREATE POLICY "Logs_Tenant_Isolation" ON notification_logs FOR ALL USING (tenant_id = get_auth_tenant_id());

-- ========================================================
-- PROVISIONING TRIGGER
-- ========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  v_tenant_id := (new.raw_user_metadata->>'tenant_id')::uuid;
  v_role := COALESCE(new.raw_user_metadata->>'role', 'TENANT_ADMIN');

  INSERT INTO public.profiles (id, full_name, role, tenant_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_metadata->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    v_tenant_id
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id);

  IF (v_role = 'TENANT_ADMIN' AND v_tenant_id IS NOT NULL) THEN
    INSERT INTO public.automation_config (tenant_id, recipients)
    VALUES (v_tenant_id, ARRAY[new.email])
    ON CONFLICT (tenant_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Limit Trigger
CREATE OR REPLACE FUNCTION public.enforce_vehicle_limit()
RETURNS trigger AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_plan = 'FREE' THEN
    SELECT COUNT(*) INTO v_count FROM public.vehicles WHERE tenant_id = NEW.tenant_id;
    IF v_count >= 5 THEN RAISE EXCEPTION 'Vehicle limit reached for FREE plan.'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_enforce_vehicle_limit ON vehicles;
CREATE TRIGGER tr_enforce_vehicle_limit BEFORE INSERT ON vehicles FOR EACH ROW EXECUTE PROCEDURE public.enforce_vehicle_limit();