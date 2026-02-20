
import React, { useState } from 'react';
import { Profile, UserRole, AccessLevel } from '../types';
import { ICONS } from '../constants';
import { supabase } from '../services/supabaseClient';

interface Props {
  members: Profile[];
  companyId: string;
  onRefresh: () => void;
}

const TeamManagement: React.FC<Props> = ({ members, companyId, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<AccessLevel>(AccessLevel.READ_ONLY);
  const [password, setPassword] = useState('');

  const handleAdd = async () => {
    if (members.length >= 4) { // Admin + 3 users = 4 profiles
      alert("Seat limit reached (Max 3 team members per company).");
      return;
    }

    const { data, error } = await (supabase.auth as any).signUp({
      email,
      password,
      options: {
        data: {
          role: UserRole.TENANT_USER,
          company_id: companyId,
          access_level: access,
          full_name: email.split('@')[0]
        }
      }
    });

    if (!error) {
      onRefresh();
      setIsAdding(false);
      setEmail('');
    } else {
      alert(error.message);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) onRefresh();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-black uppercase tracking-tight">Access Control</h1>
          <p className="text-xs text-slate-500 font-medium">{members.length - 1} / 3 slots utilized.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)} 
          disabled={members.length >= 4}
          className="px-6 py-3 bg-primary-600 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/20 active:scale-95"
        >
          Add Team Member
        </button>
      </header>

      <div className="ui-card rounded-[2rem] overflow-hidden shadow-soft">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="p-6">Member</th>
              <th className="p-6">Role / Access</th>
              <th className="p-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map(m => (
              <tr key={m.id}>
                <td className="p-6">
                  <div className="font-bold">{m.full_name}</div>
                  <div className="text-[10px] text-slate-400 lowercase">{m.email}</div>
                </td>
                <td className="p-6">
                  <div className="text-[10px] font-black uppercase tracking-widest text-primary-600">{m.role}</div>
                  <div className="text-[9px] font-bold uppercase text-slate-400">{m.access_level || 'OWNER'}</div>
                </td>
                <td className="p-6 text-right">
                  {m.role !== UserRole.TENANT_ADMIN && (
                    <button onClick={() => handleRemove(m.id)} className="text-red-400 hover:text-red-600 p-2 transition-all"><ICONS.Trash className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-display font-black mb-8 uppercase">Invite Member</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email</label>
                <input required className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Temporary Password</label>
                <input required type="password" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Access Level</label>
                <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold appearance-none" value={access} onChange={e => setAccess(e.target.value as AccessLevel)}>
                  <option value={AccessLevel.READ_ONLY}>READ ONLY</option>
                  <option value={AccessLevel.FULL_ACCESS}>FULL ACCESS</option>
                </select>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
                <button onClick={handleAdd} className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase">Invite</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
