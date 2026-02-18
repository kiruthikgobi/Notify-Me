
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Vehicle, 
  ComplianceRecord, 
  ComplianceType, 
  ToastMessage, 
  GlobalAutomationConfig,
  UserRole,
  Tenant,
  SubscriptionPlan,
  TenantStatus,
  NotificationLog,
  VehicleMake
} from './types';
import { ICONS } from './constants';
import Dashboard from './components/Dashboard';
import VehicleList from './components/VehicleList';
import VehicleDetail from './components/VehicleDetail';
import AutomationSettings from './components/AutomationSettings';
import SuperAdminView from './components/SuperAdminView';
import TeamManagement from './components/TeamManagement';
import SubscriptionPage from './components/SubscriptionPage';
import ActionHistory from './components/ActionHistory';
import Toast from './components/Toast';
import Auth from './components/Auth';
import ConfirmationModal from './components/ConfirmationModal';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type View = 'dashboard' | 'vehicles' | 'detail' | 'automation' | 'tenants' | 'team' | 'subscription' | 'history';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [vehicleMakes, setVehicleMakes] = useState<VehicleMake[]>([]);
  
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingIdentity, setSyncingIdentity] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => 
    document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
  );
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => 
    localStorage.getItem('sidebar_collapsed') === 'true'
  );
  
  const [automationConfig, setAutomationConfig] = useState<GlobalAutomationConfig | null>(null);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  
  const lastFetchedUserId = useRef<string | null>(null);

  const addToast = useCallback((title: string, message: string, type: ToastMessage['type'] = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', String(newState));
  };

  const navigateTo = (view: View) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const fetchTenantData = useCallback(async (userId: string, force: boolean = false) => {
    if (!isSupabaseConfigured()) {
      addToast('Configuration Error', 'Supabase is not connected.', 'error');
      setLoading(false);
      return;
    }

    if (!force && lastFetchedUserId.current === userId && profile) return;
    
    setSyncingIdentity(true);
    setAutomationLoading(true);
    lastFetchedUserId.current = userId;
    
    try {
      console.log(`Syncing profile for: ${userId}`);
      // Initial fetch
      let { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // If no profile found immediately, retry once after a short delay 
      // (in case the trigger is still processing)
      if (!pData && !pError) {
        await new Promise(r => setTimeout(r, 1000));
        const retry = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        pData = retry.data;
        pError = retry.error;
      }

      if (pError) {
        console.error('Profile fetch failed:', pError);
        throw pError;
      }

      if (!pData) {
        console.warn('No profile found for ID:', userId);
        setProfile(null); // Explicitly set to null if missing
        setSyncingIdentity(false);
        setLoading(false);
        return;
      }

      setProfile(pData);
      const tid = pData.tenant_id;
      const isSuper = pData.role === UserRole.SUPER_ADMIN;

      // Global fetches for Super Admin
      if (isSuper) {
        console.log('User is SUPER_ADMIN. Fetching global registry...');
        const [tenantsRes, logsRes] = await Promise.all([
          supabase.from('tenants').select('*, profiles(full_name, email, role)'),
          supabase.from('notification_logs').select('*').order('timestamp', { ascending: false }).limit(100)
        ]);

        if (tenantsRes.error) console.error('Global tenants fetch error:', tenantsRes.error);
        if (tenantsRes.data) {
          setAllTenants(tenantsRes.data.map((t: any) => ({
            id: t.id, 
            name: t.name, 
            ownerEmail: (t.profiles as any[])?.find(p => p.role === UserRole.TENANT_ADMIN)?.email || 'System Account',
            plan: t.plan as SubscriptionPlan, 
            status: t.status as TenantStatus, 
            createdAt: t.created_at, 
            subscriptionExpiry: t.subscription_expiry
          })));
        }

        if (logsRes.data) {
          setLogs(logsRes.data.map((l: any) => ({
            id: l.id,
            tenantId: l.tenant_id,
            vehicleReg: l.vehicle_reg,
            docType: l.doc_type,
            recipient: l.recipient,
            status: l.status,
            timestamp: l.timestamp
          })));
        }
      }

      // Tenant-specific fetches
      if (tid) {
        console.log(`Fetching data for tenant workspace: ${tid}`);
        const [tRes, vRes, rRes, nRes, mRes, uRes] = await Promise.allSettled([
          supabase.from('tenants').select('*').eq('id', tid).maybeSingle(),
          supabase.from('vehicles').select('*').eq('tenant_id', tid).order('added_date', { ascending: false }),
          supabase.from('compliance_records').select('*').eq('tenant_id', tid),
          supabase.from('automation_config').select('*').eq('tenant_id', tid).maybeSingle(),
          supabase.from('vehicle_makes').select('*').eq('tenant_id', tid).order('name', { ascending: true }),
          supabase.from('profiles').select('*').eq('tenant_id', tid)
        ]);

        if (tRes.status === 'fulfilled' && tRes.value.data) {
          const tData = tRes.value.data;
          setCurrentTenant({
            id: tData.id,
            name: tData.name,
            ownerEmail: pData.email,
            plan: tData.plan as SubscriptionPlan,
            status: tData.status as TenantStatus,
            createdAt: tData.created_at,
            subscriptionExpiry: tData.subscription_expiry,
            paymentId: tData.last_payment_id
          });
        }

        if (vRes.status === 'fulfilled' && vRes.value.data) {
          setVehicles(vRes.value.data.map((v: any) => ({
            id: v.id, tenantId: v.tenant_id, registrationNumber: v.registration_number, make: v.make, model: v.model, year: v.year, type: v.type, addedDate: v.added_date, isDraft: v.is_draft
          })));
        }

        if (rRes.status === 'fulfilled' && rRes.value.data) {
          setRecords(rRes.value.data.map((r: any) => ({
            id: r.id, 
            tenantId: r.tenant_id, 
            vehicleId: r.vehicle_id, 
            type: r.type as ComplianceType, 
            expiryDate: r.expiry_date || '', 
            lastRenewedDate: r.last_renewed_date || '', 
            isDraft: r.is_draft, 
            sentReminders: r.sent_reminders || [], 
            documentName: r.document_name, 
            documentUrl: r.document_url, 
            alertEnabled: r.alert_enabled !== false, 
            alertDaysBefore: r.alert_days_before || 15
          })));
        }

        if (nRes.status === 'fulfilled' && nRes.value.data) {
          setAutomationConfig({ 
            tenantId: nRes.value.data.tenant_id, 
            recipients: nRes.value.data.recipients || [], 
            defaultThresholds: nRes.value.data.default_thresholds || [30, 15, 7, 3, 1], 
            enabled: nRes.value.data.enabled !== false, 
            emailTemplate: nRes.value.data.email_template 
          });
        }

        if (mRes.status === 'fulfilled' && mRes.value.data) {
          setVehicleMakes(mRes.value.data.map((m: any) => ({ id: m.id, tenantId: m.tenant_id, name: m.name })));
        }

        if (uRes.status === 'fulfilled' && uRes.value.data) {
          setTeamUsers(uRes.value.data);
        }
      }
    } catch (err: any) {
      console.error('Critical sync failure:', err);
      addToast('Sync Error', 'Workspace connection lost.', 'error');
    } finally {
      setSyncingIdentity(false);
      setAutomationLoading(false);
      setLoading(false);
    }
  }, [addToast]);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Signout error:', error);
    } catch (e) {
      console.error('Signout exception:', e);
    } finally {
      setSession(null);
      setProfile(null);
      setCurrentTenant(null);
      setAutomationConfig(null);
      setVehicles([]);
      setRecords([]);
      setSyncingIdentity(false);
      setLoading(false);
      lastFetchedUserId.current = null;
      setIsSignOutModalOpen(false);
      setIsMobileMenuOpen(false);
      setActiveView('dashboard');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      
      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) console.error('Initial session fetch error:', sessionError);

      if (mounted) {
        setSession(initialSession);
        if (!initialSession) setLoading(false);
      }
    };
    initializeAuth();
    
    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setCurrentTenant(null);
          setAutomationConfig(null);
          setLoading(false);
        }
      });
      return () => { mounted = false; subscription.unsubscribe(); };
    }
  }, []);

  useEffect(() => { 
    if (session?.user?.id) fetchTenantData(session.user.id); 
  }, [session?.user?.id, fetchTenantData]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const updateVehicle = async (v: Vehicle) => {
    const tid = profile?.tenant_id;
    if (!tid) {
      addToast('Security Error', 'Workspace identity missing or invalid context.', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('vehicles').update({
        registration_number: v.registrationNumber,
        make: v.make,
        model: v.model,
        year: v.year,
        type: v.type,
        is_draft: v.isDraft
      }).eq('id', v.id).eq('tenant_id', tid);
      
      if (error) throw error;
      addToast('Vehicle Updated', `Registration ${v.registrationNumber} updated.`);
      fetchTenantData(session.user.id, true);
    } catch (err: any) {
      console.error('Vehicle update error:', err);
      addToast('Update Failed', err.message, 'error');
    }
  };

  const addVehicle = async (v: Vehicle) => {
    const tid = profile?.tenant_id;
    if (!tid) {
      addToast('Security Error', 'Workspace identity missing. Please re-login.', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('vehicles').insert({
        tenant_id: tid,
        registration_number: v.registrationNumber,
        make: v.make,
        model: v.model,
        year: v.year,
        type: v.type,
        added_date: v.addedDate || new Date().toISOString().split('T')[0],
        is_draft: v.isDraft || false
      });
      
      if (error) throw error;
      addToast('Vehicle Registered', `${v.registrationNumber} added.`);
      fetchTenantData(session.user.id, true);
    } catch (err: any) {
      console.error('Vehicle insertion error:', err);
      addToast('Registration Failed', err.message, 'error');
    }
  };

  const updateRecord = async (r: ComplianceRecord) => {
    const tid = profile?.tenant_id;
    if (!tid) return;

    try {
      const existing = records.find(rec => rec.vehicleId === r.vehicleId && rec.type === r.type);
      const payload: any = {
        tenant_id: tid,
        vehicle_id: r.vehicleId,
        type: r.type,
        expiry_date: r.expiryDate || null,
        last_renewed_date: r.lastRenewedDate || null,
        document_name: r.documentName,
        // Fix: Use camelCase property names from the ComplianceRecord interface
        document_url: r.documentUrl,
        alert_enabled: r.alertEnabled !== false,
        alert_days_before: r.alertDaysBefore || 15,
        is_draft: r.isDraft || false
      };

      if (existing) payload.id = existing.id;

      const { error } = await supabase.from('compliance_records').upsert(payload);
      if (error) throw error;
      
      addToast('Record Saved', `${r.type} updated.`);
      fetchTenantData(session.user.id, true);
    } catch (err: any) {
      console.error('Compliance update error:', err);
      addToast('Save Failed', err.message, 'error');
    }
  };

  const updateAutomation = async (c: GlobalAutomationConfig) => {
    const tid = profile?.tenant_id;
    if (!tid) return;

    try {
      const { error } = await supabase.from('automation_config').upsert({
        tenant_id: tid,
        recipients: c.recipients,
        default_thresholds: c.defaultThresholds,
        enabled: c.enabled
      });
      
      if (error) throw error;
      addToast('Settings Saved', 'Alert configuration updated.');
      fetchTenantData(session.user.id, true);
    } catch (err: any) {
      console.error('Automation update error:', err);
      addToast('Error Saving', err.message, 'error');
    }
  };

  const addVehicleMake = async (name: string) => {
    const tid = profile?.tenant_id;
    if (!tid) return;

    try {
      const { error } = await supabase.from('vehicle_makes').insert({
        tenant_id: tid,
        name: name
      });
      
      if (error) throw error;
      addToast('Make Added', `"${name}" added.`);
      fetchTenantData(session.user.id, true);
    } catch (err: any) {
      console.error('Make addition error:', err);
      addToast('Error Adding Make', err.message, 'error');
    }
  };

  const removeVehicleMake = async (id: string) => {
    const tid = profile?.tenant_id;
    if (!tid) return;

    try {
      const { error } = await supabase.from('vehicle_makes').delete().eq('id', id).eq('tenant_id', tid);
      if (error) throw error;
      addToast('Make Removed', 'Manufacturer deleted.');
      fetchTenantData(session.user.id, true);
    } catch (err: any) {
      console.error('Make deletion error:', err);
      addToast('Delete Failed', err.message, 'error');
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
           <ICONS.Alert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Configuration Required</h2>
        <p className="max-w-md text-sm text-slate-500 font-medium">Supabase is not connected. Please check your environment variables.</p>
      </div>
    );
  }

  // If session is active but profile is missing, we must wait or show a relevant error.
  if (!session && !loading) return <Auth onAuthComplete={() => {}} />;

  if (loading || (session && !profile)) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6 text-center">
      <div className="spinner mb-6" />
      <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Syncing Workspace</h2>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Establishing Secure Connection</p>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <Toast toasts={toasts} removeToast={removeToast} />
      
      <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-navy-900 dark:bg-black text-white shrink-0 safe-pt border-b border-white/5 z-50 shadow-lg">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
          {isMobileMenuOpen ? <ICONS.Plus className="w-6 h-6 rotate-45" /> : <ICONS.Menu className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-3">
          <ICONS.Logo className="w-7 h-7" />
          <span className="font-display font-black text-lg tracking-tight">Notify Me</span>
        </div>
        <div className="w-10"></div> 
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`hidden lg:flex ${isSidebarCollapsed ? 'w-24' : 'w-72'} bg-navy-900 dark:bg-black border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 relative z-40`}>
          <button onClick={toggleSidebar} className="absolute -right-3 top-10 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-500 transition-colors z-[60]">
            <ICONS.ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`p-8 flex flex-col gap-4 overflow-hidden ${isSidebarCollapsed ? 'items-center' : ''}`}>
            <div className="flex items-center gap-3">
              <ICONS.Logo className="w-8 h-8 text-primary-500 shrink-0" />
              {!isSidebarCollapsed && <span className="font-display font-black text-2xl text-white tracking-tight">Notify Me</span>}
            </div>
            {!isSidebarCollapsed && currentTenant?.name && (
              <div className="bg-white/5 rounded-xl p-3 border border-white/5 animate-in fade-in slide-in-from-top-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Organization</p>
                <p className="text-xs font-bold text-white truncate uppercase">{currentTenant.name}</p>
              </div>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar pt-4">
            <NavButton active={activeView === 'dashboard'} onClick={() => navigateTo('dashboard')} icon={ICONS.Grid} label="Dashboard" collapsed={isSidebarCollapsed} />
            {profile?.role !== UserRole.SUPER_ADMIN && (
              <>
                <NavButton active={activeView === 'vehicles'} onClick={() => navigateTo('vehicles')} icon={ICONS.Truck} label="Inventory" collapsed={isSidebarCollapsed} />
                <NavButton active={activeView === 'history'} onClick={() => navigateTo('history')} icon={ICONS.List} label="History" collapsed={isSidebarCollapsed} />
              </>
            )}
            {(profile?.role === UserRole.TENANT_ADMIN || profile?.role === UserRole.TENANT_MANAGER) && (
              <NavButton active={activeView === 'automation'} onClick={() => navigateTo('automation')} icon={ICONS.Bell} label="Alerts" collapsed={isSidebarCollapsed} />
            )}
            {profile?.role === UserRole.TENANT_ADMIN && (
              <>
                <NavButton active={activeView === 'team'} onClick={() => navigateTo('team')} icon={ICONS.Table} label="Team" collapsed={isSidebarCollapsed} />
                <NavButton active={activeView === 'subscription'} onClick={() => navigateTo('subscription')} icon={ICONS.Check} label="Subscription" collapsed={isSidebarCollapsed} />
              </>
            )}
          </nav>

          <div className={`p-6 border-t border-white/5 space-y-2 ${isSidebarCollapsed ? 'p-4' : ''}`}>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all rounded-xl ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
              {isDarkMode ? <ICONS.Sun className="w-4 h-4 shrink-0" /> : <ICONS.Moon className="w-4 h-4 shrink-0" />}
              {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Theme</span>}
            </button>
            <button onClick={() => setIsSignOutModalOpen(true)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all rounded-xl ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
              <ICONS.Plus className="w-4 h-4 rotate-45 shrink-0" />
              {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 transition-all duration-300 custom-scrollbar safe-pb">
          <div className="max-w-6xl mx-auto pb-12">
            {profile?.role === UserRole.SUPER_ADMIN ? (
              <SuperAdminView 
                tenants={allTenants} 
                logs={logs} 
                onTenantUpdate={() => fetchTenantData(session.user.id, true)} 
                onDeleteTenant={async (id) => { 
                  try {
                    const { error } = await supabase.from('tenants').delete().eq('id', id); 
                    if (error) throw error;
                    fetchTenantData(session.user.id, true); 
                  } catch(e: any) {
                    console.error('Purge error:', e);
                    addToast('Delete Error', 'Failed to remove tenant workspace.', 'error');
                  }
                }} 
                userRole={profile?.role} 
              />
            ) : (
              <>
                {activeView === 'dashboard' && <Dashboard vehicles={vehicles} records={records} automationConfig={automationConfig} onViewVehicle={(id) => { setSelectedVehicleId(id); setActiveView('detail'); }} onNavigateFleet={(f) => { setVehicleFilter(f); setActiveView('vehicles'); }} onNavigateAutomation={() => setActiveView('automation')} userRole={profile?.role} tenant={currentTenant || undefined} onUpgrade={() => setActiveView('subscription')} />}
                {activeView === 'vehicles' && <VehicleList vehicles={vehicles} records={records} vehicleMakes={vehicleMakes} userRole={profile?.role} tenantPlan={currentTenant?.plan} onAdd={addVehicle} onUpdate={updateVehicle} onSelect={(v) => { setSelectedVehicleId(v.id); setActiveView('detail'); }} initialFilter={vehicleFilter} onClearFilter={() => setVehicleFilter(null)} onDelete={async (id) => { try { const tid = profile?.tenant_id; if(!tid) return; const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('tenant_id', tid); if (error) throw error; fetchTenantData(session.user.id, true); } catch(e: any) { console.error('Vehicle deletion error:', e); addToast('Delete Error', 'Failed to remove vehicle.', 'error'); } }} onUpgradeRedirect={() => setActiveView('subscription')} />}
                {activeView === 'detail' && selectedVehicleId && <VehicleDetail vehicle={vehicles.find(v => v.id === selectedVehicleId)!} vehicleMakes={vehicleMakes} records={records.filter(r => r.vehicleId === selectedVehicleId)} userRole={profile?.role} onUpdateVehicle={updateVehicle} onUpdateRecord={updateRecord} onDeleteVehicle={async (id) => { try { const tid = profile?.tenant_id; if(!tid) return; const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('tenant_id', tid); if (error) throw error; setActiveView('vehicles'); fetchTenantData(session.user.id, true); } catch(e: any) { console.error('Asset purge error:', e); addToast('Purge Error', 'Could not delete asset records.', 'error'); } }} onBack={() => setActiveView('vehicles')} />}
                {activeView === 'team' && <TeamManagement tenantId={profile?.tenant_id || ''} tenantName={currentTenant?.name} users={teamUsers} onRefresh={() => fetchTenantData(session.user.id, true)} addToast={addToast} userRole={profile?.role} />}
                {activeView === 'subscription' && <SubscriptionPage tenant={currentTenant} vehicleCount={vehicles.length} onUpgrade={() => fetchTenantData(session.user.id, true)} />}
                {activeView === 'automation' && <AutomationSettings config={automationConfig} loading={automationLoading} vehicleMakes={vehicleMakes} onUpdate={updateAutomation} onAddMake={addVehicleMake} onRemoveMake={removeVehicleMake} />}
                {activeView === 'history' && <ActionHistory logs={logs} />}
              </>
            )}
          </div>
        </main>
      </div>
      <ConfirmationModal isOpen={isSignOutModalOpen} onClose={() => setIsSignOutModalOpen(false)} onConfirm={handleSignOut} title="Sign Out?" message="Are you sure you want to exit your workspace?" confirmText="Logout" />
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label, collapsed }: any) => (
  <button onClick={onClick} className={`w-full flex items-center transition-all duration-300 rounded-2xl relative lg:p-4 p-5 overflow-hidden group ${collapsed ? 'lg:justify-center' : 'lg:gap-4 gap-5'} ${active ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
    {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-full" />}
    <Icon className={`w-5 h-5 shrink-0 transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
    {!collapsed && <span className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap opacity-100 transition-opacity duration-300">{label}</span>}
  </button>
);

export default App;
