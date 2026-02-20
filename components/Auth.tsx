
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

  // Checks if the platform already has a Super Admin configured
  const checkAdminStatus = async () => {
    try {
      const { data: exists, error: rpcErr } = await supabase.rpc('is_super_admin_configured');
      if (!rpcErr) setSuperAdminExists(!!exists);
    } catch (e) {
      console.error("Platform Audit Failed:", e);
    }
  };

  useEffect(() => { checkAdminStatus(); }, [isSignUp]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedEmail = email.toLowerCase().trim();

    try {
      if (isSignUp) {
        if (password !== confirmPassword) throw new Error("Passkeys do not match.");
        
        // Validation for Tenant Admin
        if (selectedRole === UserRole.TENANT_ADMIN && !companyName.trim()) {
          throw new Error("Organization identity is required.");
        }

        // SIGN UP: The trigger in schema.sql will handle creating the company and profile automatically
        const { data: authData, error: signUpError } = await supabase.auth.signUp({ 
          email: trimmedEmail, 
          password,
          options: { 
            data: { 
              full_name: trimmedEmail.split('@')[0], 
              role: selectedRole,
              company_name: selectedRole === UserRole.TENANT_ADMIN ? companyName.trim() : null
            } 
          }
        });

        if (signUpError) {
          if (signUpError.message.includes('Database error saving new user')) {
            throw new Error("Registry is busy provisioning your node. Please wait 10 seconds and sign in normally.");
          }
          throw signUpError;
        }

        if (!authData.session && authData.user) {
          setError("Activation sequence initiated. Check your inbox to verify your terminal.");
          setLoading(false);
          return;
        }
      } else {
        // SIGN IN
        const { error: signInError } = await supabase.auth.signInWithPassword({ 
          email: trimmedEmail, 
          password 
        });
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error("Access denied. Verify your credentials.");
          }
          throw signInError;
        }
      }
      onAuthComplete();
    } catch (err: any) {
      console.error("Auth System Trace:", err);
      setError(err.message || "A secure connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-2xl animate-pulse">
            <ICONS.Logo className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter">Notify Me</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Enterprise SaaS Mobility</p>
        </div>
        
        <div className="ui-card p-10 rounded-[2.5rem] shadow-2xl bg-slate-900 border-slate-800 border-opacity-50">
          <form onSubmit={handleAuth} className="space-y-6">
            {isSignUp && !superAdminExists && (
              <div className="p-1 bg-slate-800 rounded-2xl mb-6 grid grid-cols-2 gap-1 border border-slate-700">
                <button type="button" onClick={() => setSelectedRole(UserRole.TENANT_ADMIN)} className={`py-3 text-[9px] font-black uppercase rounded-xl transition-all ${selectedRole === UserRole.TENANT_ADMIN ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400'}`}>Fleet Owner</button>
                <button type="button" onClick={() => setSelectedRole(UserRole.SUPER_ADMIN)} className={`py-3 text-[9px] font-black uppercase rounded-xl transition-all ${selectedRole === UserRole.SUPER_ADMIN ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400'}`}>Platform Root</button>
              </div>
            )}
            
            {isSignUp && selectedRole === UserRole.TENANT_ADMIN && (
              <div className="animate-in slide-in-from-top-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Organization Identity</label>
                <input required className="w-full p-4 bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold text-white transition-all placeholder:text-slate-600" placeholder="e.g. Acme Logistics" value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Terminal Email</label>
                <input required type="email" className="w-full p-4 bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold text-white transition-all" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Secure Passkey</label>
                <input required type="password" minLength={6} className="w-full p-4 bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold text-white transition-all" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              {isSignUp && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Verify Passkey</label>
                  <input required type="password" minLength={6} className="w-full p-4 bg-slate-800 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none font-bold text-white transition-all" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
              )}
            </div>

            {error && <div className="p-4 text-[11px] font-bold rounded-2xl bg-red-950/30 text-red-500 border border-red-900/50 animate-in fade-in zoom-in-95">{error}</div>}

            <button disabled={loading} className="w-full py-5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-[10px] tracking-[0.2em] shadow-xl transition-all disabled:opacity-50 uppercase active:scale-95">
              {loading ? 'Initializing...' : (isSignUp ? 'Initiate Node' : 'Authorize Identity')}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-800 text-center">
            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="text-[9px] font-black text-slate-500 hover:text-primary-500 uppercase tracking-[0.2em] transition-colors">
              {isSignUp ? 'Existing Identity? Sign In' : 'New Workspace? Register Terminal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
