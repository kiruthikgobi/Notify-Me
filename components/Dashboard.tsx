
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

const Dashboard: React.FC<DashboardProps> = ({ vehicles, records, onViewVehicle, onNavigateFleet, userRole, tenant, onUpgrade }) => {
  const publishedVehicles = useMemo(() => vehicles.filter(v => !v.isDraft), [vehicles]);
  const draftVehicles = useMemo(() => vehicles.filter(v => v.isDraft), [vehicles]);

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

      if (r.isDraft) {
        drafts++;
        return;
      }

      if (!r.expiryDate) {
        expired++;
        return;
      }

      const expiry = new Date(r.expiryDate);
      if (expiry < now) {
        expired++;
      } else if (expiry < thirtyDaysFromNow) {
        expiringSoon++;
      } else {
        valid++;
      }
    });

    return { expired, expiringSoon, valid, drafts };
  }, [records, vehicles]);

  const pieData = [
    { name: 'Critical (Expired/Missing)', value: stats.expired, color: '#ef4444' },
    { name: 'Warning (Expiring Soon)', value: stats.expiringSoon, color: '#f59e0b' },
    { name: 'Healthy (Compliant)', value: stats.valid, color: '#10b981' },
    { name: 'Draft (Pending)', value: stats.drafts, color: '#94a3b8' },
  ];

  const complianceHealth = useMemo(() => {
    if (publishedVehicles.length === 0) return 0;
    const healthyVehiclesCount = publishedVehicles.filter(v => {
      const vRecs = records.filter(r => r.vehicleId === v.id);
      if (vRecs.length === 0) return false;
      const hasIssues = vRecs.some(r => r.isDraft || !r.expiryDate || new Date(r.expiryDate) < new Date());
      return !hasIssues;
    }).length;
    return Math.round((healthyVehiclesCount / publishedVehicles.length) * 100);
  }, [publishedVehicles, records]);

  const daysRemaining = useMemo(() => {
    if (!tenant?.subscriptionExpiry) return 0;
    const diff = new Date(tenant.subscriptionExpiry).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [tenant]);

  const slotsRemaining = useMemo(() => {
    return Math.max(0, 5 - vehicles.length);
  }, [vehicles]);

  const isAtLimit = tenant?.plan === SubscriptionPlan.FREE && vehicles.length >= 5;
  const isOwner = userRole === UserRole.TENANT_ADMIN;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Fleet Overview</h1>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${userRole === UserRole.SUPER_ADMIN ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              {userRole === UserRole.SUPER_ADMIN ? 'Super Admin' : userRole === UserRole.TENANT_ADMIN ? 'Fleet Owner' : userRole === UserRole.TENANT_MANAGER ? 'Fleet Manager' : 'Fleet Viewer'}
            </span>
            {tenant?.plan === SubscriptionPlan.PRO && (
               <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border bg-primary-600 text-white border-primary-700 animate-pulse">
                  PRO
               </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Compliance health index and operational risks.</p>
        </div>
        <div className="flex gap-3">
            <button 
              onClick={() => exportToExcel(vehicles, records, 'fleet_audit_summary')}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            >
              <ICONS.Download className="w-4 h-4" />
              Export Audit
            </button>
            {isOwner && tenant?.plan === SubscriptionPlan.FREE && (
              <button 
                onClick={onUpgrade}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-xl shadow-primary-500/20 active:scale-95"
              >
                Upgrade to Pro (₹99)
              </button>
            )}
        </div>
      </header>

      {/* Subscription Card - Only for Admin */}
      {isOwner && userRole !== UserRole.SUPER_ADMIN && (
        <div className={`ui-card p-6 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 border-l-8 transition-colors ${tenant?.plan === SubscriptionPlan.PRO ? 'border-l-emerald-500' : isAtLimit ? 'border-l-red-500 bg-red-50/20' : 'border-l-amber-500 bg-amber-50/20'}`}>
            <div className="flex items-center gap-6">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tenant?.plan === SubscriptionPlan.PRO ? 'bg-emerald-100 text-emerald-600' : isAtLimit ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {tenant?.plan === SubscriptionPlan.PRO ? <ICONS.Check className="w-8 h-8" /> : <ICONS.Alert className="w-8 h-8" />}
               </div>
               <div>
                  <h4 className="text-lg font-display font-black tracking-tight">
                     {tenant?.plan === SubscriptionPlan.PRO ? 'Enterprise Subscription Active' : isAtLimit ? 'Maximum Limit Reached' : 'Basic (Free) Plan Active'}
                  </h4>
                  <p className="text-sm text-slate-500 font-medium max-w-md">
                     {tenant?.plan === SubscriptionPlan.PRO 
                        ? `Enjoy unlimited vehicle assets and automated triggers. Your plan expires in ${daysRemaining} days.`
                        : isAtLimit 
                          ? `You have reached the maximum limit of 5 vehicles under the Free plan. Upgrade to Pro to add unlimited vehicles.`
                          : `Your current plan is limited to 5 vehicles. You have ${slotsRemaining} slots remaining.`}
                  </p>
               </div>
            </div>
            {tenant?.plan === SubscriptionPlan.FREE && (
               <button 
                  onClick={onUpgrade}
                  className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95 ${isAtLimit ? 'bg-red-600 text-white shadow-red-500/20 animate-pulse' : 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-slate-900/10'}`}
               >
                  {isAtLimit ? 'Upgrade to Pro – ₹99/year' : 'Get Unlimited Access • ₹99'}
               </button>
            )}
            {tenant?.plan === SubscriptionPlan.PRO && (
               <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valid Until</span>
                  <span className="text-lg font-display font-bold text-slate-900 dark:text-white">
                     {new Date(tenant.subscriptionExpiry!).toLocaleDateString()}
                  </span>
               </div>
            )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Fleet', value: publishedVehicles.length, icon: ICONS.Truck, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/10', filter: null },
          { label: 'Pending Docs', value: stats.drafts, icon: ICONS.FileText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10', filter: 'drafts' },
          { label: 'Critical Renewal', value: stats.expired + stats.expiringSoon, icon: ICONS.Calendar, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10', filter: 'expired' },
          { label: 'Fleet Health', value: `${complianceHealth}%`, icon: ICONS.Check, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10', filter: 'healthy' }
        ].map((kpi, i) => (
          <div 
            key={i} 
            onClick={() => onNavigateFleet(kpi.filter)}
            className="ui-card p-7 rounded-2xl hover:border-primary-300 dark:hover:border-primary-800 cursor-pointer group transition-all shadow-soft"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.color} shadow-sm transition-transform group-hover:scale-110`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <ICONS.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">{kpi.value}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 ui-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-display font-bold">Risk Distribution</h3>
             <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500" />
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Healthy</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-red-500" />
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Risk</span>
                </div>
             </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="value"
                  strokeWidth={0}
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-card p-8 rounded-3xl flex flex-col shadow-soft">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-display font-bold">Critical Actions</h3>
            <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-0.5 rounded uppercase">Immediate</span>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {records.filter(r => {
                const v = vehicles.find(veh => veh.id === r.vehicleId);
                return v && !v.isDraft && !r.isDraft && r.expiryDate && new Date(r.expiryDate) < new Date();
            }).slice(0, 8).map((r, i) => {
              const v = vehicles.find(v => v.id === r.vehicleId);
              return (
                <div 
                  key={i} 
                  onClick={() => onViewVehicle(r.vehicleId)}
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 cursor-pointer transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-red-600 transition-colors">{v?.registrationNumber}</span>
                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{r.type} Expired</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                    <ICONS.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
          <button 
            onClick={() => onNavigateFleet('expired')}
            className="w-full py-4 mt-6 border-2 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 transition-all"
          >
            View All Issues
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
