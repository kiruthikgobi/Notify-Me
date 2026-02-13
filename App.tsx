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
import { supabase } from './services/supabaseClient';

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
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => 
    document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
  );
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => 
    localStorage.getItem('sidebar_collapsed') === 'true'
  );
  
  const [automationConfig, setAutomationConfig] = useState<GlobalAutomationConfig | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  
  const lastFetchedUserId = useRef<string | null>(null);

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', String(newState));
  };

  const addToast = useCallback((title: string, message: string, type: ToastMessage['type'] = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setCurrentTenant(null);
    setAutomationConfig(null);
    setSyncingIdentity(false);
    lastFetchedUserId.current = null;
    setIsSignOutModalOpen(false);
    setIsMobileMenuOpen(false);
  };

  const fetchTenantData = useCallback(async (userId: string, force: boolean = false) => {
    if (!force && lastFetchedUserId.current === userId && profile) return;
    
    setSyncingIdentity(true);
    lastFetchedUserId.current = userId;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const metaTenantId = user?.user_metadata?.tenant_id;
      const metaRole = user?.user_metadata?.role || UserRole.TENANT_ADMIN;

      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (!profileData && metaTenantId) {
        profileData = {
          id: userId,
          tenant_id: metaTenantId,
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0],
          role: metaRole
        };
        supabase.from('profiles').upsert(profileData).then(({ error }) => { if (error) console.error(error); });
      }
      
      if (!profileData && !metaTenantId && metaRole !== UserRole.SUPER_ADMIN) {
        setSyncingIdentity(false);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      const effectiveTenantId = profileData?.tenant_id || metaTenantId;

      if (effectiveTenantId) {
        const [tRes, vRes, rRes, nRes, lRes, mRes, uRes] = await Promise.allSettled([
          supabase.from('tenants').select('*').eq('id', effectiveTenantId).maybeSingle(),
          supabase.from('vehicles').select('*').eq('tenant_id', effectiveTenantId).order('added_date', { ascending: false }),
          supabase.from('compliance_records').select('*').eq('tenant_id', effectiveTenantId),
          supabase.from('automation_config').select('*').eq('tenant_id', effectiveTenantId).maybeSingle(),
          supabase.from('notification_logs').select('*').eq('tenant_id', effectiveTenantId).order('timestamp', { ascending: false }).limit(100),
          supabase.from('vehicle_makes').select('*').eq('tenant_id', effectiveTenantId).order('name', { ascending: true }),
          supabase.from('profiles').select('*').eq('tenant_id', effectiveTenantId)
        ]);

        if (tRes.status === 'fulfilled' && tRes.value.data) {
          const t = tRes.value.data;
          setCurrentTenant({
            id: t.id, name: t.name, ownerEmail: '', plan: t.plan as SubscriptionPlan, status: t.status as TenantStatus, createdAt: t.created_at, subscriptionExpiry: t.subscription_expiry, paymentId: t.last_payment_id
          });
        }

        if (vRes.status === 'fulfilled' && vRes.value.data) {
          setVehicles(vRes.value.data.map(v => ({
            id: v.id, tenantId: v.tenant_id, registrationNumber: v.registration_number, make: v.make, model: v.model, year: v.year, type: v.type as any, addedDate: v.added_date, isDraft: v.is_draft
          })));
        }

        if (rRes.status === 'fulfilled' && rRes.value.data) {
          setRecords(rRes.value.data.map(r => ({
            id: r.id, tenantId: r.tenant_id, vehicleId: r.vehicle_id, type: r.type as ComplianceType, expiryDate: r.expiry_date || '', lastRenewedDate: r.last_renewed_date || '', isDraft: r.is_draft, sentReminders: r.sent_reminders || [], documentName: r.document_name, documentUrl: r.document_url, alertEnabled: r.alert_enabled !== false, alertDaysBefore: r.alert_days_before || 15
          })));
        }

        if (nRes.status === 'fulfilled' && nRes.value.data) {
          const n = nRes.value.data;
          setAutomationConfig({ 
            tenantId: n.tenant_id, recipients: Array.isArray(n.recipients) ? n.recipients : [], defaultThresholds: Array.isArray(n.default_thresholds) ? n.default_thresholds : [30, 15, 7, 3, 1], enabled: n.enabled !== false, emailTemplate: n.email_template 
          });
        }

        if (lRes.status === 'fulfilled' && lRes.value.data) {
          setLogs(lRes.value.data.map(l => ({
            id: l.id, tenantId: l.tenant_id, vehicleReg: l.vehicle_reg, docType: l.doc_type, recipient: l.recipient, status: l.status as any, timestamp: l.timestamp
          })));
        }

        if (mRes.status === 'fulfilled' && mRes.value.data) {
          setVehicleMakes(mRes.value.data.map(m => ({ id: m.id, tenantId: m.tenant_id, name: m.name })));
        }

        if (uRes.status === 'fulfilled' && uRes.value.data) {
          setTeamUsers(uRes.value.data);
        }
      }

      if (profileData?.role === UserRole.SUPER_ADMIN) {
        const [stRes, slRes] = await Promise.allSettled([
          supabase.from('tenants').select('*, profiles(full_name, role)'),
          supabase.from('notification_logs').select('*').order('timestamp', { ascending: false }).limit(100)
        ]);
        
        if (stRes.status === 'fulfilled' && stRes.value.data) {
          setAllTenants(stRes.value.data.map(t => ({
            id: t.id, name: t.name, ownerEmail: ((t.profiles as any[]) || []).find(p => p.role === UserRole.TENANT_ADMIN)?.full_name || 'System',
            plan: t.plan as SubscriptionPlan, status: t.status as TenantStatus, createdAt: t.created_at, subscriptionExpiry: t.subscription_expiry
          })));
        }
        
        if (slRes.status === 'fulfilled' && slRes.value.data) {
          setLogs(slRes.value.data.map(l => ({
            id: l.id, tenantId: l.tenant_id, vehicleReg: l.vehicle_reg, docType: l.doc_type, recipient: l.recipient, status: l.status as any, timestamp: l.timestamp
          })));
        }
      }
    } catch (err: any) {
      console.error("Critical Registry Load Error:", err);
      addToast('Sync Error', 'Workspace connection unstable.', 'error');
    } finally {
      setSyncingIdentity(false);
      setLoading(false);
    }
  }, [addToast, profile]);

  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          if (!initialSession) setLoading(false);
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    };
    initializeAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        if (!currentSession) {
          setLoading(false);
          setProfile(null);
          setCurrentTenant(null);
          lastFetchedUserId.current = null;
        }
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { 
    if (session?.user?.id) fetchTenantData(session.user.id); 
  }, [session?.user?.id, fetchTenantData]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    if (isMobileMenuOpen) document.body.classList.add('menu-open');
    else document.body.classList.remove('menu-open');
  }, [isMobileMenuOpen]);

  const onAddVehicle = async (v: Vehicle) => {
    const activeTenantId = profile?.tenant_id || session?.user?.user_metadata?.tenant_id;
    if (!activeTenantId) return;
    
    const dbData = {
      tenant_id: activeTenantId,
      registration_number: (v.registrationNumber || '').toUpperCase().trim(),
      make: v.make,
      model: v.model,
      year: v.year,
      type: v.type,
      added_date: v.addedDate,
      is_draft: !!v.isDraft
    };

    try {
      const { error } = await supabase.from('vehicles').insert(dbData); 
      if (error) {
        addToast('Registry Refused', error.message, 'error');
      } else {
        addToast('Success', 'Asset registered successfully', 'success');
        fetchTenantData(session.user.id, true); 
      }
    } catch (err: any) {
      addToast('System Error', 'Could not access registry.', 'error');
    }
  };

  const onUpdateVehicle = async (v: Vehicle) => {
    const activeTenantId = profile?.tenant_id || session?.user?.user_metadata?.tenant_id;
    if (!activeTenantId) return;

    const dbData = {
      id: v.id,
      tenant_id: activeTenantId,
      registration_number: (v.registrationNumber || '').toUpperCase().trim(),
      make: v.make,
      model: v.model,
      year: v.year,
      type: v.type,
      is_draft: !!v.isDraft
    };

    try {
      const { error } = await supabase.from('vehicles').update(dbData).eq('id', v.id);
      if (error) {
        addToast('Update Refused', error.message, 'error');
      } else {
        addToast('Success', 'Asset updated successfully', 'success');
        fetchTenantData(session.user.id, true);
      }
    } catch (err: any) {
      addToast('System Error', 'Could not sync updates.', 'error');
    }
  };

  const navigateTo = (view: View) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  if (!session && !loading) return <Auth onAuthComplete={() => {}} />;

  if (loading || (session && syncingIdentity && !profile)) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6 text-center">
      <div className="spinner mb-6" />
      <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white mb-2">Notify Me</h2>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Establishing Secure Workspace</p>
    </div>
  );

  const NavItems = () => (
    <>
      <NavButton active={activeView === 'dashboard'} onClick={() => navigateTo('dashboard')} icon={ICONS.Grid} label="Dashboard" collapsed={isSidebarCollapsed} />
      <NavButton active={activeView === 'vehicles'} onClick={() => navigateTo('vehicles')} icon={ICONS.Truck} label="Inventory" collapsed={isSidebarCollapsed} />
      <NavButton active={activeView === 'history'} onClick={() => navigateTo('history')} icon={ICONS.List} label="History" collapsed={isSidebarCollapsed} />
      {(profile?.role === UserRole.TENANT_ADMIN || profile?.role === UserRole.TENANT_MANAGER) && (
        <NavButton active={activeView === 'automation'} onClick={() => navigateTo('automation')} icon={ICONS.Bell} label="Alerts" collapsed={isSidebarCollapsed} />
      )}
      {profile?.role === UserRole.TENANT_ADMIN && (
        <>
          <NavButton active={activeView === 'team'} onClick={() => navigateTo('team')} icon={ICONS.Table} label="Team" collapsed={isSidebarCollapsed} />
          <NavButton active={activeView === 'subscription'} onClick={() => navigateTo('subscription')} icon={ICONS.Check} label="Billing" collapsed={isSidebarCollapsed} />
        </>
      )}
    </>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <Toast toasts={toasts} removeToast={removeToast} />
      
      {/* Mobile Top Header - Ergonomic Trigger on the Left */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-navy-900 dark:bg-black text-white shrink-0 safe-pt border-b border-white/5 z-50 shadow-lg">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors focus:ring-2 focus:ring-primary-500">
          {isMobileMenuOpen ? <ICONS.Plus className="w-6 h-6 rotate-45" /> : <ICONS.Menu className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-3">
          <ICONS.Logo className="w-7 h-7" />
          <span className="font-display font-black text-lg tracking-tight">Notify Me</span>
        </div>
        <div className="w-10"></div> {/* Spacer for symmetry */}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar - Premium Left Navigation */}
        <aside className={`hidden lg:flex ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-navy-900 dark:bg-black border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 relative`}>
          <button onClick={toggleSidebar} className="absolute -right-3 top-10 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-500 transition-colors z-[60]">
            <ICONS.ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
          <div className={`p-8 flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? 'justify-center p-6' : ''}`}>
            <ICONS.Logo className="w-8 h-8 text-primary-500 shrink-0" />
            {!isSidebarCollapsed && <span className="font-display font-black text-2xl text-white tracking-tight">Notify Me</span>}
          </div>
          <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
            <NavItems />
          </nav>
          <div className={`p-6 border-t border-white/5 space-y-2 ${isSidebarCollapsed ? 'p-4' : ''}`}>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all rounded-xl ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
              {isDarkMode ? <ICONS.Sun className="w-4 h-4 shrink-0" /> : <ICONS.Moon className="w-4 h-4 shrink-0" />}
              {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Theme</span>}
            </button>
            <button onClick={() => setIsSignOutModalOpen(true)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all rounded-xl ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
              <ICONS.Plus className="w-4 h-4 rotate-45 shrink-0" />
              {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Logout</span>}
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay - Slides in from LEFT to match desktop side */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[100]">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-sm bg-navy-900 dark:bg-black text-white p-6 shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
              <div className="flex items-center justify-between mb-10 px-2">
                <div className="flex items-center gap-3">
                  <ICONS.Logo className="w-8 h-8" />
                  <span className="font-display font-black text-2xl tracking-tight">Notify Me</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10">
                  <ICONS.Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <nav className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                <NavItems />
              </nav>
              <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
                 <button onClick={() => { setIsDarkMode(!isDarkMode); setIsMobileMenuOpen(false); }} className="w-full flex items-center justify-between px-5 py-5 text-slate-400 hover:text-white bg-white/5 rounded-2xl transition-all">
                  <div className="flex items-center gap-4">
                    {isDarkMode ? <ICONS.Sun className="w-5 h-5 shrink-0" /> : <ICONS.Moon className="w-5 h-5 shrink-0" />}
                    <span className="font-bold text-sm tracking-wide">Change Theme</span>
                  </div>
                </button>
                <button onClick={() => { setIsSignOutModalOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-4 px-5 py-5 text-red-400 hover:text-red-300 bg-red-500/10 rounded-2xl transition-all font-black text-xs tracking-widest uppercase">
                  <ICONS.Plus className="w-5 h-5 rotate-45 shrink-0" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 transition-all duration-300 custom-scrollbar safe-pb">
          <div className="max-w-6xl mx-auto pb-12">
            {profile?.role === UserRole.SUPER_ADMIN ? (
              <SuperAdminView tenants={allTenants} logs={logs} onTenantUpdate={() => fetchTenantData(session.user.id, true)} onDeleteTenant={async (id) => { 
                await supabase.from('tenants').delete().eq('id', id); fetchTenantData(session.user.id, true); 
              }} userRole={profile?.role} />
            ) : (
              <>
                {activeView === 'dashboard' && <Dashboard vehicles={vehicles} records={records} onViewVehicle={(id) => { setSelectedVehicleId(id); setActiveView('detail'); }} onNavigateFleet={() => setActiveView('vehicles')} userRole={profile?.role} tenant={currentTenant || undefined} onUpgrade={() => setActiveView('subscription')} />}
                {activeView === 'vehicles' && <VehicleList vehicles={vehicles} records={records} vehicleMakes={vehicleMakes} userRole={profile?.role} tenantPlan={currentTenant?.plan} onAdd={onAddVehicle} onUpdate={onUpdateVehicle} onSelect={(v) => { setSelectedVehicleId(v.id); setActiveView('detail'); }} onDelete={async (id) => { await supabase.from('vehicles').delete().eq('id', id); fetchTenantData(session.user.id, true); }} onUpgradeRedirect={() => setActiveView('subscription')} />}
                {activeView === 'detail' && selectedVehicleId && <VehicleDetail vehicle={vehicles.find(v => v.id === selectedVehicleId)!} vehicleMakes={vehicleMakes} records={records.filter(r => r.vehicleId === selectedVehicleId)} userRole={profile?.role} onUpdateVehicle={onUpdateVehicle} onUpdateRecord={async (r) => { 
                  const activeTenantId = profile?.tenant_id || session?.user?.user_metadata?.tenant_id;
                  if (!activeTenantId) return;
                  const dbData = {
                    id: r.id,
                    tenant_id: activeTenantId,
                    vehicle_id: r.vehicleId,
                    type: r.type,
                    expiry_date: r.expiryDate,
                    last_renewed_date: r.lastRenewedDate,
                    document_name: r.documentName,
                    document_url: r.documentUrl,
                    alert_enabled: r.alertEnabled,
                    alert_days_before: r.alertDaysBefore,
                    is_draft: !!r.isDraft
                  };
                  await supabase.from('compliance_records').upsert(dbData); 
                  fetchTenantData(session.user.id, true); 
                }} onDeleteVehicle={async (id) => { await supabase.from('vehicles').delete().eq('id', id); setActiveView('vehicles'); fetchTenantData(session.user.id, true); }} onBack={() => setActiveView('vehicles')} />}
                {activeView === 'team' && <TeamManagement tenantId={profile?.tenant_id || ''} users={teamUsers} onRefresh={() => fetchTenantData(session.user.id, true)} addToast={addToast} userRole={profile?.role} />}
                {activeView === 'subscription' && (
                  currentTenant 
                  ? <SubscriptionPage tenant={currentTenant} vehicleCount={vehicles.length} onUpgrade={() => fetchTenantData(session.user.id, true)} /> 
                  : <div className="p-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-xs">Connecting Billing Registry...</div>
                )}
                {activeView === 'automation' && (
                  automationConfig 
                  ? <AutomationSettings 
                      config={automationConfig} 
                      vehicleMakes={vehicleMakes} 
                      onUpdate={async (c) => { 
                        const activeTenantId = profile?.tenant_id || session?.user?.user_metadata?.tenant_id;
                        if (!activeTenantId) return;
                        const dbData = {
                          tenant_id: activeTenantId,
                          recipients: c.recipients,
                          default_thresholds: c.defaultThresholds,
                          enabled: c.enabled,
                          email_template: c.emailTemplate
                        };
                        await supabase.from('automation_config').upsert(dbData); 
                        fetchTenantData(session.user.id, true); 
                      }} 
                      onAddMake={async (name) => { 
                        const activeTenantId = profile?.tenant_id || session?.user?.user_metadata?.tenant_id;
                        if (!activeTenantId) return;
                        await supabase.from('vehicle_makes').insert({ tenant_id: activeTenantId, name }); 
                        fetchTenantData(session.user.id, true); 
                      }} 
                      onRemoveMake={async (id) => { 
                        await supabase.from('vehicle_makes').delete().eq('id', id); 
                        fetchTenantData(session.user.id, true); 
                      }} 
                    />
                  : <div className="p-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Alert Protocols...</div>
                )}
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
    {/* Active Indicator Bar */}
    {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-full" />}
    
    <Icon className={`w-5 h-5 shrink-0 transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
    <span className={`font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${collapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'}`}>{label}</span>
  </button>
);

export default App;