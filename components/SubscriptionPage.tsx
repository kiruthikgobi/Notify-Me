import React from 'react';
import { Tenant, SubscriptionPlan } from '../types';
import { ICONS } from '../constants';

interface SubscriptionPageProps {
  tenant: Tenant | null;
  vehicleCount: number;
  onUpgrade: () => void;
}

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ tenant, vehicleCount, onUpgrade }) => {
  const isPro = tenant?.plan === SubscriptionPlan.PRO;
  const isAtLimit = !isPro && vehicleCount >= 5;

  const formatExpiryDate = (dateStr?: string) => {
    if (!dateStr) return 'Lifetime (Trial)';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-4xl mx-auto py-10 pb-20">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">
          Subscription Center
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
          Managing licenses for <span className="text-primary-600 font-bold">{tenant?.name || 'Your Workspace'}</span>.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="ui-card p-8 rounded-[2.5rem] border-l-8 border-primary-600 flex flex-col justify-between shadow-soft">
          <div>
            <div className="flex items-center justify-between mb-8">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace Status</span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isPro ? 'bg-emerald-100 text-emerald-600' : 'bg-primary-50 text-primary-600'}`}>
                {isPro ? 'PRO PLAN' : 'FREE TIER'}
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
                {isPro ? 'Pro Active' : 'Free Workspace'}
              </h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                {isPro 
                  ? `Your organization "${tenant?.name}" has full access enabled. Valid until ${formatExpiryDate(tenant?.subscriptionExpiry)}.` 
                  : 'You are currently on a limited trial workspace. Upgrade to unlock full automation and unlimited assets.'}
              </p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
             <div className="flex items-end justify-between">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Allocation</p>
                   <p className="text-2xl font-display font-black text-slate-900 dark:text-white">
                      {vehicleCount} <span className="text-slate-300">/ {isPro ? '∞' : '5'}</span>
                   </p>
                </div>
                {!isPro && (
                   <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg ${isAtLimit ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-primary-50 text-primary-600'}`}>
                      {isAtLimit ? 'QUOTA REACHED' : `${Math.max(0, 5 - vehicleCount)} Slots Left`}
                   </span>
                )}
             </div>
          </div>
        </div>

        <div className={`ui-card p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col transition-all shadow-elevated ${isPro ? 'opacity-70' : 'border-primary-500/20'}`}>
          {!isPro && <div className="absolute top-0 right-0 bg-primary-600 text-white text-[10px] font-black px-6 py-2 rounded-bl-2xl tracking-widest shadow-lg">PRO BENEFITS</div>}
          
          <div className="flex-1">
            <h3 className="text-2xl font-display font-bold mb-6">Enterprise Power</h3>
            <div className="space-y-5">
              {[
                { label: 'Unlimited vehicle additions', icon: ICONS.Truck },
                { label: 'Multi-recipient email alerts', icon: ICONS.Bell },
                { label: 'Gemini AI Audit Engine', icon: ICONS.Brain },
                { label: 'Automated document recovery', icon: ICONS.Mail },
                { label: 'Priority platform support', icon: ICONS.Check }
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <div className="w-8 h-8 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center text-primary-600 shrink-0">
                    <benefit.icon className="w-4 h-4" />
                  </div>
                  {benefit.label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annual Investment</p>
                <p className="text-3xl font-display font-black text-slate-900 dark:text-white">₹99 <span className="text-sm font-medium text-slate-400">/ year</span></p>
              </div>
            </div>
            <button 
              disabled={isPro}
              onClick={onUpgrade}
              className={`w-full py-5 rounded-2xl font-black text-xs tracking-widest transition-all shadow-xl active:scale-95 ${isPro ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/20'}`}
            >
              {isPro ? 'SUBSCRIPTION ACTIVE' : 'UPGRADE WORKSPACE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;