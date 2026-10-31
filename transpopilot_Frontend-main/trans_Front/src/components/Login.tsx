import React, { useState, useRef } from 'react';
import { Truck, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, ArrowRight, Quote, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onNavigate: (page: string) => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { signIn, resendConfirmationEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setError(null);
    setResendSuccess(false);

    try {
      await resendConfirmationEmail(email);
      setResendSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to resend confirmation email. Please try again.');
      }
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Immediate synchronous lock against rapid double-clicks, Enter-spamming, and concurrent calls
    if (isSubmittingRef.current || loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (trimmedEmail.length > 255) {
      setError('Email address is too long.');
      return;
    }

    if (password.length > 128) {
      setError('Password is too long.');
      return;
    }

    setError(null);
    setEmailNotConfirmed(false);
    setResendSuccess(false);
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      await signIn(trimmedEmail, password);
      onNavigate('dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid email or password.';

      // Check for email confirmation errors
      if (errorMessage.includes('EMAIL_NOT_CONFIRMED:')) {
        const message = errorMessage.replace('EMAIL_NOT_CONFIRMED: ', '');
        setError(message);
        setEmailNotConfirmed(true);
      } else if (errorMessage.includes('EMAIL_LINK_EXPIRED:')) {
        const message = errorMessage.replace('EMAIL_LINK_EXPIRED: ', '');
        setError(message);
        setEmailNotConfirmed(true);
      } else if (errorMessage.includes('Network error') || errorMessage.includes('connection')) {
        setError('Network connection issue. Please check your internet connection and try again.');
      } else if (errorMessage.includes('Too many') || errorMessage.includes('rate limit')) {
        setError(errorMessage);
      } else {
        // Safe, generic invalid credential message preventing account enumeration
        setError('Invalid email or password.');
      }
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
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white mb-16 cursor-pointer group" onClick={() => onNavigate('landing')}>
            <div className="bg-blue-600 p-2 rounded-xl"><Truck className="h-6 w-6" /></div>
            <span className="text-2xl font-extrabold tracking-tight">TranspoPilot</span>
          </div>

          <div>
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-6">
              Welcome back to <br/> your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">command center.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              Sign in to monitor your fleet, optimize routes, and review Advanced driver analytics in real-time.
            </p>
          </div>
        </div>

        {/* Testimonial / Trust Marker */}
        <div className="relative z-10 bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
          <Quote className="h-8 w-8 text-blue-500/50 mb-4" />
          <p className="text-slate-300 text-sm font-medium leading-relaxed mb-4">
            "TranspoPilot has completely transformed how we view our operations. The AI insights have reduced our fuel costs significantly."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              SA
            </div>
            <div>
              <p className="text-white text-sm font-bold">Sharjeel Ahmed</p>
              <p className="text-slate-500 text-xs">Fleet Director, Logistics Pro</p>
            </div>
          </div>
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
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">Sign In</h2>
            <p className="text-slate-500 font-medium text-lg">Access your fleet dashboard</p>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-bold text-slate-700">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email" id="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="you@company.com" disabled={loading}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-bold text-slate-700">Password</label>
                  {/* <button type="button" onClick={() => onNavigate('forgot-password')} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                    Forgot password?
                  </button> */}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'} id="password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all outline-none font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="Enter your password" disabled={loading}
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

              {/* Remember Me */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={loading}
                      className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:bg-blue-600 checked:border-blue-600 transition-colors cursor-pointer"
                    />
                    <CheckCircle2 className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                  <span className="ml-3 text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Remember me</span>
                </label>
              </div>

              {/* Error & Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-start animate-fade-in">
                  <div className="flex items-start mb-2">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 shrink-0" />
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                  {emailNotConfirmed && (
                    <button
                      type="button" onClick={handleResendEmail} disabled={resendingEmail}
                      className="w-full mt-2 bg-white border border-red-200 text-red-700 py-2 px-4 rounded-lg font-bold hover:bg-red-50 transition-all text-sm flex items-center justify-center shadow-sm"
                    >
                      {resendingEmail ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Sending...</> : <><Mail className="h-4 w-4 mr-2" /> Resend Confirmation Email</>}
                    </button>
                  )}
                </div>
              )}

              {resendSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start animate-fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 mr-3 shrink-0" />
                  <p className="text-sm font-medium text-emerald-800">Confirmation email sent! Please check your inbox and click the link to verify your account.</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit" disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center group"
              >
                {loading ? <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Signing in...</> : <>Sign In <ArrowRight className="w-5 h-5 ml-2 opacity-50 group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-slate-100 pt-6">
              <p className="text-sm font-medium text-slate-500">
                Don't have an account?{' '}
                <button onClick={() => onNavigate('signup')} className="font-bold text-blue-600 hover:text-blue-700 transition-colors">Sign up for free</button>
              </p>
            </div>

          </div>
          
          <div className="mt-8 text-center">
            <button onClick={() => onNavigate('landing')} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
              Back to website
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Login;