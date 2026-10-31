import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, AlertCircle, Loader2, MapPin, Route as RouteIcon, Brain, Activity, ArrowRight, CheckCircle2, Truck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SignupProps {
  onNavigate: (page: string) => void;
}

const Signup: React.FC<SignupProps> = ({ onNavigate }) => {
  const { signUp, resendConfirmationEmail, session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    if (session?.user) {
      onNavigate('dashboard');
    }
  }, [session, onNavigate]);

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        setConnectionStatus('Configuration error: Supabase credentials missing.');
        return;
      }
      const { error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      setConnectionStatus('Connection passed! Database is active.');
    } catch (err: any) {
      setConnectionStatus(`Connection failed: ${err.message || 'Network error'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setError(null);
    try {
      await resendConfirmationEmail(email);
      setSuccessMessage('Confirmation email sent! Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend confirmation email.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Immediate synchronous lock against rapid double-clicks, Enter-spamming, and concurrent calls
    if (isSubmittingRef.current || loading) return;

    setError(null);
    setSuccessMessage(null);
    setEmailConfirmationRequired(false);
    setAccountExists(false);
    setProgressMessage('');

    // Client-side validation
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedEmail.length > 255) {
      setError('Email address is too long.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    if (password.length > 128) {
      setError('Password cannot exceed 128 characters.');
      return;
    }

    const lowerPass = password.toLowerCase();
    const commonWeak = ['password1234', '123456789012', 'admin1234567', 'qwertyuiop12', 'transpopilot12'];
    if (commonWeak.includes(lowerPass) || lowerPass === trimmedEmail) {
      setError('Password is too common or easily guessable. Please choose a more secure passphrase.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // 🚀 FRONTEND SENDS 'user' ROLE HERE:
      await signUp(trimmedEmail, password, undefined, 'user', undefined, setProgressMessage);
      onNavigate('dashboard');
    } catch (err: any) {
      let errorMessage = 'Unable to create your account right now. Please try again.';
      if (err.message?.includes('EMAIL_CONFIRMATION_REQUIRED')) {
        setSuccessMessage(err.message.split(': ')[1] || 'Please confirm your email.');
        setEmailConfirmationRequired(true);
        setLoading(false);
        return;
      }
      
      if (err.message?.includes('WEAK_PASSWORD') || err.message?.includes('Password must be')) {
        errorMessage = 'Password must be at least 12 characters long.';
      } else if (err.message?.includes('RATE_LIMIT') || err.message?.includes('rate limit')) {
        errorMessage = 'Too many attempts. Please wait a moment and try again.';
      } else if (err.message?.includes('Network error') || err.message?.includes('network')) {
        errorMessage = 'Unable to connect to the authentication server. Please check your internet connection.';
      } else if (err.message) {
        // Strip out internal technical prefixes
        errorMessage = err.message.replace(/^(.*?):\s*/, '');
      }
      
      setError(errorMessage);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex selection:bg-blue-100">
      
      {/* LEFT SIDE - Premium Dark Branding (Hidden on Mobile) */}
      <div className="hidden lg:flex w-5/12 bg-slate-950 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white mb-12 cursor-pointer group" onClick={() => onNavigate('landing')}>
            <div className="bg-blue-600 p-2 rounded-xl"><Truck className="h-6 w-6" /></div>
            <span className="text-2xl font-extrabold tracking-tight">TranspoPilot</span>
          </div>

          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md mb-6">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>
              <span className="text-slate-300 text-xs font-bold tracking-widest uppercase">Beta Access Live</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-6">
              Transform your fleet <br/> with Advanced <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">intelligence.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              Join our exclusive beta program and get instant access to our core telematics modules.
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Included in Beta:</h3>
            
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-500/30 text-blue-400 shrink-0"><MapPin className="h-6 w-6" /></div>
              <div>
                <h4 className="text-white font-bold text-lg">Live Fleet Tracking</h4>
                <p className="text-slate-400 text-sm">Real-time GPS mapping and status.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30 text-emerald-400 shrink-0"><RouteIcon className="h-6 w-6" /></div>
              <div>
                <h4 className="text-white font-bold text-lg">Route Optimization</h4>
                <p className="text-slate-400 text-sm">Save fuel with smart pathing.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30 text-indigo-400 shrink-0"><Brain className="h-6 w-6" /></div>
              <div>
                <h4 className="text-white font-bold text-lg">Driver Behavior</h4>
                <p className="text-slate-400 text-sm">Monitor safety and harsh events.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-12 border-t border-white/10 mt-12">
          <p className="text-slate-500 text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-400" /> Advanced features unlockable via Premium.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE - Clean Form Area */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-12 relative bg-[#FAFAFA]">
        
        <div className="w-full max-w-md">
          {/* Mobile Logo Header */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-10 cursor-pointer group" onClick={() => onNavigate('landing')}>
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/30"><Truck className="h-6 w-6 text-white" /></div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">TranspoPilot</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">Create Account</h2>
            <p className="text-slate-500 font-medium text-lg">Start your 14-day free beta trial</p>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Business Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="you@company.com" disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="Minimum 12 characters"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Status Messages */}
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-start">
                  <div className="flex items-start w-full">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 shrink-0" />
                    <p className="text-sm font-medium text-red-800 flex-1">{error}</p>
                  </div>
                  {accountExists && (
                    <button type="button" onClick={() => onNavigate('login')} className="mt-3 ml-8 text-sm font-bold text-red-700 bg-red-100/80 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors border border-red-200/50">
                      Sign In to Your Account
                    </button>
                  )}
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <div className="flex items-start mb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 mr-3 shrink-0" />
                    <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
                  </div>
                  {emailConfirmationRequired && (
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={handleResendEmail} disabled={resendingEmail} className="flex-1 bg-emerald-600 text-white py-2 px-3 rounded-lg font-bold hover:bg-emerald-700 transition-all text-sm flex justify-center items-center">
                        {resendingEmail ? <Loader2 className="animate-spin h-4 w-4" /> : 'Resend Email'}
                      </button>
                      <button type="button" onClick={() => onNavigate('login')} className="flex-1 bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg font-bold hover:bg-slate-50 transition-all text-sm">
                        Go to Sign In
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center group"
              >
                {loading ? <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Creating account...</> : <>Create Account <ArrowRight className="w-5 h-5 ml-2 opacity-50 group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-slate-100 pt-6">
              <p className="text-sm font-medium text-slate-500">
                Already have an account?{' '}
                <button onClick={() => onNavigate('login')} className="font-bold text-blue-600 hover:text-blue-700">Sign in here</button>
              </p>
            </div>
            
            {/* Subtle Test Connection Button */}
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={testConnection} disabled={testingConnection || loading} className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center transition-colors">
                {testingConnection ? <><Loader2 className="animate-spin h-3 w-3 mr-1" /> Testing DB...</> : <><Activity className="h-3 w-3 mr-1" /> Run Diagnostics</>}
              </button>
            </div>
            {connectionStatus && <p className="text-xs text-center mt-2 text-slate-500 font-medium">{connectionStatus}</p>}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;