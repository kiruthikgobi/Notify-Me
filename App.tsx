
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

// Database mapping helpers
const mapVehicleFromDB = (v: any): Vehicle => ({
  id: v.id,
  tenantId: v.tenant_id,
  registrationNumber: v.registration_number,
  make: v.make,
  model: v.model,
  year: v.year,
  type: v.type,
  addedDate: v.added_date,
  isDraft: v.is_draft
});

const mapRecordFromDB = (r: any): ComplianceRecord => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  tenantId: r.tenant_id,
  type: r.type as ComplianceType,
  expiryDate: r.expiry_date || '',
  lastRenewedDate: r.last_renewed_date || '',
  documentName: r.document_name,
  documentUrl: r.document_url,
  alertEnabled: r.alert_enabled !== false,
  alertDaysBefore: r.alert_days_before || 15,
  isDraft: r.is_draft,
  sentReminders: r.sent_reminders || []
});

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
  const [syncError, setSyncError] = useState<string | null>(null);
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
    if (view !== 'vehicles') setVehicleFilter(null);
  };

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await (supabase.auth as any).signOut();
    } catch (e) {
      console.error('Signout exception:', e);
    } finally {
      setSession(null);
      setProfile(null);
      setSyncError(null);
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

  const fetchTenantData = useCallback(async (userId: string, force: boolean = false) => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    if (!force && lastFetchedUserId.current === userId && profile) {
      setLoading(false);
      return;
    }
    
    setSyncingIdentity(true);
    setSyncError(null);
    setAutomationLoading(true);
    lastFetchedUserId.current = userId;
    
    try {
      let pData = null;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        if (attempts > 0) {
          await new Promise(r => setTimeout(r, 800 * attempts));
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (error) console.warn(`Sync Attempt ${attempts + 1} Error:`, error);
        
        pData = data;
        attempts++;

        if (pData && (pData.role === UserRole.SUPER_ADMIN || pData.tenant_id)) {
          break;
        }

        if (pData && !pData.tenant_id && pData.role !== UserRole.SUPER_ADMIN) {
          pData = null;
        }
      }

      if (!pData) {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (user && user.user_metadata) {
          const { role, tenant_id, full_name } = user.user_metadata;
          if (role || tenant_id) {
             const { data: healed, error: healError } = await supabase.from('profiles').upsert({
               id: user.id,
               email: user.email,
               role: role || UserRole.TENANT_ADMIN,
               tenant_id: tenant_id,
               full_name: full_name || user.email?.split('@')[0],
               updated_at: new Date().toISOString()
             }).select().single();
             
             if (!healError && healed) {
               pData = healed;
             }
          }
        }
      }

      if (!pData) {
        setProfile(null);
        setSyncError('Identity registry connection timed out.');
        setLoading(false);
        setSyncingIdentity(false);
        return;
      }

      setProfile(pData);
      const tid = pData.tenant_id;
      const isSuper = pData.role === UserRole.SUPER_ADMIN;

      if (isSuper) {
        const [tenantsRes, logsRes] = await Promise.all([
          supabase.from('tenants').select('*'),
          supabase.from('notification_logs').select('*').order('timestamp', { ascending: false }).limit(100)
        ]);
        if (tenantsRes.data) {
          setAllTenants(tenantsRes.data.map((t: any) => ({
            id: t.id, name: t.name, ownerEmail: 'System',
            plan: t.plan as SubscriptionPlan, status: t.status as TenantStatus, createdAt: t.created_at, subscriptionExpiry: t.subscription_expiry
          })));
        }
        if (logsRes.data) {
          setLogs(logsRes.data.map((l: any) => ({
            id: l.id, tenantId: l.tenant_id, vehicleReg: l.vehicle_reg, docType: l.doc_type, recipient: l.recipient, status: l.status, timestamp: l.timestamp
          })));
        }
      }

      if (tid) {
        const [tRes, vRes, rRes, nRes, mRes, uRes] = await Promise.allSettled([
          supabase.from('tenants').select('*').eq('id', tid).maybeSingle(),
          supabase.from('vehicles').select('*').eq('tenant_id', tid).order('added_date', { ascending: false }),
          supabase.from('compliance_records').select('*').eq('tenant_id', tid),
          supabase.from('automation_config').select('*').eq('tenant_id', tid).maybeSingle(),
          supabase.from('vehicle_makes').select('*').eq('tenant_id', tid).order('name', { ascending: true }),
          supabase.from('profiles').select('*').eq('tenant_id', tid)
        ]);

        if (tRes.status === 'fulfilled' && tRes.value.data) {
          const t = tRes.value.data;
          setCurrentTenant({
            id: t.id, name: t.name, ownerEmail: '', plan: t.plan, status: t.status, createdAt: t.created_at, subscriptionExpiry: t.subscription_expiry
          });
        }
        if (vRes.status === 'fulfilled' && vRes.value.data) {
          setVehicles(vRes.value.data.map(mapVehicleFromDB));
        }
        if (rRes.status === 'fulfilled' && rRes.value.data) {
          setRecords(rRes.value.data.map(mapRecordFromDB));
        }
        if (nRes.status === 'fulfilled') setAutomationConfig(nRes.value.data);
        if (mRes.status === 'fulfilled') setVehicleMakes(mRes.value.data || []);
        if (uRes.status === 'fulfilled') setTeamUsers(uRes.value.data || []);
      }
    } catch (e) {
      console.error('Data sync error:', e);
      setSyncError('Platform sync failed.');
    } finally {
      setLoading(false);
      setSyncingIdentity(false);
      setAutomationLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchTenantData(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchTenantData(session.user.id);
      else {
        setProfile(null);
        setCurrentTenant(null);
        setVehicles([]);
        setRecords([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchTenantData]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleAddVehicle = async (vehicle: Vehicle) => {
    const { data, error } = await supabase.from('vehicles').insert({
      registration_number: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      type: vehicle.type,
      added_date: vehicle.addedDate,
      is_draft: vehicle.isDraft,
      tenant_id: profile.tenant_id
    }).select().single();
    if (!error && data) {
      setVehicles(prev => [mapVehicleFromDB(data), ...prev]);
      addToast('Vehicle Added', `${vehicle.registrationNumber} is now registered.`);
    }
  };

  const handleUpdateVehicle = async (vehicle: Vehicle) => {
    const { error } = await supabase.from('vehicles').update({
      registration_number: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      type: vehicle.type,
      is_draft: vehicle.isDraft
    }).eq('id', vehicle.id);
    if (!error) {
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? vehicle : v));
      addToast('Vehicle Updated', 'Changes saved successfully.');
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (!error) {
      setVehicles(prev => prev.filter(v => v.id !== id));
      setRecords(prev => prev.filter(r => r.vehicleId !== id));
      setActiveView('vehicles');
      addToast('Vehicle Removed', 'The asset and its records were deleted.', 'warning');
    }
  };

  const handleUpdateRecord = async (record: ComplianceRecord) => {
    const isTemp = String(record.id).startsWith('temp-');
    const dbPayload = {
      vehicle_id: record.vehicleId,
      type: record.type,
      expiry_date: record.expiryDate || null,
      last_renewed_date: record.lastRenewedDate || null,
      document_name: record.documentName,
      document_url: record.documentUrl,
      alert_enabled: record.alertEnabled,
      alert_days_before: record.alertDaysBefore,
      is_draft: record.isDraft,
      tenant_id: profile.tenant_id
    };

    if (isTemp) {
      const { data, error } = await supabase.from('compliance_records').insert(dbPayload).select().single();
      if (!error && data) setRecords(prev => [...prev, mapRecordFromDB(data)]);
    } else {
      const { error } = await supabase.from('compliance_records').update(dbPayload).eq('id', record.id);
      if (!error) setRecords(prev => prev.map(r => r.id === record.id ? record : r));
    }
    addToast('Record Updated', `Compliance data for ${record.type} updated.`);
  };

  const handleUpdateAutomation = async (config: GlobalAutomationConfig) => {
    const { error } = await supabase.from('automation_config').upsert({
      recipients: config.recipients,
      default_thresholds: config.defaultThresholds,
      enabled: config.enabled,
      tenant_id: profile.tenant_id
    });
    if (!error) {
      setAutomationConfig(config);
      addToast('Settings Saved', 'Alert configuration updated.');
    }
  };

  const handleAddMake = async (name: string) => {
    const { data, error } = await supabase.from('vehicle_makes').insert({
      name,
      tenant_id: profile.tenant_id
    }).select().single();
    if (!error && data) setVehicleMakes(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
  };

  const handleRemoveMake = async (id: string) => {
    const { error } = await supabase.from('vehicle_makes').delete().eq('id', id);
    if (!error) setVehicleMakes(prev => prev.filter(m => m.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Auth onAuthComplete={() => {}} />;

  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex`}>
      <Toast toasts={toasts} removeToast={removeToast} />
      <ConfirmationModal isOpen={isSignOutModalOpen} onClose={() => setIsSignOutModalOpen(false)} onConfirm={handleSignOut} title="Sign Out?" message="Are you sure you want to end your session?" />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10 overflow-hidden">
            <ICONS.Logo className="w-8 h-8 shrink-0 text-primary-600" />
            {!isSidebarCollapsed && <span className="font-display font-black text-xl tracking-tighter">NOTIFY ME</span>}
          </div>

          <nav className="flex-1 space-y-1">
            {[
              { id: 'dashboard', label: 'Overview', icon: ICONS.Grid },
              { id: 'vehicles', label: 'Fleet', icon: ICONS.Truck },
              { id: 'automation', label: 'Alerts', icon: ICONS.Bell },
              { id: 'team', label: 'Team', icon: ICONS.Plus },
              { id: 'history', label: 'History', icon: ICONS.FileText },
              { id: 'subscription', label: 'Billing', icon: ICONS.Check }
            ].map(item => (
              <button key={item.id} onClick={() => navigateTo(item.id as View)} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-bold transition-all ${activeView === item.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span className="text-xs uppercase tracking-widest">{item.label}</span>}
              </button>
            ))}
            {profile?.role === UserRole.SUPER_ADMIN && (
              <button onClick={() => navigateTo('tenants')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-bold transition-all ${activeView === 'tenants' ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>
                <ICONS.Grid className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span className="text-xs uppercase tracking-widest">Admin Root</span>}
              </button>
            )}
          </nav>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-4 px-4 py-3.5 text-slate-400 hover:text-slate-600 transition-all">
              {isDarkMode ? <ICONS.Sun className="w-5 h-5" /> : <ICONS.Moon className="w-5 h-5" />}
              {!isSidebarCollapsed && <span className="text-xs uppercase font-bold tracking-widest">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
            <button onClick={() => setIsSignOutModalOpen(true)} className="w-full flex items-center gap-4 px-4 py-3.5 text-red-400 hover:text-red-600 transition-all">
              <ICONS.Plus className="w-5 h-5 rotate-45" />
              {!isSidebarCollapsed && <span className="text-xs uppercase font-bold tracking-widest">Log Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} p-4 md:p-10 pt-20 md:pt-10`}>
        <div className="md:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 z-40">
           <ICONS.Logo className="w-6 h-6 text-primary-600" />
           <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><ICONS.Menu className="w-5 h-5" /></button>
        </div>

        {activeView === 'dashboard' && (
          <Dashboard vehicles={vehicles} records={records} automationConfig={automationConfig} onViewVehicle={id => { setSelectedVehicleId(id); setActiveView('detail'); }} onNavigateFleet={f => { setVehicleFilter(f); setActiveView('vehicles'); }} userRole={profile?.role} tenant={currentTenant || undefined} onUpgrade={() => setActiveView('subscription')} onNavigateAutomation={() => setActiveView('automation')} />
        )}
        {activeView === 'vehicles' && (
          <VehicleList vehicles={vehicles} records={records} vehicleMakes={vehicleMakes} initialFilter={vehicleFilter} onClearFilter={() => setVehicleFilter(null)} onSelect={v => { setSelectedVehicleId(v.id); setActiveView('detail'); }} onAdd={handleAddVehicle} onUpdate={handleUpdateVehicle} onDelete={handleDeleteVehicle} userRole={profile?.role} tenantPlan={currentTenant?.plan} onUpgradeRedirect={() => setActiveView('subscription')} />
        )}
        {activeView === 'detail' && currentVehicle && (
          <VehicleDetail vehicle={currentVehicle} vehicleMakes={vehicleMakes} records={records.filter(r => r.vehicleId === currentVehicle.id)} onUpdateVehicle={handleUpdateVehicle} onUpdateRecord={handleUpdateRecord} onDeleteVehicle={handleDeleteVehicle} onBack={() => setActiveView('vehicles')} userRole={profile?.role} />
        )}
        {activeView === 'automation' && (
          <AutomationSettings config={automationConfig} loading={automationLoading} vehicleMakes={vehicleMakes} onUpdate={handleUpdateAutomation} onAddMake={handleAddMake} onRemoveMake={handleRemoveMake} />
        )}
        {activeView === 'team' && (
          <TeamManagement tenantId={profile?.tenant_id} tenantName={currentTenant?.name} users={teamUsers} onRefresh={() => profile && fetchTenantData(profile.id, true)} addToast={addToast} userRole={profile?.role} />
        )}
        {activeView === 'history' && <ActionHistory logs={logs} userRole={profile?.role} />}
        {activeView === 'subscription' && <SubscriptionPage tenant={currentTenant} vehicleCount={vehicles.length} onUpgrade={() => addToast('Feature Locked', 'Billing module coming soon.', 'info')} />}
        {activeView === 'tenants' && profile?.role === UserRole.SUPER_ADMIN && (
          <SuperAdminView tenants={allTenants} logs={logs} onTenantUpdate={() => profile && fetchTenantData(profile.id, true)} onDeleteTenant={() => {}} userRole={profile?.role} />
        )}
      </main>
    </div>
  );
};

export default App;
