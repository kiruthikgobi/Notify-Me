
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Vehicle, Profile, UserRole, Company, ComplianceRecord, GlobalAutomationConfig, VehicleMake, SubscriptionPlan
} from './types';
import { ICONS } from './constants';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import VehicleList from './components/VehicleList';
import VehicleDetail from './components/VehicleDetail';
import SuperAdminView from './components/SuperAdminView';
import TeamManagement from './components/TeamManagement';
import AutomationSettings from './components/AutomationSettings';
import Toast from './components/Toast';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [automationConfig, setAutomationConfig] = useState<GlobalAutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  
  const retryCount = useRef(0);
  const maxRetries = 10; 

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchSessionData = useCallback(async (userId: string) => {
    try {
      // 1. Fetch Profile
      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (pErr) {
        console.error("[Sync] Supabase Error:", pErr);
        addToast("Registry Offline", "Could not establish secure tunnel.", "error");
        setLoading(false);
        return;
      }

      // 2. Handle missing profile (Provisioning mode)
      if (!p) {
        if (retryCount.current < maxRetries) {
          setIsProvisioning(true);
          const delay = 500 * (retryCount.current + 1); // Linear backoff
          retryCount.current += 1;
          setTimeout(() => fetchSessionData(userId), delay);
          return;
        }
        console.error("[Sync] Profile provision timeout.");
        setIsProvisioning(false);
        setLoading(false);
        return;
      }

      // 3. Populate State
      setProfile(p);
      setIsProvisioning(false);
      retryCount.current = 0;
      
      if (p.role === UserRole.SUPER_ADMIN) {
        setActiveView('super_admin');
        setLoading(false);
        return;
      }

      // 4. Fetch Organization Data
      if (p.company_id) {
        const [cRes, vRes, rRes, tRes] = await Promise.all([
          supabase.from('companies').select('*').eq('id', p.company_id).maybeSingle(),
          supabase.from('vehicles').select('*').eq('company_id', p.company_id).order('created_at', { ascending: false }),
          supabase.from('compliance_records').select('*').eq('company_id', p.company_id),
          supabase.from('profiles').select('*').eq('company_id', p.company_id)
        ]);

        if (cRes.data) setCompany(cRes.data);
        if (vRes.data) setVehicles(vRes.data);
        if (rRes.data) {
          setRecords(rRes.data.map(r => ({
            id: r.id,
            vehicleId: r.vehicle_id,
            tenantId: r.company_id,
            type: r.type,
            expiryDate: r.expiry_date,
            lastRenewedDate: r.last_renewed_date,
            alertEnabled: r.alert_enabled,
            alertDaysBefore: r.alert_days_before,
            isDraft: r.is_draft,
            documentName: r.document_name,
            documentUrl: r.document_url
          })));
        }
        if (tRes.data) setTeam(tRes.data);
      }
    } catch (err: any) {
      console.error("[Sync] Critical Unhandled Exception:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchSessionData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        retryCount.current = 0;
        fetchSessionData(session.user.id);
      } else { 
        setProfile(null); 
        setCompany(null); 
        setLoading(false);
        setIsProvisioning(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchSessionData]);

  if (loading || isProvisioning) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <div className="w-16 h-16 border-4 border-t-primary-600 border-slate-800 rounded-full animate-spin mb-8" />
        <h2 className="text-xl font-display font-black text-white uppercase tracking-tighter">
          {isProvisioning ? "Provisioning Node..." : "Synchronizing..."}
        </h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2 italic max-w-xs">
          Authenticating with secure cloud registry
        </p>
      </div>
    );
  }

  if (session && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8">
          <ICONS.Alert className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tighter">Identity Timeout</h2>
        <p className="text-slate-400 text-xs mt-4 max-w-sm leading-relaxed">
          The registry was unable to verify your profile. This usually happens if the <code className="text-primary-400">schema.sql</code> trigger is missing or failing.
        </p>
        <div className="flex gap-4 mt-10">
          <button onClick={() => window.location.reload()} className="px-8 py-4 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Retry Link</button>
          <button onClick={() => supabase.auth.signOut()} className="px-8 py-4 bg-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest">Sign Out</button>
        </div>
      </div>
    );
  }

  if (!session) return <Auth onAuthComplete={() => {}} />;

  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans">
      <Toast toasts={toasts} removeToast={removeToast} />
      
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-6 flex flex-col hidden md:flex">
        <div className="flex items-center gap-3 mb-10">
          <ICONS.Logo className="w-8 h-8 text-primary-600" />
          <span className="font-display font-black text-xl tracking-tighter uppercase text-slate-900 dark:text-white">Notify Me</span>
        </div>
        <nav className="flex-1 space-y-1">
          {isSuperAdmin ? (
            <button onClick={() => setActiveView('super_admin')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${activeView === 'super_admin' ? 'bg-primary-50 text-primary-600' : 'text-slate-400'}`}>
              <ICONS.Grid className="w-4 h-4" /> Global Control
            </button>
          ) : (
            <>
              <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${activeView === 'dashboard' ? 'bg-primary-50 text-primary-600' : 'text-slate-400'}`}>
                <ICONS.Grid className="w-4 h-4" /> Dashboard
              </button>
              <button onClick={() => setActiveView('vehicles')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${activeView === 'vehicles' ? 'bg-primary-50 text-primary-600' : 'text-slate-400'}`}>
                <ICONS.Truck className="w-4 h-4" /> Assets
              </button>
            </>
          )}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="mt-auto w-full flex items-center gap-4 px-4 py-3.5 text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all">
           Log Out
        </button>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {activeView === 'super_admin' && isSuperAdmin && <SuperAdminView />}
        
        {activeView === 'dashboard' && !isSuperAdmin && profile && company && (
          <Dashboard vehicles={vehicles} records={records} profile={profile} company={company} onViewVehicle={(id) => { setSelectedVehicle(vehicles.find(v => v.id === id) || null); setActiveView('vehicle_detail'); }} />
        )}
        
        {activeView === 'vehicles' && !isSuperAdmin && profile && company && (
          <VehicleList vehicles={vehicles} profile={profile} subscriptionPlan={company.subscription_plan} 
            onAdd={async (vData) => {
              const { data, error } = await supabase.from('vehicles').insert({ ...vData, company_id: profile.company_id }).select().single();
              if (data) setVehicles([data, ...vehicles]);
            }} 
            onDelete={async (id) => {
              await supabase.from('vehicles').delete().eq('id', id);
              setVehicles(vehicles.filter(v => v.id !== id));
            }} 
            onSelect={v => { setSelectedVehicle(v); setActiveView('vehicle_detail'); }} 
          />
        )}

        {activeView === 'vehicle_detail' && selectedVehicle && profile && (
          <VehicleDetail vehicle={selectedVehicle} vehicleMakes={[]} records={records.filter(r => r.vehicleId === selectedVehicle.id)} 
            onUpdateVehicle={async (v) => {
              await supabase.from('vehicles').update(v).eq('id', v.id);
              setVehicles(prev => prev.map(item => item.id === v.id ? v : item));
            }} 
            onUpdateRecord={async (r) => {
              const dbData = { vehicle_id: r.vehicleId, company_id: profile.company_id, type: r.type, expiry_date: r.expiryDate, is_draft: r.isDraft };
              if (r.id.startsWith('temp-')) {
                const { data } = await supabase.from('compliance_records').insert(dbData).select().single();
                if (data) setRecords([...records, { ...r, id: data.id }]);
              } else {
                await supabase.from('compliance_records').update(dbData).eq('id', r.id);
                setRecords(prev => prev.map(item => item.id === r.id ? r : item));
              }
            }} 
            onDeleteVehicle={async (id) => {
              await supabase.from('vehicles').delete().eq('id', id);
              setVehicles(vehicles.filter(v => v.id !== id));
              setActiveView('vehicles');
            }} 
            onBack={() => setActiveView('vehicles')}
            userRole={profile.role}
          />
        )}
      </main>
    </div>
  );
};

export default App;
