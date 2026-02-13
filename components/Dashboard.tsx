import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Vehicle, ComplianceRecord, UserRole, Tenant, SubscriptionPlan } from '../types';
import { ICONS } from '../constants';
import { exportToExcel } from '../utils/exportUtils';

interface DashboardProps {
  vehicles: Vehicle[];
  records: ComplianceRecord[];
  onViewVehicle: (id: string) => void;
  onNavigateFleet: (filter: string | null) => void;
  userRole?: UserRole;
  tenant?: Tenant;
  onUpgrade?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ vehicles = [], records = [], onViewVehicle, onNavigateFleet, userRole, tenant, onUpgrade }) => {
  const publishedVehicles = useMemo(() => vehicles.filter(v => v && !v.isDraft), [vehicles]);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    let expired = 0;
    let expiringSoon = 0;
    let valid = 0;
    let drafts = 0;

    records.forEach(r => {
      const v = vehicles.find(veh => veh.id === r.vehicleId);
      if (!v || v.isDraft) return;
      if (r.isDraft) { drafts++; return; }
      if (!r.expiryDate) { expired++; return; }

      const expiry = new Date(r.expiryDate);
      if (expiry < now) expired++;
      else if (expiry < thirtyDaysFromNow) expiringSoon++;
      else valid++;
    });

    return { expired, expiringSoon, valid, drafts };
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

  const isAtLimit = tenant?.plan === SubscriptionPlan.FREE && vehicles.length >= 5;
  const isOwner = userRole === UserRole.TENANT_ADMIN;

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white">Fleet Overview</h1>
            <div className="flex gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest border bg-emerald-50 border-emerald-200 text-emerald-600`}>
                {userRole === UserRole.SUPER_ADMIN ? 'Super Admin' : 'Fleet Admin'}
              </span>
              {tenant?.plan === SubscriptionPlan.PRO && (
                 <span className="px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest border bg-primary-600 text-white border-primary-700">PRO</span>
              )}
            </div>
          </div>
          <p className="text-xs md:text-base text-slate-500 dark:text-slate-400 font-medium">Compliance health index and operational risks.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button onClick={() => exportToExcel(vehicles, records, 'fleet_audit')} className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-sm">
              <ICONS.Download className="w-4 h-4" />
              Export Audit
            </button>
            {isOwner && tenant?.plan === SubscriptionPlan.FREE && (
              <button onClick={onUpgrade} className="flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-xl shadow-primary-500/20 text-sm">
                Upgrade to Pro
              </button>
            )}
        </div>
      </header>

      {/* Subscription Status Card */}
      {isOwner && (
        <div className={`ui-card p-5 md:p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 border-l-8 ${tenant?.plan === SubscriptionPlan.PRO ? 'border-l-emerald-500' : isAtLimit ? 'border-l-red-500' : 'border-l-amber-500'}`}>
            <div className="flex items-center gap-4 md:gap-6 w-full">
               <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 ${tenant?.plan === SubscriptionPlan.PRO ? 'bg-emerald-100 text-emerald-600' : isAtLimit ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {tenant?.plan === SubscriptionPlan.PRO ? <ICONS.Check className="w-8 h-8" /> : <ICONS.Alert className="w-8 h-8" />}
               </div>
               <div>
                  <h4 className="text-base md:text-lg font-display font-black tracking-tight">{tenant?.plan === SubscriptionPlan.PRO ? 'PRO Subscription Active' : isAtLimit ? 'Vehicle Limit Reached' : 'FREE Plan Active'}</h4>
                  <p className="text-[11px] md:text-sm text-slate-500 font-medium leading-tight md:leading-normal">
                    {tenant?.plan === SubscriptionPlan.PRO ? `Full features active. Expires in ${daysRemaining} days.` : isAtLimit ? 'Limit of 5 vehicles reached. Upgrade for unlimited access.' : `Basic monitoring active. ${Math.max(0, 5-vehicles.length)} slots left.`}
                  </p>
               </div>
            </div>
            {tenant?.plan === SubscriptionPlan.FREE && (
               <button onClick={onUpgrade} className="w-full md:w-auto px-8 py-4 md:py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">Upgrade Now</button>
            )}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Active Fleet', value: publishedVehicles.length, icon: ICONS.Truck, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/10', filter: null },
          { label: 'Pending Docs', value: stats.drafts, icon: ICONS.FileText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10', filter: 'drafts' },
          { label: 'Critical Issues', value: stats.expired + stats.expiringSoon, icon: ICONS.Calendar, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10', filter: 'expired' },
          { label: 'Fleet Health', value: `${complianceHealth}%`, icon: ICONS.Check, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10', filter: 'healthy' }
        ].map((kpi, i) => (
          <div key={i} onClick={() => onNavigateFleet(kpi.filter)} className="ui-card p-4 md:p-7 rounded-2xl cursor-pointer hover:border-primary-300 dark:hover:border-primary-800 transition-all shadow-soft group">
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
              <div className="h-full flex flex-col items-center justify-center py-10 opacity-40">
                <ICONS.Check className="w-10 h-10 mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest">All Clear</p>
              </div>
            ) : (
              records.filter(r => {
                  const v = vehicles.find(veh => veh.id === r.vehicleId);
                  return v && !v.isDraft && !r.isDraft && r.expiryDate && new Date(r.expiryDate) < new Date();
              }).slice(0, 10).map((r, i) => {
                const v = vehicles.find(v => v.id === r.vehicleId);
                return (
                  <div key={i} onClick={() => onViewVehicle(r.vehicleId)} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:border-red-100 border border-transparent cursor-pointer transition-all group">
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-red-600 truncate uppercase">{v?.registrationNumber}</span>
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