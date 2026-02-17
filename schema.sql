
-- ========================================================
-- FLEETGUARD SaaS: MASTER DATABASE SCHEMA (STABLE)
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
  email TEXT,
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

-- 8. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'PENDING',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- SECURITY DEFINER HELPERS (Recursion-Safe & High Performance)
-- ========================================================

CREATE OR REPLACE FUNCTION get_my_tenant_id() 
RETURNS UUID AS $$
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id', ''))::uuid,
    (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role' = 'SUPER_ADMIN'),
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin_configured() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'SUPER_ADMIN');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ========================================================
-- RLS POLICY CLEANUP & RECREATION
-- ========================================================

DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 1. Tenants Policies
CREATE POLICY "tenants_super_admin" ON tenants FOR ALL USING (is_super_admin());
CREATE POLICY "tenants_tenant_select" ON tenants FOR SELECT USING (id = get_my_tenant_id());
CREATE POLICY "tenants_public_insert" ON tenants FOR INSERT WITH CHECK (true);

-- 2. Profiles Policies
CREATE POLICY "profiles_super_admin" ON profiles FOR ALL USING (is_super_admin());
CREATE POLICY "profiles_self_access" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "profiles_colleague_select" ON profiles FOR SELECT USING (tenant_id = get_my_tenant_id());

-- 3. Vehicles Policies
CREATE POLICY "vehicles_super_admin" ON vehicles FOR ALL USING (is_super_admin());
CREATE POLICY "vehicles_tenant_access" ON vehicles FOR ALL 
USING (tenant_id = get_my_tenant_id()) 
WITH CHECK (tenant_id = get_my_tenant_id());

-- 4. Compliance Records Policies
CREATE POLICY "compliance_super_admin" ON compliance_records FOR ALL USING (is_super_admin());
CREATE POLICY "compliance_select" ON compliance_records FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "compliance_insert" ON compliance_records FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "compliance_update" ON compliance_records FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "compliance_delete" ON compliance_records FOR DELETE USING (tenant_id = get_my_tenant_id());

-- 5. Automation Config Policies
CREATE POLICY "automation_super_admin" ON automation_config FOR ALL USING (is_super_admin());
CREATE POLICY "automation_select" ON automation_config FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "automation_insert" ON automation_config FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "automation_update" ON automation_config FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "automation_delete" ON automation_config FOR DELETE USING (tenant_id = get_my_tenant_id());

-- 6. Vehicle Makes Policies
CREATE POLICY "makes_super_admin" ON vehicle_makes FOR ALL USING (is_super_admin());
CREATE POLICY "makes_select" ON vehicle_makes FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "makes_insert" ON vehicle_makes FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "makes_update" ON vehicle_makes FOR UPDATE USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "makes_delete" ON vehicle_makes FOR DELETE USING (tenant_id = get_my_tenant_id());

-- 7. Notification Logs Policies
CREATE POLICY "logs_super_admin" ON notification_logs FOR ALL USING (is_super_admin());
CREATE POLICY "logs_tenant_read" ON notification_logs FOR SELECT 
USING (tenant_id = get_my_tenant_id());

-- 8. Payments Policies
CREATE POLICY "payments_super_admin" ON payments FOR ALL USING (is_super_admin());
CREATE POLICY "payments_tenant_read" ON payments FOR SELECT USING (tenant_id = get_my_tenant_id());

-- ========================================================
-- AUTH TRIGGER
-- ========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  v_tenant_id := (new.raw_user_metadata->>'tenant_id')::uuid;
  v_role := COALESCE(new.raw_user_metadata->>'role', 'TENANT_ADMIN');

  INSERT INTO public.profiles (id, full_name, email, role, tenant_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_metadata->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_tenant_id
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    tenant_id = EXCLUDED.tenant_id,
    updated_at = NOW();
  
  IF v_role = 'TENANT_ADMIN' AND v_tenant_id IS NOT NULL THEN
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
