import React, { useEffect, useRef, useState } from 'react';
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
import { checkWorkspaceAccess, accessDeniedMessage } from '../lib/userProfile';
import { useAllowedDomains } from '../utils/domains';
import { useBranding } from '../lib/workspaceSettings';
import { AppLogo } from './AppLogo';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  UserPlus,
  User as UserIcon,
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
  // Invite links (/?invite=<email>) open Create Account with the invited email filled in
  const invitedEmail = (() => {
    try {
      const value = new URLSearchParams(window.location.search).get('invite') || '';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.trim().toLowerCase() : '';
    } catch (e) {
      return '';
    }
  })();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(invitedEmail ? 'signup' : 'signin');
  const [name, setName] = useState('');
  // Email = name + a domain from the workspace's allowed list, or a full address typed in for "Other"
  const [emailName, setEmailName] = useState('');
  const [emailDomain, setEmailDomain] = useState<string>(() => {
    try {
      return localStorage.getItem('mf_login_domain') || '';
    } catch (e) {
      return '';
    }
  });
  const [otherEmail, setOtherEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(notice || null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const allowedDomains = useAllowedDomains();
  const branding = useBranding();
  const OTHER = '__other';
  // No list yet, or a remembered domain that is no longer allowed: use the first one
  const domainChoice = !allowedDomains.length
    ? OTHER
    : emailDomain === OTHER || allowedDomains.includes(emailDomain)
      ? emailDomain
      : allowedDomains[0];
  const email = domainChoice === OTHER ? otherEmail : emailName.trim() ? `${emailName.trim()}@${domainChoice}` : '';

  const chooseDomain = (value: string) => {
    setEmailDomain(value);
    try {
      localStorage.setItem('mf_login_domain', value);
    } catch (e) {}
  };

  // Pasting a whole address into the name box picks its domain (or switches to Other)
  // Put the invited email in place once the allowed domains are known (name + domain, or "Other")
  const appliedInvite = useRef(false);
  useEffect(() => {
    if (!invitedEmail || appliedInvite.current) return;
    const [local, domain] = invitedEmail.split('@');
    if (allowedDomains.includes(domain)) {
      setEmailName(local);
      setEmailDomain(domain);
    } else {
      setOtherEmail(invitedEmail);
      setEmailDomain(OTHER);
    }
    appliedInvite.current = true;
  }, [allowedDomains]);

  const changeEmailName = (value: string) => {
    const at = value.indexOf('@');
    if (at === -1) return setEmailName(value);
    const domain = value.slice(at + 1).trim().toLowerCase();
    if (allowedDomains.includes(domain)) {
      setEmailName(value.slice(0, at));
      chooseDomain(domain);
    } else {
      setOtherEmail(value.trim());
      chooseDomain(OTHER);
    }
  };

  // Messages from App after sign-in (e.g. access removed) arrive while this page is still open
  useEffect(() => {
    if (notice) {
      setErrorMsg(notice);
      setIsLoading(false);
    }
  }, [notice]);

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

    setIsLoading(true);
    if (!(await checkWorkspaceAccess(email))) {
      setErrorMsg(accessDeniedMessage(email.trim()));
      setIsLoading(false);
      return;
    }
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
      // App's onAuthStateChanged checks access and shows a message if this account is not allowed
      await signInWithPopup(auth, new GoogleAuthProvider());
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
          <AppLogo branding={branding} className="w-10 h-10 rounded-xl text-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/30 border border-indigo-400/30" />
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              {branding.appName}
            </span>
          </div>
        </div>

      </header>

      {/* Main Container */}
      <main className="w-full max-w-6xl mx-auto px-4 py-8 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 z-10">
        
        {/* Left Column: what the app is for */}
        <div className="max-w-xl space-y-4 text-center lg:text-left">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Website review for the <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">YourDigitalAgents</span> team
          </h1>
          <p className="text-base text-slate-300 leading-relaxed">
            Pin feedback on live pages, share review links with clients, and fix WordPress pages with AI.
          </p>
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
            {invitedEmail && authMode === 'signup' && (
              <div className="bg-indigo-500/10 border border-indigo-400/30 text-indigo-200 rounded-xl px-3 py-2 text-xs">
                You've been invited to <strong className="text-white">{branding.appName}</strong>. Create your account with <strong className="text-white">{invitedEmail}</strong>, or continue with Google using that address.
              </div>
            )}
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
                <div className="flex items-stretch bg-slate-900/80 border border-slate-700 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                  <div className="relative flex-1 min-w-[72px]">
                    {domainChoice === OTHER && <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />}
                    {domainChoice === OTHER ? (
                      <input
                        type="email"
                        required
                        value={otherEmail}
                        onChange={(e) => setOtherEmail(e.target.value)}
                        placeholder="name@company.com"
                        autoComplete="email"
                        autoFocus={allowedDomains.length > 0}
                        className="w-full bg-transparent pl-10 pr-2 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        required
                        value={emailName}
                        onChange={(e) => changeEmailName(e.target.value)}
                        placeholder="your.name"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="w-full bg-transparent pl-3.5 pr-1 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                    )}
                  </div>
                  {allowedDomains.length > 0 && (
                    <select
                      value={domainChoice}
                      onChange={(e) => chooseDomain(e.target.value)}
                      aria-label="Email domain"
                      className="shrink-0 bg-slate-800/80 border-l border-slate-700 rounded-r-xl px-2.5 text-sm text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {allowedDomains.map((dom) => (
                        <option key={dom} value={dom}>@{dom}</option>
                      ))}
                      <option value={OTHER}>Other email…</option>
                    </select>
                  )}
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


          </div>


        </div>
      </main>

      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-xs text-slate-500 text-center sm:text-left z-10">
        © {new Date().getFullYear()} YourDigitalAgents
      </footer>
    </div>
  );
};
