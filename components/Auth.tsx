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
  const [superAdminExists, setSuperAdminExists] = useState<boolean>(false);

  // Dynamic check for Super Admin existence
  const checkAdminStatus = async () => {
    try {
      const { count, error: rpcError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', UserRole.SUPER_ADMIN);
        
      if (!rpcError) {
        setSuperAdminExists((count || 0) > 0);
        if ((count || 0) > 0 && selectedRole === UserRole.SUPER_ADMIN) {
          setSelectedRole(UserRole.TENANT_ADMIN);
        }
      }
    } catch (e) {
      console.error("Super Admin check failed:", e);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [isSignUp]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const sanitizedEmail = email.toLowerCase().trim();

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match. Please verify your credentials.");
        }

        if (selectedRole === UserRole.TENANT_ADMIN && !companyName.trim()) {
          throw new Error("Fleet registration requires a company name.");
        }

        let tenantId: string | null = null;

        if (selectedRole === UserRole.TENANT_ADMIN) {
          const { data: tenant, error: tError } = await supabase
            .from('tenants')
            .insert({ name: companyName.trim() })
            .select()
            .single();
            
          if (tError) {
            if (tError.message.includes('unique constraint')) {
              throw new Error("This organization name is already registered.");
            }
            throw new Error(`Workspace provisioning failed: ${tError.message}`);
          }
          tenantId = tenant.id;

          await supabase.from('automation_config').insert({ 
            tenant_id: tenantId,
            recipients: [sanitizedEmail]
          });
        }

        const { data, error: signUpError } = await supabase.auth.signUp({ 
          email: sanitizedEmail, 
          password,
          options: {
            data: {
              full_name: sanitizedEmail.split('@')[0],
              role: selectedRole,
              tenant_id: tenantId
            }
          }
        });
        
        if (signUpError) throw signUpError;

        if (data && !data.session) {
          setError("Account created! Please verify your email inbox for a confirmation link.");
          setLoading(false);
          return;
        }

      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ 
          email: sanitizedEmail, 
          password 
        });
        
        if (signInError) {
          throw new Error("Incorrect email or password. Please verify your credentials.");
        }
      }

      onAuthComplete();
    } catch (err: any) {
      console.error("Auth Fault:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-primary-500/30 transform hover:rotate-3 transition-transform">
            <ICONS.Logo className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">Notify Me</h1>
        </div>

        <div className="ui-card p-8 md:p-10 rounded-[2.5rem] shadow-elevated border-slate-100 dark:border-slate-800">
          <form onSubmit={handleAuth} className="space-y-6">
            
            {isSignUp && !superAdminExists && (
              <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedRole(UserRole.TENANT_ADMIN)}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${selectedRole === UserRole.TENANT_ADMIN ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Fleet Admin
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole(UserRole.SUPER_ADMIN)}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${selectedRole === UserRole.SUPER_ADMIN ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Super Admin
                </button>
              </div>
            )}

            {isSignUp && selectedRole === UserRole.TENANT_ADMIN && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Company Name</label>
                <input 
                  required
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all"
                  placeholder="e.g. Acme Logistics"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                />
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email</label>
                <input 
                  required
                  type="email"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Password</label>
                <input 
                  required
                  type="password"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {isSignUp && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Confirm Password</label>
                  <input 
                    required
                    type="password"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold transition-all"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 text-xs font-bold rounded-2xl border border-red-100 bg-red-50 text-red-600">
                {error}
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs tracking-widest shadow-2xl shadow-primary-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'PROCESSING...' : (isSignUp ? 'REGISTER' : 'SIGN IN')}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSelectedRole(UserRole.TENANT_ADMIN);
              }}
              className="text-xs font-bold text-slate-400 hover:text-primary-600 transition-colors uppercase tracking-widest"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'New Fleet Owner? Sign Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;