
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
import PlanLimitModal from './components/PlanLimitModal';
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingIdentity, setSyncingIdentity] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => 
    document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
  );
  
  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => 
    localStorage.getItem('sidebar_collapsed') === 'true'
  );
  
  const [automationConfig, setAutomationConfig] = useState<GlobalAutomationConfig | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  
  const retryTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCount = useRef(0);
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
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setCurrentTenant(null);
    setSyncingIdentity(false);
    lastFetchedUserId.current = null;
    retryCount.current = 0;
    setIsSignOutModalOpen(false);
  };

  const fetchTenantData = useCallback(async (userId: string, force: boolean = false) => {
    if (!force && lastFetchedUserId.current === userId && profile) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setSyncingIdentity(true);
    lastFetchedUserId.current = userId;
    
    try {
      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (pError) throw pError;

      let activeProfile = profileData;

      if (!activeProfile) {
        if (retryCount.current < 3) { 
          retryCount.current += 1;
          retryTimeoutRef.current = setTimeout(() => fetchTenantData(userId, force), 1500);
          return;
        } else {
          const { data: repairData, error: rError } = await supabase
            .from('profiles')
            .upsert({ id: userId, full_name: 'Fleet Manager', role: UserRole.TENANT_ADMIN })
            .select().maybeSingle();
          if (rError || !repairData) { setSyncingIdentity(false); setLoading(false); return; }
          activeProfile = repairData;
        }
      }
      
      setProfile(activeProfile);
      retryCount.current = 0;

      if (activeProfile.tenant_id) {
        const { data: tenantData } = await supabase.from('tenants').select('*').eq('id', activeProfile.tenant_id).single();
        if (tenantData) {
          const now = new Date();
          const expiryDate = tenantData.subscription_expiry ? new Date(tenantData.subscription_expiry) : null;
          let effectivePlan = (tenantData.plan || SubscriptionPlan.FREE) as SubscriptionPlan;
          if (effectivePlan === SubscriptionPlan.PRO && expiryDate && expiryDate < now) {
            effectivePlan = SubscriptionPlan.FREE;
            addToast('Plan Expired', 'Subscription ended. Access reverted to Free tier.', 'warning');
          }
          setCurrentTenant({
            id: tenantData.id,
            name: tenantData.name,
            ownerEmail: session?.user?.email || '',
            plan: effectivePlan,
            status: tenantData.status as TenantStatus,
            createdAt: tenantData.created_at,
            subscriptionExpiry: tenantData.subscription_expiry,
            paymentId: tenantData.last_payment_id
          });
        }
        
        const { data: team } = await supabase.from('profiles').select('*').eq('tenant_id', activeProfile.tenant_id).neq('id', userId);
        setTeamUsers(team || []);
      }

      if (activeProfile.role === UserRole.SUPER_ADMIN) {
        const [tRes, lRes] = await Promise.all([
          supabase.from('tenants').select('*, profiles(full_name, role)').order('created_at', { ascending: false }),
          supabase.from('notification_logs').select('*').order('timestamp', { ascending: false }).limit(200)
        ]);
        setAllTenants((tRes.data || []).map(t => ({
          id: t.id, name: t.name, ownerEmail: ((t.profiles as any[]) || []).find(p => p.role === UserRole.TENANT_ADMIN)?.full_name || 'System',
          plan: t.plan as SubscriptionPlan, status: t.status as TenantStatus, createdAt: t.created_at, subscriptionExpiry: t.subscription_expiry
        })));
        setLogs((lRes.data || []).map(l => ({
          id: l.id, tenantId: l.tenant_id, vehicleReg: (l.vehicle_reg || '').toUpperCase(), docType: l.doc_type, recipient: l.recipient, status: l.status as any, timestamp: l.timestamp
        })));
      } else if (activeProfile.tenant_id) {
        const [vRes, rRes, cRes, lRes, mRes] = await Promise.all([
          supabase.from('vehicles').select('*').eq('tenant_id', activeProfile.tenant_id).order('added_date', { ascending: false }),
          supabase.from('compliance_records').select('*').eq('tenant_id', activeProfile.tenant_id).order('type', { ascending: true }),
          supabase.from('automation_config').select('*').eq('tenant_id', activeProfile.tenant_id).maybeSingle(),
          supabase.from('notification_logs').select('*').eq('tenant_id', activeProfile.tenant_id).order('timestamp', { ascending: false }).limit(100),
          supabase.from('vehicle_makes').select('*').eq('tenant_id', activeProfile.tenant_id).order('name', { ascending: true })
        ]);
        setVehicles((vRes.data || []).map(v => ({
          id: v.id, tenantId: v.tenant_id, registrationNumber: (v.registration_number || '').toUpperCase(), make: v.make, model: v.model, year: v.year, type: v.type as any, addedDate: v.added_date, isDraft: v.is_draft
        })));
        setRecords((rRes.data || []).map(r => ({
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
          alertDaysBefore: r.alert_days_before || 15,
          lastAlertSentDate: r.last_alert_sent_date
        })));
        setLogs((lRes.data || []).map(l => ({
          id: l.id, tenantId: l.tenant_id, vehicleReg: (l.vehicle_reg || '').toUpperCase(), docType: l.doc_type, recipient: l.recipient, status: l.status as any, timestamp: l.timestamp
        })));
        setVehicleMakes((mRes.data || []).map(m => ({
          id: m.id, tenantId: m.tenant_id, name: m.name
        })));
        if (cRes.data) {
          setAutomationConfig({ tenantId: cRes.data.tenant_id, recipients: cRes.data.recipients, defaultThresholds: cRes.data.default_thresholds, enabled: cRes.data.enabled, emailTemplate: cRes.data.email_template });
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Data Load Error:", err);
    } finally {
      setSyncingIdentity(false);
      setLoading(false);
    }
  }, [addToast, session?.user?.email, profile]);

  const handleUpgradeToPro = async () => {
    if (!profile?.tenant_id) return;
    
    const options = {
      key: "rzp_test_placeholder_key",
      amount: 9900,
      currency: "INR",
      name: "Notify Me Fleet",
      description: "Enterprise Subscription (1 Year)",
      handler: async function (response: any) {
        if (response.razorpay_payment_id) {
          try {
            const { error } = await supabase
              .from('tenants')
              .update({ 
                plan: SubscriptionPlan.PRO,
                subscription_expiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
                last_payment_id: response.razorpay_payment_id
              })
              .eq('id', profile.tenant_id);

            if (error) throw error;
            
            addToast('Payment Successful', 'Welcome to Notify Me Pro!', 'success');
            if (session?.user?.id) fetchTenantData(session.user.id, true);
            setActiveView('dashboard');
          } catch (err: any) {
            addToast('Provisioning Error', 'Payment received but plan update failed.', 'error');
          }
        }
      },
      prefill: {
        name: profile.full_name,
        email: session?.user?.email,
      },
      theme: {
        color: "#2563eb",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) { setSession(initialSession); if (!initialSession) setLoading(false); }
      } catch (err: any) { console.error("Init Auth Error:", err); }
    };
    initializeAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) { setSession(currentSession); if (!currentSession) { setLoading(false); setProfile(null); lastFetchedUserId.current = null; } }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (session?.user?.id) fetchTenantData(session.user.id); }, [session?.user?.id, fetchTenantData]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  if (!session && !loading) return <Auth onAuthComplete={() => {}} />;

  if (loading || (session && syncingIdentity && !profile)) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6 text-center">
      <div className="spinner mb-6" />
      <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white mb-2">Notify Me</h2>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Registry</p>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <Toast toasts={toasts} removeToast={removeToast} />
      <div className="flex-1 flex overflow-hidden">
        <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-navy-900 dark:bg-black border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 relative`}>
          
          {/* Sidebar Toggle Button */}
          <button 
            onClick={toggleSidebar}
            className="absolute -right-3 top-10 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-500 transition-colors z-50"
          >
            <ICONS.ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>

          <div className={`p-8 flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? 'justify-center p-6' : ''}`}>
            <ICONS.Logo className="w-8 h-8 text-primary-500 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="font-display font-black text-2xl text-white tracking-tight animate-in fade-in slide-in-from-left-2">
                Notify Me
              </span>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
            <NavButton 
              active={activeView === 'dashboard'} 
              onClick={() => setActiveView('dashboard')} 
              icon={ICONS.Grid} 
              label="Dashboard" 
              collapsed={isSidebarCollapsed} 
            />
            <NavButton 
              active={activeView === 'vehicles'} 
              onClick={() => setActiveView('vehicles')} 
              icon={ICONS.Truck} 
              label="Inventory" 
              collapsed={isSidebarCollapsed} 
            />
            <NavButton 
              active={activeView === 'history'} 
              onClick={() => setActiveView('history')} 
              icon={ICONS.List} 
              label="History" 
              collapsed={isSidebarCollapsed} 
            />
            {profile?.role === UserRole.TENANT_ADMIN && (
              <>
                <NavButton 
                  active={activeView === 'automation'} 
                  onClick={() => setActiveView('automation')} 
                  icon={ICONS.Bell} 
                  label="Alerts" 
                  collapsed={isSidebarCollapsed} 
                />
                <NavButton 
                  active={activeView === 'team'} 
                  onClick={() => setActiveView('team')} 
                  icon={ICONS.Table} 
                  label="Team" 
                  collapsed={isSidebarCollapsed} 
                />
                <NavButton 
                  active={activeView === 'subscription'} 
                  onClick={() => setActiveView('subscription')} 
                  icon={ICONS.Check} 
                  label="Billing" 
                  collapsed={isSidebarCollapsed} 
                />
              </>
            )}
          </nav>

          <div className={`p-6 border-t border-white/5 space-y-2 ${isSidebarCollapsed ? 'p-4' : ''}`}>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              title="Toggle Theme"
              className={`w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors rounded-xl ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            >
              {isDarkMode ? <ICONS.Sun className="w-4 h-4 shrink-0" /> : <ICONS.Moon className="w-4 h-4 shrink-0" />}
              {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap animate-in fade-in">Theme</span>}
            </button>
            <button 
              onClick={() => setIsSignOutModalOpen(true)} 
              title="Logout"
              className={`w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 transition-colors rounded-xl ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
            >
              <ICONS.Plus className="w-4 h-4 rotate-45 shrink-0" />
              {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap animate-in fade-in">Logout</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 lg:p-12 transition-all duration-300">
          <div className="max-w-6xl mx-auto">
            {profile?.role === UserRole.SUPER_ADMIN ? (
              <SuperAdminView tenants={allTenants} logs={logs} onTenantUpdate={() => fetchTenantData(session.user.id, true)} onDeleteTenant={async (id) => { 
                await supabase.from('tenants').delete().eq('id', id); 
                fetchTenantData(session.user.id, true); 
              }} userRole={profile?.role} />
            ) : (
              <>
                {activeView === 'dashboard' && currentTenant && (<Dashboard vehicles={vehicles} records={records} onViewVehicle={(id) => { setSelectedVehicleId(id); setActiveView('detail'); }} onNavigateFleet={() => setActiveView('vehicles')} userRole={profile?.role} tenant={currentTenant} onUpgrade={() => setActiveView('subscription')} />)}
                {activeView === 'vehicles' && currentTenant && (
                  <VehicleList 
                    vehicles={vehicles} records={records} vehicleMakes={vehicleMakes} userRole={profile?.role} tenantPlan={currentTenant.plan}
                    onAdd={async (v) => { 
                      const { error } = await supabase.from('vehicles').insert({ tenant_id: profile.tenant_id, ...v }); 
                      if (!error) fetchTenantData(session.user.id, true);
                    }} 
                    onSelect={(v) => { setSelectedVehicleId(v.id); setActiveView('detail'); }} 
                    onDelete={async (id) => { await supabase.from('vehicles').delete().eq('id', id); fetchTenantData(session.user.id, true); }} 
                    onUpgradeRedirect={() => setActiveView('subscription')} 
                  />
                )}
                {activeView === 'detail' && selectedVehicleId && (
                  <VehicleDetail 
                    vehicle={vehicles.find(v => v.id === selectedVehicleId)!} 
                    records={records.filter(r => r.vehicleId === selectedVehicleId)} 
                    userRole={profile?.role} 
                    onUpdateRecord={async (r) => { await supabase.from('compliance_records').upsert({ tenant_id: profile.tenant_id, ...r }); fetchTenantData(session.user.id, true); }} 
                    onDeleteVehicle={async (id) => { await supabase.from('vehicles').delete().eq('id', id); setActiveView('vehicles'); fetchTenantData(session.user.id, true); }} 
                    onBack={() => setActiveView('vehicles')} 
                  />
                )}
                {activeView === 'team' && (<TeamManagement tenantId={profile.tenant_id} users={teamUsers} onRefresh={() => fetchTenantData(session.user.id, true)} addToast={addToast} userRole={profile?.role} />)}
                {activeView === 'subscription' && currentTenant && (<SubscriptionPage tenant={currentTenant} vehicleCount={vehicles.length} onUpgrade={handleUpgradeToPro} />)}
                {activeView === 'automation' && automationConfig && (<AutomationSettings config={automationConfig} vehicleMakes={vehicleMakes} onUpdate={async (c) => { await supabase.from('automation_config').update(c).eq('tenant_id', profile.tenant_id); fetchTenantData(session.user.id, true); }} onAddMake={async (name) => { await supabase.from('vehicle_makes').insert({ tenant_id: profile.tenant_id, name }); fetchTenantData(session.user.id, true); }} onRemoveMake={async (id) => { await supabase.from('vehicle_makes').delete().eq('id', id); fetchTenantData(session.user.id, true); }} />)}
                {activeView === 'history' && (<ActionHistory logs={logs} />)}
              </>
            )}
          </div>
        </main>
      </div>
      <ConfirmationModal isOpen={isSignOutModalOpen} onClose={() => setIsSignOutModalOpen(false)} onConfirm={handleSignOut} title="Sign Out?" message="Are you sure you want to exit?" confirmText="Logout" />
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label, collapsed }: any) => (
  <button 
    onClick={onClick} 
    title={collapsed ? label : undefined}
    className={`w-full flex items-center transition-all duration-300 rounded-2xl relative group ${collapsed ? 'justify-center px-0 py-4' : 'gap-4 px-5 py-4'} ${active ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
  >
    <Icon className={`w-5 h-5 shrink-0 transition-transform ${active && collapsed ? 'scale-110' : ''}`} />
    {!collapsed && (
      <span className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap animate-in fade-in slide-in-from-left-2 overflow-hidden">
        {label}
      </span>
    )}
    {collapsed && active && (
      <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full animate-in fade-in" />
    )}
  </button>
);

export default App;
