import React, { useState } from 'react';
import { AuthUser, Organization, Teammate } from '../types';
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
  KeyRound,
  ChevronRight,
  Globe,
  Briefcase
} from 'lucide-react';

interface AuthPageProps {
  onLogin: (user: AuthUser, org: Organization) => void;
  availableTeammates: Teammate[];
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin, availableTeammates }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'sso'>('signin');
  const [email, setEmail] = useState('nehemiahc@yourdigitalagents.com');
  const [password, setPassword] = useState('••••••••••••');
  const [orgDomain, setOrgDomain] = useState('yourdigitalagents.com');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ssoStep, setSsoStep] = useState<'domain' | 'provider'>('domain');
  const [allowedDomains] = useState<string[]>(() => getAllowedDomains());

  // Default Enterprise Organization with Unlimited Seats SLA
  const defaultOrg: Organization = {
    id: 'org-yda-enterprise',
    name: 'YourDigitalAgents Enterprise',
    domain: 'yourdigitalagents.com',
    allowedDomains: allowedDomains,
    plan: 'Enterprise',
    ssoEnabled: true,
    maxSeats: 'Unlimited',
    activeSeats: 12
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    setTimeout(() => {
      if (!email.includes('@')) {
        setErrorMsg('Please enter a valid work email address.');
        setIsLoading(false);
        return;
      }

      // Check if email domain is authorized by Super Admin
      const domain = email.split('@')[1]?.toLowerCase().trim() || '';
      const isDomainAllowed = allowedDomains.some(d => d.toLowerCase() === domain);

      if (!isDomainAllowed) {
        setErrorMsg(`Access Denied: Your email domain (@${domain}) is not authorized by the Super Admin. Allowed organization domains: ${allowedDomains.map(d => '@' + d).join(', ')}.`);
        setIsLoading(false);
        return;
      }

      // Check if user matches any existing teammate
      const existing = availableTeammates.find(t => t.email.toLowerCase() === email.toLowerCase());
      
      const loggedInUser: AuthUser = {
        id: existing?.id || `user-${Date.now()}`,
        name: existing?.name || email.split('@')[0].replace(/\./g, ' '),
        email: email,
        avatar: existing?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: existing?.role || 'Member (Editor & Annotator)',
        organizationId: defaultOrg.id,
        organizationName: defaultOrg.name,
        status: 'online',
        cursorColor: existing?.cursorColor || '#6366f1'
      };

      setIsLoading(false);
      onLogin(loggedInUser, defaultOrg);
    }, 600);
  };

  const handleQuickTeammateLogin = (teammate: Teammate) => {
    setErrorMsg(null);
    const domain = teammate.email.split('@')[1]?.toLowerCase().trim() || '';
    if (!allowedDomains.some(d => d.toLowerCase() === domain)) {
      setErrorMsg(`Access Denied: The domain @${domain} is not authorized by the Super Admin.`);
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const authUser: AuthUser = {
        id: teammate.id,
        name: teammate.name,
        email: teammate.email,
        avatar: teammate.avatar,
        role: (teammate.role === 'Owner' || teammate.role === 'Admin') ? 'Admin' : (teammate.role as any),
        organizationId: defaultOrg.id,
        organizationName: defaultOrg.name,
        status: 'online',
        cursorColor: teammate.cursorColor
      };
      setIsLoading(false);
      onLogin(authUser, defaultOrg);
    }, 400);
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
              onClick={() => { setAuthMode('signin'); setErrorMsg(null); }}
              className={`py-3.5 px-2 text-center transition-all ${
                authMode === 'signin' 
                  ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Work Sign In
            </button>
            <button
              onClick={() => { setAuthMode('sso'); setErrorMsg(null); }}
              className={`py-3.5 px-2 text-center transition-all flex items-center justify-center gap-1 ${
                authMode === 'sso' 
                  ? 'bg-slate-800 text-indigo-400 border-b-2 border-indigo-500 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Enterprise SSO</span>
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

            {/* FORM: WORK EMAIL SIGN IN */}
            {authMode === 'signin' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Password / Security Token
                    </label>
                    <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Password reset link sent to your corporate email.'); }} className="text-xs text-indigo-400 hover:underline">
                      Forgot?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
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
                        <span>Verifying Workspace Credentials...</span>
                      </span>
                    ) : (
                      <>
                        <span>Sign In to Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* FORM: ENTERPRISE SSO / SAML */}
            {authMode === 'sso' && (
              <div className="space-y-4">
                {ssoStep === 'domain' ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    setErrorMsg(null);
                    const cleanedDom = orgDomain.trim().toLowerCase().replace(/^@/, '');
                    if (!allowedDomains.some(d => d.toLowerCase() === cleanedDom)) {
                      setErrorMsg(`Access Denied: The domain @${cleanedDom} is not authorized by the Super Admin. Allowed organization domains: ${allowedDomains.map(d => '@' + d).join(', ')}.`);
                      return;
                    }
                    setIsLoading(true);
                    setTimeout(() => {
                      setIsLoading(false);
                      setSsoStep('provider');
                    }, 500);
                  }} className="space-y-4">
                    <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 leading-relaxed">
                      <strong className="text-white block mb-0.5">💡 Why Enterprise SSO?</strong>
                      Single Sign-On (SSO) allows enterprise employees to authenticate securely via Okta, Google Workspace, or Azure AD without managing a separate password.
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Organization Work Domain
                      </label>
                      <div className="relative flex items-center">
                        <Globe className="absolute left-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={orgDomain}
                          onChange={(e) => setOrgDomain(e.target.value)}
                          placeholder="yourdigitalagents.com"
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-24 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                        />
                        <span className="absolute right-3 text-xs text-slate-500 font-mono">.sso.markflow.io</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-sm mt-2"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Discovering SAML Provider...</span>
                        </span>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Discover Identity Provider</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-400 mb-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Okta / SAML 2.0 Identity Bridge Discovered</span>
                      </div>
                      We found an active corporate SAML SSO provider for <strong className="text-white font-mono">{orgDomain}</strong>.
                    </div>

                    <div className="p-3.5 bg-slate-900/80 border border-slate-700 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Identity Provider:</span>
                        <strong className="text-white">Okta Identity Cloud</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Default Super Admin:</span>
                        <strong className="text-indigo-400">nehemiahc@{orgDomain}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Seat Allocation:</span>
                        <strong className="text-emerald-400">Unlimited (Enterprise Plan)</strong>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-800/80 rounded-lg text-[11px] text-slate-400 leading-normal border border-slate-700/60">
                      ℹ️ <strong className="text-slate-300">Why does clicking authorize log in automatically?</strong><br/>
                      In real production environments, this redirects to your company's Okta login portal. In this live prototype studio, clicking authorize instantly completes the SAML token handshake and signs you in as the Super Admin / Owner.
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSsoStep('domain')}
                        className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
                      >
                        Change Domain
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsLoading(true);
                          setTimeout(() => {
                            const adminTeammate = availableTeammates.find(t => t.email.includes('nehemiah')) || availableTeammates[4];
                            const authUser: AuthUser = {
                              id: adminTeammate.id,
                              name: adminTeammate.name,
                              email: `nehemiahc@${orgDomain}`,
                              avatar: adminTeammate.avatar,
                              role: 'Admin',
                              organizationId: defaultOrg.id,
                              organizationName: defaultOrg.name,
                              status: 'online',
                              cursorColor: adminTeammate.cursorColor
                            };
                            setIsLoading(false);
                            onLogin(authUser, defaultOrg);
                          }, 600);
                        }}
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-xs"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Authenticating via Okta...</span>
                          </span>
                        ) : (
                          <>
                            <KeyRound className="w-4 h-4" />
                            <span>Authorize Okta SAML (Super Admin)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                No password registration required. Corporate domain settings are managed strictly by logged-in Super Admins inside workspace settings.
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

            {/* INSTANT DEMO ACCOUNT SWITCHER */}
            <div className="pt-4 border-t border-slate-700/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
                <span>Quick Test with Active Teammate</span>
                <span className="text-indigo-400 font-normal">Click to login</span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {availableTeammates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleQuickTeammateLogin(t)}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900/60 hover:bg-slate-700/80 border border-slate-700/60 hover:border-indigo-500/50 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <img src={t.avatar} alt={t.name} className="w-8 h-8 rounded-full object-cover border border-slate-600 group-hover:border-indigo-400" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate flex items-center gap-1.5">
                          <span>{t.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            t.role === 'Owner' || t.role === 'Admin' 
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold' 
                              : 'bg-slate-800 text-slate-400 font-normal'
                          }`}>
                            {t.role === 'Owner' ? 'Super Admin / Owner' : t.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate font-mono">{t.email}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
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
