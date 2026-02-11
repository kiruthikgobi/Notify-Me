
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { UserRole } from '../types';
import { supabase } from '../services/supabaseClient';
import ConfirmationModal from './ConfirmationModal';

interface TeamManagementProps {
  tenantId: string;
  tenantName?: string;
  users: any[];
  onRefresh: () => void;
  addToast: (title: string, message: string, type?: any) => void;
  userRole?: UserRole;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ tenantId, tenantName, users, onRefresh, addToast, userRole }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.TENANT_VIEWER);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string }>({
    open: false, id: '', name: ''
  });

  const isAdmin = userRole === UserRole.TENANT_ADMIN;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      addToast('Permission Denied', 'Only administrators can add team members.', 'error');
      return;
    }

    if (users.length >= 3) {
      addToast('Limit Reached', 'You can only create a maximum of 3 team members.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      addToast('Validation Error', 'The passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: email.split('@')[0],
            role: selectedRole,
            tenant_id: tenantId,
            organization_name: tenantName || 'Unknown Organization'
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: email.split('@')[0],
          role: selectedRole,
          tenant_id: tenantId,
          updated_at: new Date().toISOString()
        });
      }

      addToast('Success', 'Team member added successfully.', 'success');
      setIsAdding(false);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setSelectedRole(UserRole.TENANT_VIEWER);
      
      setTimeout(() => {
        onRefresh();
      }, 1000);

    } catch (err: any) {
      addToast('Error', err.message || 'Could not create team member.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      addToast('Access Revoked', 'Team member removed.', 'info');
      onRefresh();
    } catch (err: any) {
      addToast('Error', 'Could not remove team member.', 'error');
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.TENANT_ADMIN: return 'Administrator';
      case UserRole.TENANT_MANAGER: return 'Full Access';
      case UserRole.TENANT_VIEWER: return 'Read Only';
      default: return role;
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Team Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage access roles for your fleet workspace.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAdding(true)}
            disabled={users.length >= 3}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
          >
            <ICONS.Plus className="w-4 h-4" />
            Add Team Member
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="ui-card p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Plan Quota</h4>
            <div className="flex items-end justify-between">
               <div className="text-3xl font-display font-black text-slate-900 dark:text-white">{users.length} <span className="text-slate-300">/ 3</span></div>
               <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">Slots Occupied</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
               <div className="bg-primary-600 h-full transition-all duration-1000" style={{ width: `${(users.length / 3) * 100}%` }} />
            </div>
         </div>

         <div className="md:col-span-2 ui-card p-6 rounded-2xl flex items-center gap-6">
            <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
               <ICONS.Brain className="w-6 h-6" />
            </div>
            <div>
               <h4 className="font-bold text-sm">Role-Based Permissions</h4>
               <p className="text-xs text-slate-500 leading-relaxed"><b>Full Access</b> users can manage the fleet and documents. <b>Read-Only</b> users can only monitor and export reports.</p>
            </div>
         </div>
      </div>

      <div className="ui-card rounded-3xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                <th className="p-6">Member Identity</th>
                <th className="p-6">Access Role</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="p-6">
                    <div className="font-bold text-slate-900 dark:text-white">{u.full_name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">Joined {new Date(u.updated_at).toLocaleDateString()}</div>
                  </td>
                  <td className="p-6">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${
                      u.role === UserRole.TENANT_MANAGER 
                      ? 'bg-blue-50 border-blue-200 text-blue-600' 
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      {getRoleLabel(u.role).toUpperCase()}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    {isAdmin && (
                      <button 
                        onClick={() => setDeleteModal({ open: true, id: u.id, name: u.full_name })}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                      >
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No team members added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-display font-bold mb-6">Invite Team Member</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email Address</label>
                <input required type="email" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Access Role</label>
                <select 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all"
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as UserRole)}
                >
                  <option value={UserRole.TENANT_VIEWER}>Read Only (View Assets & Export)</option>
                  <option value={UserRole.TENANT_MANAGER}>Full Access (Add/Edit/Delete Documents)</option>
                </select>
                <p className="text-[9px] text-slate-400 mt-2 font-medium">Managers can perform all actions except subscription and team management.</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Temporary Password</label>
                <input required type="password" minLength={8} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Confirm Password</label>
                <input required type="password" minLength={8} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-500/20 active:scale-95 transition-all disabled:opacity-50">
                   {loading ? 'Processing...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ ...deleteModal, open: false })} onConfirm={() => handleRemoveUser(deleteModal.id)} title="Revoke Access?" message={`Are you sure you want to remove access for "${deleteModal.name}"?`} confirmText="Remove Access" type="danger" />
    </div>
  );
};

export default TeamManagement;
