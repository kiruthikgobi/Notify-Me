
-- ========================================================
-- NOTIFY ME: BULLETPROOF PRODUCTION SCHEMA (V40)
-- ========================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BASE TABLES
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  subscription_plan TEXT DEFAULT 'FREE' CHECK (subscription_plan IN ('FREE', 'PRO')),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'TENANT_ADMIN' CHECK (role IN ('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER', 'TENANT_VIEWER')),
  access_level TEXT DEFAULT 'FULL_ACCESS' CHECK (access_level IN ('READ_ONLY', 'FULL_ACCESS')),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  type TEXT DEFAULT 'Truck',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  expiry_date DATE,
  last_renewed_date DATE,
  document_name TEXT,
  document_url TEXT,
  alert_enabled BOOLEAN DEFAULT true,
  alert_days_before INTEGER DEFAULT 15,
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SECURITY FUNCTIONS (Qualified and Definer-set)
CREATE OR REPLACE FUNCTION public.check_user_role(u_id UUID, target_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = u_id AND role = target_role);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_user_company_id(u_id UUID)
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = u_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- 3. RLS POLICIES (Simplified for speed)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_select_own" ON public.profiles;
CREATE POLICY "p_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "v_all_access" ON public.vehicles;
CREATE POLICY "v_all_access" ON public.vehicles FOR ALL USING (
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) 
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

DROP POLICY IF EXISTS "r_all_access" ON public.compliance_records;
CREATE POLICY "r_all_access" ON public.compliance_records FOR ALL USING (
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
);

-- 4. ATOMIC AUTH TRIGGER (V40)
-- This function uses nested exception blocks to ensure the user is ALWAYS created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_co_id UUID := NULL;
  v_raw_role TEXT;
  v_clean_role TEXT;
  v_full_name TEXT;
  v_meta JSONB;
BEGIN
  -- Safe Metadata Capture
  v_meta := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  
  -- Role Normalization (Ensure it matches CHECK constraints)
  v_raw_role := v_meta->>'role';
  v_clean_role := CASE 
    WHEN v_raw_role IN ('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER', 'TENANT_VIEWER') THEN v_raw_role
    ELSE 'TENANT_ADMIN'
  END;

  v_full_name := COALESCE(v_meta->>'full_name', split_part(new.email, '@', 1));

  -- Step 1: Attempt Company Creation (Isolated)
  IF v_clean_role = 'TENANT_ADMIN' THEN
    BEGIN
      INSERT INTO public.companies (company_name)
      VALUES (COALESCE(v_meta->>'company_name', 'Default Workspace'))
      RETURNING id INTO v_co_id;
    EXCEPTION WHEN OTHERS THEN
      v_co_id := NULL; -- Proceed even if company creation fails
    END;
  END IF;

  -- Step 2: Attempt Company Link for Sub-users (Isolated)
  IF v_co_id IS NULL AND (v_meta->>'company_id') IS NOT NULL THEN
    BEGIN
      v_co_id := (v_meta->>'company_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_co_id := NULL;
    END;
  END IF;

  -- Step 3: Final Profile Creation (Isolated and Idempotent)
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, company_id)
    VALUES (new.id, new.email, v_full_name, v_clean_role, v_co_id)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
      role = COALESCE(profiles.role, EXCLUDED.role),
      company_id = COALESCE(profiles.company_id, EXCLUDED.company_id),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- Final fallback: Minimal record to prevent Auth service crash
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, split_part(new.email, '@', 1), 'TENANT_ADMIN')
    ON CONFLICT (id) DO NOTHING;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Utility for UI
CREATE OR REPLACE FUNCTION public.is_super_admin_configured() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'SUPER_ADMIN');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;
