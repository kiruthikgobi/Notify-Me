
-- ========================================================
-- NOTIFY ME: MASTER DATABASE SCHEMA (V3 ROBUST)
-- ========================================================

-- 1. Tables Setup
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'FREE',
  status TEXT DEFAULT 'ACTIVE',
  subscription_expiry TIMESTAMP WITH TIME ZONE,
  last_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'TENANT_ADMIN',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS automation_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  recipients TEXT[] DEFAULT '{}',
  default_thresholds INTEGER[] DEFAULT '{30, 15, 7, 3, 1}',
  enabled BOOLEAN DEFAULT true,
  email_template JSONB DEFAULT '{"subject": "⚠️ Vehicle Document Expiry Reminder", "body": "Standard reminder template content..."}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_makes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_reg TEXT,
  doc_type TEXT,
  recipient TEXT,
  status TEXT DEFAULT 'SENT',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Security Helper Functions
CREATE OR REPLACE FUNCTION get_my_tenant_id() 
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin_configured() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'SUPER_ADMIN');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 4. Corrected RLS Policies (FIXED SYNTAX ERROR)
-- Profiles
DROP POLICY IF EXISTS "profiles_select_self" ON profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "profiles_tenant_access" ON profiles;

CREATE POLICY "profiles_select_self" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_tenant_access" ON profiles FOR SELECT USING (tenant_id = get_my_tenant_id());

-- Tenants
DROP POLICY IF EXISTS "tenants_select" ON tenants;
DROP POLICY IF EXISTS "tenants_insert" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (id = get_my_tenant_id() OR is_super_admin());
CREATE POLICY "tenants_insert" ON tenants FOR INSERT WITH CHECK (true);

-- Assets
CREATE POLICY "vehicles_access" ON vehicles FOR ALL USING (tenant_id = get_my_tenant_id() OR is_super_admin());
CREATE POLICY "records_access" ON compliance_records FOR ALL USING (tenant_id = get_my_tenant_id() OR is_super_admin());
CREATE POLICY "automation_access" ON automation_config FOR ALL USING (tenant_id = get_my_tenant_id() OR is_super_admin());
CREATE POLICY "makes_access" ON vehicle_makes FOR ALL USING (tenant_id = get_my_tenant_id() OR is_super_admin());
CREATE POLICY "logs_access" ON notification_logs FOR ALL USING (tenant_id = get_my_tenant_id() OR is_super_admin());

-- 5. Robust Auth Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  -- Extract metadata
  BEGIN
    v_tenant_id := (new.raw_user_metadata->>'tenant_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;
  
  v_role := COALESCE(new.raw_user_metadata->>'role', 'TENANT_ADMIN');

  -- Upsert profile record
  INSERT INTO public.profiles (id, full_name, email, role, tenant_id, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_metadata->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_tenant_id,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    tenant_id = EXCLUDED.tenant_id,
    updated_at = NOW();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
