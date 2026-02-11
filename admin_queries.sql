
-- ========================================================
-- FLEETGUARD SaaS: ADMIN OPERATIONS & DIAGNOSTICS
-- ========================================================

-- 1. PROMOTE TO SUPER ADMIN
-- Replace 'USER_EMAIL' with your registered email
UPDATE profiles 
SET role = 'SUPER_ADMIN' 
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'USER_EMAIL'
);

-- 2. DIAGNOSTIC: FIND USERS STUCK WITHOUT PROFILES
-- If this returns rows, the trigger 'on_auth_user_created' is failing.
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 3. MANUAL PROFILE SYNC (If trigger failed)
-- Run this if a user is stuck on "Verifying Identity"
-- INSERT INTO public.profiles (id, full_name, role, tenant_id)
-- SELECT id, email, 'TENANT_ADMIN', (raw_user_metadata->>'tenant_id')::uuid
-- FROM auth.users WHERE email = 'STUCK_USER_EMAIL'
-- ON CONFLICT (id) DO NOTHING;

-- 4. VIEW ALL ACTIVE TENANTS
SELECT t.name, t.plan, t.status, p.full_name as admin_user, u.email
FROM tenants t
JOIN profiles p ON p.tenant_id = t.id
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'TENANT_ADMIN';
