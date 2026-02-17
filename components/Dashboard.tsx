
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Vehicle, ComplianceRecord, UserRole, Tenant, SubscriptionPlan, GlobalAutomationConfig } from '../types';
import { ICONS } from '../constants';
import { exportToExcel } from '../utils/exportUtils';

interface DashboardProps {
  vehicles: Vehicle[];
  records: ComplianceRecord[];
  automationConfig?: GlobalAutomationConfig | null;
  onViewVehicle: (id: string) => void;
  onNavigateFleet: (filter: string | null) => void;
  userRole?: UserRole | string; // Accept string as well to handle DB values safely
  tenant?: Tenant;
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
  onUpgrade,
  onNavigateAutomation
}) => {
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

    records.forEach(r => {
      const v = vehicles.find(veh => veh.id === r.vehicleId);
      if (!v || v.isDraft) return;
      
      if (r.alertEnabled) {
        monitoredVehicles.add(v.id);
      }

      if (r.isDraft) { drafts++; return; }
      if (!r.expiryDate) { expired++; return; }

      const expiry = new Date(r.expiryDate);
      if (expiry < now) expired++;
      else if (expiry < thirtyDaysFromNow) expiringSoon++;
      else valid++;
    });

    return { expired, expiringSoon, valid, drafts, alertsActive: monitoredVehicles.size };
  }, [records, vehicles]);

  const pieData = [
    { name: 'Critical', value: stats.expired, color: '#ef4444' },
    { name: 'Warning', value: stats.expiringSoon, color: '#f59e0b' },
    { name: 'Healthy', value: stats.valid, color: '#10b981' },
    { name: 'Draft', value: stats.drafts, color: '#94a3b8' },
  ];

  const complianceHealth = useMemo(() => {
    if (publishedVehicles.length === 0) return 0;
    const healthyVehiclesCount = publishedVehicles.filter(v => {
      const vRecs = records.filter(r => r.vehicleId === v.id);
      if (vRecs.length === 0) return false;
      return !vRecs.some(r => r.isDraft || !r.expiryDate || new Date(r.expiryDate) < new Date());
    }).length;
    return Math.round((healthyVehiclesCount / publishedVehicles.length) * 100);
  }, [publishedVehicles, records]);

  const daysRemaining = useMemo(() => {
    if (!tenant?.subscriptionExpiry) return 0;
    const diff = new Date(tenant.subscriptionExpiry).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [tenant]);

  // Refined role checks with robust comparison and undefined handling
  const isSuperAdmin = useMemo(() => {
    if (!userRole) return false;
    return String(userRole).toUpperCase() === UserRole.SUPER_ADMIN;
  }, [userRole]);

  const isOwner = useMemo(() => {
    if (!userRole) return false;
    return String(userRole).toUpperCase() === UserRole.TENANT_ADMIN;
  }, [userRole]);

  const isManager = useMemo(() => {
    if (!userRole) return false;
    const roleStr = String(userRole).toUpperCase();
    return roleStr === UserRole.TENANT_MANAGER || roleStr === UserRole.TENANT_ADMIN;
  }, [userRole]);

  const isAtLimit = tenant?.plan === SubscriptionPlan.FREE && vehicles.length >= 5;

  const displayName = tenant?.name || 'Workspace';

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-primary-600 uppercase tracking-[0.3em] mb-1">
                {isSuperAdmin ? 'Global Infrastructure' : 'Organisation Dashboard'}
              </span>
              <h1 className="text-3xl md:text-5xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none flex items-center gap-3">
                {isSuperAdmin ? 'Platform Management' : displayName}
                {tenant?.id === 'syncing' && <div className="w-6 h-6 border-4 border-slate-100 border-t-primary-600 rounded-full animate-spin shrink-0" />}
              </h1>
            </div>
            <div className="flex gap-2 self-start mt-1">
              <span className={`px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest border ${
                isSuperAdmin 
                  ? 'bg-amber-50 border-amber-200 text-amber-600' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}>
                {isSuperAdmin ? 'Platform Root' : (userRole ? 'Secure Workspace' : 'Syncing Identity...')}
              </span>
              {tenant?.plan === SubscriptionPlan.PRO && !isSuperAdmin && (
                 <span className="px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest border bg-primary-600 text-white border-primary-700">PRO LEVEL</span>
              )}
            </div>
          </div>
          <p className="text-xs md:text-base text-slate-500 dark:text-slate-400 font-medium italic">
            {isSuperAdmin 
              ? 'Monitoring multi-tenant health and cross-organisation compliance.' 
              : `Monitoring active risk and compliance for ${displayName}.`}
          </p>
        </div>
        {!isSuperAdmin && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button onClick={() => exportToExcel(vehicles, records, `${displayName.replace(/\s+/g, '_')}_audit`)} className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-sm">
                <ICONS.Download className="w-4 h-4" />
                Generate Audit
              </button>
              {isOwner && tenant?.plan === SubscriptionPlan.FREE && (
                <button onClick={onUpgrade} className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-xl shadow-primary-500/20 text-sm">
                  Upgrade to Pro
                </button>
              )}
          </div>
        )}
      </header>

      {/* Governance & Columns Section */}
      {!isSuperAdmin && userRole && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subscription Column */}
          <div className={`ui-card p-6 md:p-8 rounded-[2rem] border-l-8 ${tenant?.plan === SubscriptionPlan.PRO ? 'border-l-emerald-500' : isAtLimit ? 'border-l-red-500' : 'border-l-amber-500'} flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Management</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tenant?.plan === SubscriptionPlan.PRO ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {tenant?.plan === SubscriptionPlan.PRO ? <ICONS.Check className="w-4 h-4" /> : <ICONS.Alert className="w-4 h-4" />}
                </div>
              </div>
              <h4 className="text-xl font-display font-black tracking-tight mb-2">
                {tenant?.plan === SubscriptionPlan.PRO ? 'PRO Enterprise Plan' : 'Standard Free Plan'}
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {tenant?.plan === SubscriptionPlan.PRO 
                  ? `Access fully enabled. Expiry in ${daysRemaining} days.` 
                  : `Currently utilizing ${vehicles.length}/5 slots. Upgrade for unlimited fleet expansion.`}
              </p>
            </div>
            {isOwner && tenant?.plan === SubscriptionPlan.FREE && (
               <button onClick={onUpgrade} className="w-full mt-8 py-3.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:scale-105">Upgrade Subscription</button>
            )}
          </div>

          {/* Alert Engine Column */}
          <div onClick={onNavigateAutomation} className={`ui-card p-6 md:p-8 rounded-[2rem] border-l-8 cursor-pointer hover:border-primary-500 transition-all ${automationConfig?.enabled ? 'border-l-primary-500' : 'border-l-slate-300'} flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alert Configuration</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${automationConfig?.enabled ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                  <ICONS.Bell className="w-4 h-4" />
                </div>
              </div>
              <h4 className="text-xl font-display font-black tracking-tight mb-2">
                {automationConfig ? (automationConfig.enabled ? 'Automation Active' : 'Automation Paused') : 'Not Configured'}
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {automationConfig 
                  ? `Monitoring compliance across ${stats.alertsActive} vehicles. Reminders dispatched to ${automationConfig.recipients.length} emails.` 
                  : 'Automatic expiry notifications are not yet set up. Click to configure your alert engine.'}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-8">
               <div className="flex -space-x-2">
                 {(automationConfig?.recipients || []).slice(0, 3).map((r, i) => (
                   <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-primary-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm" title={r}>
                     {r[0].toUpperCase()}
                   </div>
                 ))}
                 {(automationConfig?.recipients || []).length > 3 && (
                   <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                     +{(automationConfig?.recipients || []).length - 3}
                   </div>
                 )}
               </div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 {automationConfig?.recipients?.length || 0} Recipients
               </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Active Fleet', value: publishedVehicles.length, icon: ICONS.Truck, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/10', filter: null },
          { label: 'Monitoring Active', value: stats.alertsActive, icon: ICONS.Bell, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10', filter: null },
          { label: 'Critical Issues', value: stats.expired + stats.expiringSoon, icon: ICONS.Calendar, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10', filter: 'expired' },
          { label: 'Fleet Health', value: `${complianceHealth}%`, icon: ICONS.Check, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10', filter: 'healthy' }
        ].map((kpi, i) => (
          <div key={i} onClick={() => kpi.filter && onNavigateFleet(kpi.filter)} className="ui-card p-4 md:p-7 rounded-2xl cursor-pointer hover:border-primary-300 dark:hover:border-primary-800 transition-all shadow-soft group">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className={`p-2 rounded-xl ${kpi.bg} ${kpi.color} shadow-sm group-hover:scale-110 transition-transform`}>
                <kpi.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <ICONS.ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-slate-300 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-xl md:text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">{kpi.value}</div>
            <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 md:mt-2 truncate">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 ui-card p-6 md:p-8 rounded-3xl">
          <h3 className="text-lg md:text-xl font-display font-bold mb-8">Risk Distribution</h3>
          <div className="h-60 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={8} dataKey="value" strokeWidth={0} animationDuration={1000}>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle"/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-card p-6 md:p-8 rounded-3xl flex flex-col">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 className="text-lg md:text-xl font-display font-bold">Critical Actions</h3>
            <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-0.5 rounded uppercase">Daily Priority</span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
            {records.filter(r => {
                const v = vehicles.find(veh => veh.id === r.vehicleId);
                return v && !v.isDraft && !r.isDraft && r.expiryDate && new Date(r.expiryDate) < new Date();
            }).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 opacity-40 text-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
                  <ICONS.Check className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">All Assets Compliant</p>
              </div>
            ) : (
              records.filter(r => {
                  const v = vehicles.find(v => v.id === r.vehicleId);
                  return v && !v.isDraft && !r.isDraft && r.expiryDate && new Date(r.expiryDate) < new Date();
              }).slice(0, 10).map((r, i) => {
                const v = vehicles.find(v => v.id === r.vehicleId);
                return (
                  <div key={i} onClick={() => onViewVehicle(r.vehicleId)} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:border-red-100 border border-transparent cursor-pointer transition-all group">
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-red-600 truncate uppercase tracking-tighter">{v?.registrationNumber}</span>
                      <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">{r.type} Expired</span>
                    </div>
                    <ICONS.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-500 shrink-0" />
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
