
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Vehicle, ComplianceRecord, UserRole, Tenant, SubscriptionPlan, GlobalAutomationConfig, Profile, Company, ComplianceType } from '../types';
import { ICONS } from '../constants';
import { exportToExcel } from '../utils/exportUtils';

interface DashboardProps {
  vehicles: Vehicle[];
  records?: ComplianceRecord[];
  automationConfig?: GlobalAutomationConfig | null;
  onViewVehicle?: (id: string) => void;
  onNavigateFleet?: (filter: string | null) => void;
  userRole?: UserRole | string;
  tenant?: Tenant;
  profile?: Profile;
  company?: Company;
  onUpgrade?: () => void;
  onNavigateAutomation?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  vehicles = [], 
  records = [], 
  automationConfig, 
  onViewVehicle, 
  onNavigateFleet, 
  userRole, 
  tenant, 
  profile,
  company,
  onUpgrade,
  onNavigateAutomation
}) => {
  // Use derived records from vehicle expiry dates if records are not provided
  const derivedRecords = useMemo(() => {
    if (records && records.length > 0) return records;
    const recs: ComplianceRecord[] = [];
    vehicles.forEach(v => {
      if (v.rc_expiry_date) {
        recs.push({
          id: `rc-${v.id}`,
          vehicleId: v.id,
          tenantId: v.company_id,
          type: ComplianceType.RC,
          expiryDate: v.rc_expiry_date,
          alertEnabled: true,
          alertDaysBefore: 30,
          isDraft: false
        });
      }
      if (v.insurance_expiry_date) {
        recs.push({
          id: `ins-${v.id}`,
          vehicleId: v.id,
          tenantId: v.company_id,
          type: ComplianceType.INSURANCE,
          expiryDate: v.insurance_expiry_date,
          alertEnabled: true,
          alertDaysBefore: 30,
          isDraft: false
        });
      }
      if (v.pollution_expiry_date) {
        recs.push({
          id: `pol-${v.id}`,
          vehicleId: v.id,
          tenantId: v.company_id,
          type: ComplianceType.POLLUTION,
          expiryDate: v.pollution_expiry_date,
          alertEnabled: true,
          alertDaysBefore: 30,
          isDraft: false
        });
      }
    });
    return recs;
  }, [records, vehicles]);

  const publishedVehicles = useMemo(() => vehicles.filter(v => v && !v.isDraft), [vehicles]);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    let expired = 0;
    let expiringSoon = 0;
    let valid = 0;
    let drafts = 0;

    const monitoredVehicles = new Set();

    derivedRecords.forEach(r => {
      const v = vehicles.find(veh => veh.id === r.vehicleId);
      if (!v || v.isDraft) return;
      
      if (r.alertEnabled) monitoredVehicles.add(v.id);

      if (r.isDraft) { drafts++; return; }
      if (!r.expiryDate) { expired++; return; }

      const expiry = new Date(r.expiryDate);
      if (expiry < now) expired++;
      else if (expiry < thirtyDaysFromNow) expiringSoon++;
      else valid++;
    });

    return { expired, expiringSoon, valid, drafts, alertsActive: monitoredVehicles.size };
  }, [derivedRecords, vehicles]);

  const pieData = [
    { name: 'Critical', value: stats.expired, color: '#ef4444' },
    { name: 'Warning', value: stats.expiringSoon, color: '#f59e0b' },
    { name: 'Healthy', value: stats.valid, color: '#10b981' },
    { name: 'Draft', value: stats.drafts, color: '#94a3b8' },
  ];

  const complianceHealth = useMemo(() => {
    if (publishedVehicles.length === 0) return 0;
    const healthyVehiclesCount = publishedVehicles.filter(v => {
      const vRecs = derivedRecords.filter(r => r.vehicleId === v.id);
      if (vRecs.length === 0) return false;
      return !vRecs.some(r => r.isDraft || !r.expiryDate || new Date(r.expiryDate) < new Date());
    }).length;
    return Math.round((healthyVehiclesCount / publishedVehicles.length) * 100);
  }, [publishedVehicles, derivedRecords]);

  // Handle both tenant and company objects
  const activeRole = profile?.role || userRole;
  const isSuperAdmin = String(activeRole).toUpperCase() === UserRole.SUPER_ADMIN;
  const isOwner = String(activeRole).toUpperCase() === UserRole.TENANT_ADMIN;
  const isViewer = String(activeRole).toUpperCase() === UserRole.TENANT_VIEWER;

  const currentPlan = company?.subscription_plan || tenant?.plan;
  const displayName = company?.company_name || tenant?.name || 'Workspace';

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-primary-600 uppercase tracking-[0.3em] mb-1">
                {isSuperAdmin ? 'Platform Root Access' : 'Secure Fleet Workspace'}
              </span>
              <h1 className="text-3xl md:text-5xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none flex items-center gap-3">
                {isSuperAdmin ? 'Global Control' : displayName}
              </h1>
            </div>
            <div className="flex gap-2 self-start mt-1">
              <span className={`px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest border ${
                isSuperAdmin ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}>
                {activeRole?.toString().replace('_', ' ')}
              </span>
              {currentPlan === SubscriptionPlan.PRO && !isSuperAdmin && (
                 <span className="px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest border bg-primary-600 text-white border-primary-700">PRO LEVEL</span>
              )}
            </div>
          </div>
          <p className="text-xs md:text-base text-slate-500 dark:text-slate-400 font-medium italic">
            {isSuperAdmin ? 'Centralized tenant monitoring and platform infrastructure health.' : `Real-time compliance monitoring for ${displayName}.`}
          </p>
        </div>
        {!isSuperAdmin && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button onClick={() => exportToExcel(vehicles, derivedRecords, `${displayName.replace(/\s+/g, '_')}_audit`)} className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-sm">
                <ICONS.Download className="w-4 h-4" />
                Export Audit
              </button>
              {isOwner && currentPlan === SubscriptionPlan.FREE && (
                <button onClick={onUpgrade} className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-xl shadow-primary-500/20 text-sm">
                  Go Pro
                </button>
              )}
          </div>
        )}
      </header>

      {!isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Panel */}
          <div className={`ui-card p-6 md:p-8 rounded-[2rem] border-l-8 ${currentPlan === SubscriptionPlan.PRO ? 'border-l-emerald-500' : 'border-l-amber-500'} flex flex-col justify-between`}>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Subscription Plan</span>
              <h4 className="text-xl font-display font-black tracking-tight mb-2 uppercase">{currentPlan} Edition</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {currentPlan === SubscriptionPlan.PRO ? 'Full enterprise features enabled.' : `${vehicles.length}/5 vehicles utilized. Upgrade for unlimited scale.`}
              </p>
            </div>
            {isOwner && currentPlan === SubscriptionPlan.FREE && (
               <button onClick={onUpgrade} className="mt-8 py-3.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all">Unlock Unlimited Fleet</button>
            )}
          </div>

          {/* Automation Panel */}
          <div onClick={() => isOwner && onNavigateAutomation?.()} className={`ui-card p-6 md:p-8 rounded-[2rem] border-l-8 ${automationConfig?.enabled ? 'border-l-primary-500' : 'border-l-slate-300'} flex flex-col justify-between ${isOwner ? 'cursor-pointer hover:shadow-elevated' : ''}`}>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Alert Engine</span>
              <h4 className="text-xl font-display font-black tracking-tight mb-2 uppercase">{automationConfig?.enabled ? 'Active Monitoring' : 'Automation Idle'}</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {automationConfig?.recipients?.length ? `Sending daily reminders to ${automationConfig.recipients.length} endpoints.` : 'No notification recipients configured.'}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-8">
               <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">{automationConfig?.recipients?.length || 0} Recipients Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Analytics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Total Fleet', value: publishedVehicles.length, icon: ICONS.Truck, color: 'text-primary-600', bg: 'bg-primary-50' },
          { label: 'Active Alerts', value: stats.alertsActive, icon: ICONS.Bell, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Critical Risk', value: stats.expired, icon: ICONS.Alert, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Fleet Health', value: `${complianceHealth}%`, icon: ICONS.Check, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((kpi, i) => (
          <div key={i} className="ui-card p-4 md:p-7 rounded-3xl shadow-soft">
            <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center mb-4`}><kpi.icon className="w-5 h-5" /></div>
            <div className="text-xl md:text-3xl font-display font-black tracking-tight">{kpi.value}</div>
            <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 ui-card p-8 rounded-[2rem] shadow-soft">
          <h3 className="text-xl font-display font-bold mb-8">Risk Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={8} dataKey="value" strokeWidth={0} animationDuration={1000}>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-card p-8 rounded-[2rem] shadow-soft flex flex-col">
          <h3 className="text-xl font-display font-bold mb-8">Immediate Priority</h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
            {derivedRecords.filter(r => r.expiryDate && new Date(r.expiryDate) < new Date()).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-30">
                <ICONS.Check className="w-12 h-12 text-emerald-500 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Everything Compliant</p>
              </div>
            ) : (
              derivedRecords.filter(r => r.expiryDate && new Date(r.expiryDate) < new Date()).slice(0, 8).map((r, i) => {
                const v = vehicles.find(veh => veh.id === r.vehicleId);
                return (
                  <div key={i} onClick={() => onViewVehicle?.(r.vehicleId)} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:border-red-500/30 border border-transparent cursor-pointer transition-all">
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase tracking-tighter">{v?.vehicle_number}</span>
                      <span className="text-[9px] text-red-500 font-bold uppercase">{r.type} EXPIRED</span>
                    </div>
                    <ICONS.ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
