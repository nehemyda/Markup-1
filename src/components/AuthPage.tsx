import React, { useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { isEmailDomainAllowed } from '../lib/userProfile';
import { getAllowedDomains } from '../utils/domains';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Users, 
  UserPlus,
  User as UserIcon,
  Globe,
} from 'lucide-react';

// Turn Firebase Auth error codes into readable messages
function describeAuthError(err: any): string {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Authentication.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
}

export const AuthPage: React.FC<{ notice?: string | null }> = ({ notice }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(notice || null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [allowedDomains] = useState<string[]>(() => getAllowedDomains());

  // Messages from App after sign-in (e.g. access removed) arrive while this page is still open
  useEffect(() => {
    if (notice) {
      setErrorMsg(notice);
      setIsLoading(false);
    }
  }, [notice]);

  const domainDeniedMessage = (addr: string) => {
    const domain = addr.split('@')[1]?.toLowerCase().trim() || '';
    return `Access Denied: Your email domain (@${domain}) is not authorized by the Super Admin. Allowed organization domains: ${allowedDomains.map(d => '@' + d).join(', ')}.`;
  };

  const switchMode = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  // Email + password sign in / create account. On success, App's onAuthStateChanged takes over.
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!isEmailDomainAllowed(email)) {
      setErrorMsg(domainDeniedMessage(email));
      return;
    }

    setIsLoading(true);
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      setErrorMsg(describeAuthError(err));
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!isEmailDomainAllowed(result.user.email)) {
        await signOut(auth);
        setErrorMsg(domainDeniedMessage(result.user.email || ''));
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(describeAuthError(err));
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.includes('@')) {
      setErrorMsg('Enter your email address above, then click "Forgot?" again.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg(`If an account exists for ${email.trim()}, a password reset link has been sent.`);
    } catch (err: any) {
      setErrorMsg(describeAuthError(err));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans relative overflow-hidden">
      
      {/* Background Decorative Gradient Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-indigo-600/30 via-purple-600/20 to-pink-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-indigo-500/30 border border-indigo-400/30">
            W
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              WebReview Pro
            </span>
            <span className="ml-2.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold tracking-widest uppercase">
              Enterprise v2.4
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-6 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SOC2 Type II Certified</span>
          </div>
          <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
            <Globe className="w-3.5 h-3.5" />
            <span>US-East (Virginia) Region</span>
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-6xl mx-auto px-4 py-8 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 z-10">
        
        {/* Left Column: Value Proposition & Security Trust */}
        <div className="max-w-xl space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-indigo-300 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Real-time Website & Design Annotation Workspace</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Review, annotate & ship production UI <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">10x faster.</span>
          </h1>

          <p className="text-base text-slate-300 leading-relaxed font-normal">
            Welcome to the centralized review portal for <strong className="text-white font-semibold">YourDigitalAgents Enterprise</strong>. Connect live URLs, Figma frames, or staging environments and collaborate synchronously with AI-assisted review workflows.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-left">
            <div className="bg-slate-800/50 border border-slate-700/60 p-4 rounded-xl space-y-1.5 hover:border-slate-600/80 transition-colors">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Users className="w-4 h-4" />
                <span>Organization RBAC</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Granular permission controls for Admins, Designers, Product Managers, and External Reviewers.
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/60 p-4 rounded-xl space-y-1.5 hover:border-slate-600/80 transition-colors">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Building2 className="w-4 h-4" />
                <span>Multi-Asset Workspaces</span>
              </div>
              <p className="text-xs text-slate-400 leading-normal">
                Organize feedback across staging URLs, mobile viewports, and marketing landing pages in one hub.
              </p>
            </div>
          </div>

          {/* Trust Banner */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>SAML 2.0 / Okta SSO</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>99.99% Enterprise SLA</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>AES-256 Encrypted</span>
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Login Box */}
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-xl">
          
          {/* Auth Mode Tabs */}
          <div className="grid grid-cols-2 border-b border-slate-700/80 bg-slate-900/50 text-xs font-semibold">
            <button
              onClick={() => switchMode('signin')}
              className={`py-3.5 px-2 text-center transition-all flex items-center justify-center gap-1 ${
                authMode === 'signin' 
                  ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`py-3.5 px-2 text-center transition-all flex items-center justify-center gap-1 ${
                authMode === 'signup' 
                  ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Error Message Display */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-medium flex items-center gap-2 animate-shake">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* FORM: EMAIL + PASSWORD */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Organization Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourdigitalagents.com"
                    autoComplete="email"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                  {authMode === 'signin' && (
                    <a href="#forgot" onClick={handleForgotPassword} className="text-xs text-indigo-400 hover:underline">
                      Forgot?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authMode === 'signup' ? 'At least 6 characters' : '••••••••••••'}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-sm"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{authMode === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
                    </span>
                  ) : (
                    <>
                      <span>{authMode === 'signup' ? 'Create Account' : 'Sign In to Workspace'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* GOOGLE SIGN IN */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                <span className="flex-1 h-px bg-slate-700/80" />
                <span>or</span>
                <span className="flex-1 h-px bg-slate-700/80" />
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-white hover:bg-slate-100 text-slate-800 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 cursor-pointer text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            {/* AUTHORIZED DOMAIN ACCESS BADGE */}
            <div className="p-3.5 bg-slate-900/90 border border-indigo-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authorized Organization Domains</span>
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Super Admin Protected</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Only email addresses on these domains can sign in or create an account. Domains are managed by Super Admins inside workspace settings.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {allowedDomains.map((dom) => (
                  <span
                    key={dom}
                    className="text-[11px] font-mono px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-emerald-300 font-semibold"
                  >
                    @{dom}
                  </span>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Security Footer */}
          <div className="px-6 py-3.5 bg-slate-900/80 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-indigo-400" />
              <span>Protected by Cloudflare Turnstile</span>
            </span>
            <span className="font-mono text-slate-500">v2.4.19-ent</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>All Systems Operational</span>
          <span className="text-slate-700">|</span>
          <span>© 2026 MarkFlow Studio Inc. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 font-medium">
          <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:text-slate-400 transition-colors">Privacy Policy</a>
          <a href="#terms" onClick={(e) => e.preventDefault()} className="hover:text-slate-400 transition-colors">Enterprise Terms of Service</a>
          <a href="#security" onClick={(e) => e.preventDefault()} className="hover:text-slate-400 transition-colors">Security Whitepaper</a>
          <a href="#support" onClick={(e) => e.preventDefault()} className="hover:text-slate-400 transition-colors">24/7 Priority Support</a>
        </div>
      </footer>
    </div>
  );
};
