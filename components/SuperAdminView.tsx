
import React, { useState, useEffect } from 'react';
import { Tenant, SubscriptionPlan, TenantStatus, NotificationLog, UserRole } from '../types';
import { ICONS } from '../constants';
import { supabase } from '../services/supabaseClient';
import ConfirmationModal from './ConfirmationModal';

interface Props {
  tenants: Tenant[];
  logs: NotificationLog[];
  onTenantUpdate: () => void;
  onDeleteTenant: (id: string) => void;
  userRole?: UserRole;
}

const SuperAdminView: React.FC<Props> = ({ tenants, logs, onTenantUpdate, onDeleteTenant, userRole }) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'logs' | 'users'>('tenants');
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Deletion Modal State
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string; admin: string }>({
    open: false, id: '', name: '', admin: ''
  });

  const fetchGlobalUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          updated_at,
          tenant_id,
          tenants (
            name
          )
        `)
        .order('updated_at', { ascending: false });
      
      if (!error) {
        setGlobalUsers(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchGlobalUsers();
    }
  }, [activeTab]);

  const toggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === TenantStatus.ACTIVE ? TenantStatus.SUSPENDED : TenantStatus.ACTIVE;
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenant.id);
    
    if (!error) onTenantUpdate();
  };

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === TenantStatus.ACTIVE).length,
    suspended: tenants.filter(t => t.status === TenantStatus.SUSPENDED).length,
    alertsSent: logs.filter(l => l.status === 'SENT').length
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Global Command Center</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border bg-amber-50 border-amber-200 text-amber-600">
              Super Admin Mode
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Platform health and workspace monitoring console.</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Tenants', value: stats.total, icon: ICONS.Grid, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/10' },
          { label: 'Active Service', value: stats.active, icon: ICONS.Check, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
          { label: 'Suspended', value: stats.suspended, icon: ICONS.Alert, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/10' },
          { label: 'Alerts Processed', value: stats.alertsSent, icon: ICONS.Mail, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' }
        ].map((kpi, i) => (
          <div key={i} className="ui-card p-6 rounded-2xl border-b-4 border-b-slate-100 dark:border-b-slate-800">
            <div className={`w-10 h-10 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center mb-4`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-display font-bold">{kpi.value}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="ui-card rounded-3xl overflow-hidden shadow-elevated">
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => setActiveTab('tenants')}
            className={`px-8 py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tenants' ? 'border-b-2 border-primary-600 text-primary-600 bg-slate-50/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Tenant Directory
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-8 py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'border-b-2 border-primary-600 text-primary-600 bg-slate-50/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            User Registry
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-8 py-5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'border-b-2 border-primary-600 text-primary-600 bg-slate-50/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Notification Logs
          </button>
        </div>

        {activeTab === 'tenants' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 dark:bg-slate-800/20">
                  <th className="p-6">Company Entity</th>
                  <th className="p-6">Subscription</th>
                  <th className="p-6">Status</th>
                  <th className="p-6 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="p-6">
                      <div className="font-bold text-slate-900 dark:text-white">{tenant.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                         Admin: {tenant.ownerEmail}
                      </div>
                    </td>
                    <td className="p-6">
                      {/* Fixed: Replaced SubscriptionPlan.PREMIUM with SubscriptionPlan.PRO */}
                      <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${
                         tenant.plan === SubscriptionPlan.PRO ? 'bg-amber-50 border-amber-200 text-amber-600' : 
                         'bg-slate-50 border-slate-200 text-slate-600'
                       }`}>
                         {tenant.plan}
                       </span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tenant.status === TenantStatus.ACTIVE ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{tenant.status}</span>
                      </div>
                    </td>
                    <td className="p-6 text-right space-x-2">
                       <button 
                         onClick={() => toggleStatus(tenant)}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                           tenant.status === TenantStatus.ACTIVE 
                           ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                           : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                         }`}
                       >
                         {tenant.status === TenantStatus.ACTIVE ? 'Suspend' : 'Activate'}
                       </button>
                       <button 
                         onClick={() => setDeleteModal({ open: true, id: tenant.id, name: tenant.name, admin: tenant.ownerEmail })}
                         className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                       >
                         Delete
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 dark:bg-slate-800/20">
                  <th className="p-6">User / Mail ID</th>
                  <th className="p-6">Role</th>
                  <th className="p-6">Organisation</th>
                  <th className="p-6 text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing user directory...</td>
                  </tr>
                ) : globalUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="p-6">
                      <div className="font-bold text-slate-900 dark:text-white">{user.full_name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">UID: {user.id.substring(0, 8)}...</div>
                    </td>
                    <td className="p-6">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${
                        user.role === UserRole.SUPER_ADMIN ? 'bg-amber-50 border-amber-200 text-amber-600' :
                        user.role === UserRole.TENANT_ADMIN ? 'bg-primary-50 border-primary-200 text-primary-600' :
                        'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${user.tenants?.name ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="font-bold text-slate-700 dark:text-slate-300">{user.tenants?.name || 'PLATFORM_ROOT'}</span>
                      </div>
                    </td>
                    <td className="p-6 text-right text-[10px] text-slate-400 font-medium">
                      {new Date(user.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!loadingUsers && globalUsers.length === 0 && (
                   <tr>
                     <td colSpan={4} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No users found.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 dark:bg-slate-800/20">
                  <th className="p-6">Recipient Email</th>
                  <th className="p-6">Vehicle / Asset</th>
                  <th className="p-6">Alert Type</th>
                  <th className="p-6">Outcome</th>
                  <th className="p-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map(log => (
                  <tr key={log.id} className="text-xs">
                    <td className="p-6 font-bold">{log.recipient}</td>
                    <td className="p-6 font-mono text-[11px]">{log.vehicleReg}</td>
                    <td className="p-6">{log.docType}</td>
                    <td className="p-6">
                       <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${log.status === 'SENT' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                         {log.status}
                       </span>
                    </td>
                    <td className="p-6 text-right text-slate-400 font-medium">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                   <tr>
                     <td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No notifications processed yet.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ ...deleteModal, open: false })}
        onConfirm={() => onDeleteTenant(deleteModal.id)}
        title="Purge Workspace?"
        message={`CRITICAL: You are about to permanently delete the "${deleteModal.name}" workspace. This will remove all associated vehicles, records, logs, and the Tenant Admin profile for ${deleteModal.admin}. This action is irreversible.`}
        confirmText="Delete Workspace"
        type="danger"
      />
    </div>
  );
};

export default SuperAdminView;
