
import React, { useState, useEffect } from 'react';
import { Company, Profile, UserRole, SubscriptionPlan, TenantStatus } from '../types';
import { ICONS } from '../constants';
import { supabase } from '../services/supabaseClient';
import ConfirmationModal from './ConfirmationModal';

const SuperAdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'companies'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string; type: 'user' | 'company' }>({
    open: false, id: '', name: '', type: 'user'
  });

  const fetchData = async () => {
    setLoading(true);
    const [uRes, cRes] = await Promise.all([
      supabase.from('profiles').select('*, companies(company_name, subscription_plan)').order('updated_at', { ascending: false }),
      supabase.from('companies').select('*').order('created_at', { ascending: false })
    ]);
    if (uRes.data) setUsers(uRes.data);
    if (cRes.data) setCompanies(cRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleStatusToggle = async (id: string, current: TenantStatus, table: 'profiles' | 'companies') => {
    const nextStatus = current === TenantStatus.ACTIVE ? TenantStatus.SUSPENDED : TenantStatus.ACTIVE;
    const { error } = await supabase.from(table).update({ status: nextStatus }).eq('id', id);
    if (!error) fetchData();
  };

  const handlePurge = async () => {
    const { type, id } = deleteModal;
    const table = type === 'user' ? 'profiles' : 'companies';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) fetchData();
    setDeleteModal({ ...deleteModal, open: false });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-display font-black tracking-tight uppercase">Platform Governance</h1>
        <p className="text-slate-500 font-medium italic">SaaS Master Access: Identity management and workspace auditing.</p>
      </header>

      <div className="ui-card rounded-[2rem] overflow-hidden shadow-soft">
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button onClick={() => setActiveTab('users')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest ${activeTab === 'users' ? 'border-b-4 border-primary-600 text-primary-600' : 'text-slate-400'}`}>Global Registry</button>
          <button onClick={() => setActiveTab('companies')} className={`px-10 py-5 text-[10px] font-black uppercase tracking-widest ${activeTab === 'companies' ? 'border-b-4 border-primary-600 text-primary-600' : 'text-slate-400'}`}>Workspaces</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="p-6">{activeTab === 'users' ? 'Identity' : 'Workspace'}</th>
                <th className="p-6">Company / Plan</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Root Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeTab === 'users' ? users.map(u => (
                <tr key={u.id}>
                  <td className="p-6">
                    <div className="font-bold">{u.full_name}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary-600">{u.role}</div>
                  </td>
                  <td className="p-6">
                    <div className="font-black text-xs uppercase">{u.companies?.company_name || 'PLATFORM_ROOT'}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{u.companies?.subscription_plan}</div>
                  </td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${u.status === TenantStatus.ACTIVE ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{u.status}</span>
                  </td>
                  <td className="p-6 text-right space-x-2">
                    {u.role !== UserRole.SUPER_ADMIN && (
                      <>
                        <button onClick={() => handleStatusToggle(u.id, u.status, 'profiles')} className="text-[9px] font-black uppercase bg-slate-100 p-2 rounded-lg">{u.status === TenantStatus.ACTIVE ? 'Suspend' : 'Resume'}</button>
                        <button onClick={() => setDeleteModal({ open: true, id: u.id, name: u.email, type: 'user' })} className="text-[9px] font-black uppercase bg-red-50 text-red-600 p-2 rounded-lg">Purge</button>
                      </>
                    )}
                  </td>
                </tr>
              )) : companies.map(c => (
                <tr key={c.id}>
                  <td className="p-6 font-bold uppercase">{c.company_name}</td>
                  <td className="p-6 font-black text-xs uppercase text-primary-600">{c.subscription_plan} TIER</td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${c.status === TenantStatus.ACTIVE ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{c.status}</span>
                  </td>
                  <td className="p-6 text-right">
                    <button onClick={() => handleStatusToggle(c.id, c.status, 'companies')} className="text-[9px] font-black uppercase bg-slate-100 p-2 rounded-lg mr-2">Toggle Status</button>
                    <button onClick={() => setDeleteModal({ open: true, id: c.id, name: c.company_name, type: 'company' })} className="text-[9px] font-black uppercase bg-red-50 text-red-600 p-2 rounded-lg">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmationModal isOpen={deleteModal.open} onClose={() => setDeleteModal({...deleteModal, open: false})} onConfirm={handlePurge} title={`Delete ${deleteModal.type}?`} message={`Are you sure you want to permanently delete "${deleteModal.name}"? This action cannot be reversed.`} />
    </div>
  );
};

export default SuperAdminView;
