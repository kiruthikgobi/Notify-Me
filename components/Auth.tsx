
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ICONS } from '../constants';
import { UserRole } from '../types';

interface AuthProps {
  onAuthComplete: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthComplete }) => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.TENANT_ADMIN);
  const [error, setError] = useState<string | null>(null);
  const [superAdminExists, setSuperAdminExists] = useState<boolean>(true);

  const checkAdminStatus = async () => {
    try {
      const { data: exists, error: rpcError } = await supabase.rpc('is_super_admin_configured');
      if (rpcError) console.log("RPC Error (is_super_admin_configured):", rpcError);
      if (!rpcError) setSuperAdminExists(!!exists);
    } catch (e) {
      console.log("Exception checking admin status:", e);
    }
  };

  useEffect(() => { checkAdminStatus(); }, [isSignUp]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        let tenantId = null;

        if (selectedRole === UserRole.TENANT_ADMIN) {
          // 1. Create Tenant
          const { data: tenant, error: tError } = await supabase
            .from('tenants')
            .insert({ name: companyName.trim(), plan: 'FREE', status: 'ACTIVE' })
            .select().single();
          
          if (tError) {
            console.log("Tenant Creation Error:", tError);
            throw new Error("Failed to create workspace: " + tError.message);
          }
          tenantId = tenant.id;
          console.log("New Tenant Created:", tenantId);
        }

        // 2. Sign Up User
        // Cast auth to any to resolve property missing error on SupabaseAuthClient
        const { data: authData, error: signUpError } = await (supabase.auth as any).signUp({ 
          email: email.toLowerCase().trim(), 
          password,
          options: { 
            data: { 
              full_name: email.split('@')[0], 
              role: selectedRole, 
              tenant_id: tenantId 
            } 
          }
        });

        if (signUpError) {
          console.log("Auth SignUp Error:", signUpError);
          throw signUpError;
        }

        if (!authData.session) {
          setError("Verification required. Please check your email.");
          setLoading(false);
          return;
        }
      } else {
        // Sign In
        // Cast auth to any to resolve property missing error on SupabaseAuthClient
        const { error: signInError } = await (supabase.auth as any).signInWithPassword({ 
          email: email.toLowerCase().trim(), 
          password 
        });
        
        if (signInError) {
          console.log("Auth SignIn Error:", signInError);
          throw new Error("Invalid credentials or user does not exist.");
        }
      }
      onAuthComplete();
    } catch (err: any) {
      console.log("Auth Flow Exception:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-primary-500/20">
            <ICONS.Logo className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-display font-black text-slate-900 dark:text-white">Notify Me</h1>
        </div>
        <div className="ui-card p-8 md:p-10 rounded-[2.5rem] shadow-elevated border-slate-100 dark:border-slate-800">
          <form onSubmit={handleAuth} className="space-y-6">
            {isSignUp && !superAdminExists && (
              <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6 grid grid-cols-2 gap-1">
                <button type="button" onClick={() => setSelectedRole(UserRole.TENANT_ADMIN)} className={`py-3 text-[10px] font-black uppercase rounded-xl transition-all ${selectedRole === UserRole.TENANT_ADMIN ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400'}`}>Fleet Admin</button>
                <button type="button" onClick={() => setSelectedRole(UserRole.SUPER_ADMIN)} className={`py-3 text-[10px] font-black uppercase rounded-xl transition-all ${selectedRole === UserRole.SUPER_ADMIN ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400'}`}>Super Admin</button>
              </div>
            )}
            
            {isSignUp && selectedRole === UserRole.TENANT_ADMIN && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
                <input required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" placeholder="Fleet Name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email Address</label>
                <input required type="email" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Password</label>
                <input required type="password" minLength={6} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              {isSignUp && (
                <div className="animate-in fade-in duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Confirm Password</label>
                  <input required type="password" minLength={6} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 text-xs font-bold rounded-2xl bg-red-50 text-red-600 border border-red-100 animate-shake">
                {error}
              </div>
            )}

            <button disabled={loading} className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs tracking-widest shadow-xl shadow-primary-500/20 transition-all disabled:opacity-50 uppercase active:scale-[0.98]">
              {loading ? 'Processing...' : (isSignUp ? 'Register Fleet' : 'Sign In')}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="text-xs font-bold text-slate-400 hover:text-primary-600 uppercase tracking-widest">
              {isSignUp ? 'Already have an account? Sign In' : 'Need a Fleet Workspace? Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
