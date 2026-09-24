/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  BadgeCheck,
  Phone,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  Cpu,
  Layers,
  Factory,
  KeyRound,
  Eye,
  EyeOff,
  Radio,
  Clock
} from 'lucide-react';
import { UserProfile, RoleTier } from '../types';
import { SYSTEM_ADMIN_EMAIL, verifySystemAdminPasscode } from '../utils/rbac';
import { SYSTEM_ADMIN_PROFILE, ROLE_TIERS } from '../mockData';
import { googleSignIn, googleSignOut } from '../lib/firebaseAuth';

interface AuthPageProps {
  isOpen?: boolean; // Can be used as a standalone page or modal
  onSuccess: (updatedProfile: UserProfile) => void;
  onCancel?: () => void;
  currentProfile?: UserProfile;
  roleTiers?: RoleTier[];
}

export const AuthPage: React.FC<AuthPageProps> = ({
  isOpen = true,
  onSuccess,
  onCancel,
  currentProfile,
  roleTiers = ROLE_TIERS
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'quick_role' | 'admin_pin'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(currentProfile?.name || '');
  const [employeeId, setEmployeeId] = useState(currentProfile?.employeeId || 'IE-9042');
  const [phoneNumber, setPhoneNumber] = useState(currentProfile?.phoneNumber || '');
  const [selectedTier, setSelectedTier] = useState<string>('tier_3'); // Line In-Charge / IE
  const [selectedWing, setSelectedWing] = useState<'Blue Wing' | 'Green Wing' | 'All'>('Blue Wing');
  const [adminPin, setAdminPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState(false);

  if (!isOpen) return null;

  // Preset role tier quick login handlers
  const handleQuickRoleSelect = (tierId: string) => {
    setSelectedTier(tierId);
    if (tierId === 'tier_1') {
      setFullName('Sr. IE Manager');
      setEmail('ie.manager@debonairgroup.com');
      setSelectedWing('All');
    } else if (tierId === 'tier_2') {
      setFullName('Wing Production Manager');
      setEmail('wing.manager@debonairgroup.com');
      setSelectedWing('Blue Wing');
    } else if (tierId === 'tier_3') {
      setFullName('IE In-Charge');
      setEmail('ie.incharge@debonairgroup.com');
      setSelectedWing('Blue Wing');
    } else if (tierId === 'tier_4') {
      setFullName('Line Industrial Engineer');
      setEmail('line.ie@debonairgroup.com');
      setSelectedWing('Blue Wing');
    }
  };

  // Google OAuth SSO Sign-in
  const handleGoogleSSO = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setUnauthorizedDomain(false);

    try {
      const res = await googleSignIn();
      if (res?.user) {
        const u = res.user;
        const userEmail = u.email || email;
        const isSysAdmin = userEmail.toLowerCase().trim() === SYSTEM_ADMIN_EMAIL.toLowerCase();
        
        const finalProfile: UserProfile = {
          ...(currentProfile || {}),
          name: isSysAdmin ? SYSTEM_ADMIN_PROFILE.name : (u.displayName || fullName || 'IE Engineer'),
          email: userEmail,
          photoURL: u.photoURL || (isSysAdmin ? SYSTEM_ADMIN_PROFILE.photoURL : undefined),
          googleUid: u.uid,
          employeeId: employeeId || 'IE-9042',
          phoneNumber: phoneNumber.trim() || currentProfile?.phoneNumber || undefined,
          role: isSysAdmin ? 'admin' : (selectedTier === 'tier_1' ? 'sr_manager' : selectedTier === 'tier_2' ? 'manager' : selectedTier === 'tier_3' ? 'ie_incharge' : 'line_ie'),
          tierId: isSysAdmin ? 'tier_0' : selectedTier,
          jobTitle: isSysAdmin ? 'System Administrator (Root Operations)' : (roleTiers.find(t => t.id === selectedTier)?.roleTitle || 'Industrial Engineer'),
          assignedUnit: isSysAdmin ? 'Debonair LTD (Unit-02) — Master Administration' : 'Unit 02 (Sewing Floor)',
          assignedWing: isSysAdmin ? 'All' : selectedWing,
          shift: isSysAdmin ? '24/7 Root Operations & System Control' : 'General Shift (8:00 AM - 5:00 PM)'
        };

        try {
          localStorage.setItem('ie_user_profile', JSON.stringify(finalProfile));
        } catch {}

        onSuccess(finalProfile);
      } else if (res?.error === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(true);
      } else if (res?.error === 'auth/popup-closed-by-user') {
        setErrorMsg('Google Sign-In was canceled by user.');
      } else if (res?.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('auth/unauthorized-domain')) {
        setUnauthorizedDomain(true);
      } else {
        setErrorMsg(err?.message || 'Failed to authenticate with Google SSO.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Direct Credential / Floor Passcode Authentication
  const handleEmailPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    
    // Check if user is attempting Root Admin login
    if (cleanEmail === SYSTEM_ADMIN_EMAIL.toLowerCase()) {
      if (!verifySystemAdminPasscode(password.trim() || adminPin.trim())) {
        setErrorMsg('Invalid System Administrator credentials or passcode.');
        return;
      }
      const adminProfile = {
        ...SYSTEM_ADMIN_PROFILE,
        assignedUnit: 'Debonair LTD (Unit-02) — Master Administration'
      };
      try {
        localStorage.setItem('ie_user_profile', JSON.stringify(adminProfile));
      } catch {}
      onSuccess(adminProfile);
      return;
    }

    if (!cleanEmail) {
      setErrorMsg('Please provide a valid employee email or username.');
      return;
    }

    const matchedTier = roleTiers.find(t => t.id === selectedTier) || roleTiers[2];

    const newProfile: UserProfile = {
      ...(currentProfile || {}),
      name: fullName.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      employeeId: employeeId.trim() || 'IE-9042',
      phoneNumber: phoneNumber.trim() || undefined,
      tierId: selectedTier,
      role: selectedTier === 'tier_1' ? 'sr_manager' : selectedTier === 'tier_2' ? 'manager' : selectedTier === 'tier_3' ? 'ie_incharge' : 'line_ie',
      jobTitle: matchedTier.roleTitle || matchedTier.name,
      assignedUnit: 'Debonair LTD (Unit 02)',
      assignedWing: selectedWing,
      shift: 'General Shift (8:00 AM - 5:00 PM)',
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName.trim() || cleanEmail)}&backgroundColor=176f78`
    };

    try {
      localStorage.setItem('ie_user_profile', JSON.stringify(newProfile));
    } catch {}

    onSuccess(newProfile);
  };

  // Master Admin Terminal Passcode Form
  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySystemAdminPasscode(adminPin.trim())) {
      const adminProfile = {
        ...SYSTEM_ADMIN_PROFILE,
        assignedUnit: 'Debonair LTD (Unit-02) — Master Administration'
      };
      try {
        localStorage.setItem('ie_user_profile', JSON.stringify(adminProfile));
      } catch {}
      onSuccess(adminProfile);
    } else {
      setErrorMsg('Invalid System Master Passcode.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#faf8f4] border border-[#d9d2c2] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Visual Brand Banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#176f78] via-[#10565e] to-[#0d444a] text-white flex items-center justify-between border-b border-teal-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-teal-200 border border-white/20 shadow-inner">
              <Factory className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight uppercase text-white font-display">
                  IE Daily Control
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400 text-teal-950 font-bold uppercase tracking-wider">
                  Plant Auth
                </span>
              </div>
              <p className="text-xs text-teal-100/80 font-medium">
                Debonair Group LTD &bull; Unit 02 Production Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection: Operational Login vs Quick Role Switching vs Admin PIN */}
        <div className="px-6 pt-3 pb-1 border-b border-[#e7e1d5] bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setAuthMode('signin')}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              authMode === 'signin'
                ? 'bg-[#176f78] text-white shadow-2xs'
                : 'text-[#506e75] hover:bg-[#f1eee6]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Sign In / SSO</span>
          </button>

          <button
            type="button"
            onClick={() => setAuthMode('admin_pin')}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto ${
              authMode === 'admin_pin'
                ? 'bg-amber-500 text-teal-950 shadow-2xs font-black'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Admin Passcode</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode 1: Primary Sign-in & Google SSO */}
          {authMode === 'signin' && (
            <div className="space-y-5">
              {/* Google OAuth 2.0 / Firebase SSO Button */}
              <button
                type="button"
                onClick={handleGoogleSSO}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl border border-[#d9d2c2] bg-white hover:bg-[#f5f3ec] text-[#17343a] text-sm font-bold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-3 cursor-pointer touch-manipulation active:scale-[0.99]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google Workspace</span>
              </button>

              {unauthorizedDomain && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-amber-900 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Quick Local Sign-In Available</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Browser domain authorization notice detected. You can instantly sign in using the floor credentials below or click below to authorize as Lead IE:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const demoProfile: UserProfile = {
                        ...(currentProfile || {}),
                        name: 'Ashik Hossain (IE)',
                        email: 'ashikhossainkr@gmail.com',
                        jobTitle: 'IE Executive (Sewing Floor)',
                        role: 'ie_incharge',
                        tierId: 'tier_3',
                        assignedUnit: 'Unit 02 (Sewing Floor)',
                        assignedWing: 'Blue Wing',
                        shift: 'General Shift (8:00 AM - 5:00 PM)',
                        photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=Ashik%20Hossain&backgroundColor=176f78'
                      };
                      try {
                        localStorage.setItem('ie_user_profile', JSON.stringify(demoProfile));
                      } catch {}
                      onSuccess(demoProfile);
                    }}
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-teal-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Authorize as Ashik Hossain (IE Executive)
                  </button>
                </div>
              )}

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#d9d2c2] w-full" />
                <span className="bg-[#faf8f4] px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Or Sign In with Employee ID
                </span>
                <div className="border-t border-[#d9d2c2] w-full" />
              </div>

              {/* Email / ID + Password Form */}
              <form onSubmit={handleEmailPasswordSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[#17343a] block mb-1">
                    Employee Email / Login ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. ashik.ie@debonairgroup.com"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#d9d2c2] bg-white text-xs text-[#17343a] focus:outline-hidden focus:border-[#176f78] transition-colors"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#17343a] block mb-1">
                    Employee Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Ashik Hossain"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#d9d2c2] bg-white text-xs text-[#17343a] focus:outline-hidden focus:border-[#176f78] transition-colors"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#17343a] block mb-1">
                    Employee ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={employeeId}
                      onChange={e => setEmployeeId(e.target.value)}
                      placeholder="e.g. IE-9042"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#d9d2c2] bg-white text-xs text-[#17343a] focus:outline-hidden focus:border-[#176f78] transition-colors font-mono uppercase"
                    />
                    <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#17343a] block mb-1">
                    Employee Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="e.g. +880 1712-345678"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#d9d2c2] bg-white text-xs text-[#17343a] focus:outline-hidden focus:border-[#176f78] transition-colors font-mono"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-[#176f78] hover:bg-[#125860] text-white text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all touch-manipulation active:scale-[0.98] mt-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate &amp; Enter Floor Cockpit</span>
                </button>
              </form>
            </div>
          )}

          {/* Mode 2: Quick Role Switching for Multi-Tier Plant Demonstrations */}
          {authMode === 'quick_role' && (
            <div className="space-y-4">
              <p className="text-xs text-[#476369] leading-relaxed">
                Select an operational role tier to immediately configure user scopes, line balancing permissions, and department visibility:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tier 1 */}
                <button
                  type="button"
                  onClick={() => handleQuickRoleSelect('tier_1')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedTier === 'tier_1'
                      ? 'border-[#176f78] bg-[#dceceb]/50 ring-2 ring-[#176f78]/30 shadow-2xs'
                      : 'border-[#d9d2c2] bg-white hover:bg-[#f1eee6]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#17343a]">Tier 1: Sr. Manager</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      Plant Wide
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Full oversight across all 24 lines, learning curve approvals &amp; export signing.
                  </p>
                </button>

                {/* Tier 2 */}
                <button
                  type="button"
                  onClick={() => handleQuickRoleSelect('tier_2')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedTier === 'tier_2'
                      ? 'border-[#176f78] bg-[#dceceb]/50 ring-2 ring-[#176f78]/30 shadow-2xs'
                      : 'border-[#d9d2c2] bg-white hover:bg-[#f1eee6]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#17343a]">Tier 2: Production Mgr</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Wing Control
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Authority over assigned wing (Blue/Green), hourly target adjustments &amp; bottleneck routing.
                  </p>
                </button>

                {/* Tier 3 */}
                <button
                  type="button"
                  onClick={() => handleQuickRoleSelect('tier_3')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedTier === 'tier_3'
                      ? 'border-[#176f78] bg-[#dceceb]/50 ring-2 ring-[#176f78]/30 shadow-2xs'
                      : 'border-[#d9d2c2] bg-white hover:bg-[#f1eee6]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#17343a]">Tier 3: IE In-Charge</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                      Line Group
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Manpower balancing, SAM calculations, skill matrix allocation &amp; morning huddles.
                  </p>
                </button>

                {/* Tier 4 */}
                <button
                  type="button"
                  onClick={() => handleQuickRoleSelect('tier_4')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedTier === 'tier_4'
                      ? 'border-[#176f78] bg-[#dceceb]/50 ring-2 ring-[#176f78]/30 shadow-2xs'
                      : 'border-[#d9d2c2] bg-white hover:bg-[#f1eee6]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#17343a]">Tier 4: Line IE</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      Workstation
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Cycle time telemetry capture, pitch diagram updates &amp; WIP monitoring.
                  </p>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleEmailPasswordSubmit}
                  className="w-full py-3 rounded-2xl bg-[#176f78] hover:bg-[#125860] text-white text-xs font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all touch-manipulation active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm &amp; Load Tier Role</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 3: Master Admin Passcode */}
          {authMode === 'admin_pin' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-amber-950 text-xs space-y-2">
                <div className="font-bold flex items-center justify-between text-amber-900">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Master Administrator Elevation</span>
                  </div>
                  <span className="font-mono text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md font-bold">
                    Tier 0 Root
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Master System Administrator root authorization is exclusively assigned to{' '}
                  <span className="font-mono font-bold text-amber-950 underline">{SYSTEM_ADMIN_EMAIL}</span> (Ashikur Rahman). Enter the root security key to authorize this terminal session.
                </p>
              </div>

              <form onSubmit={handleAdminPinSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#17343a] block mb-1">
                    Root Master Passcode
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={adminPin}
                    onChange={e => setAdminPin(e.target.value)}
                    placeholder="Enter root passcode (e.g. 911999)"
                    className="w-full px-4 py-3 rounded-2xl border border-amber-300 bg-white text-center font-mono text-base tracking-widest text-[#17343a] focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-teal-950 font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all touch-manipulation active:scale-[0.98]"
                >
                  <Lock className="w-4 h-4" />
                  <span>Verify Passcode &amp; Elevate Root</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3.5 bg-[#f1eee6] border-t border-[#e7e1d5] flex items-center justify-between text-[11px] text-[#506e75]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-Bit Local Session Security</span>
          </div>
          <span>Debonair LTD &bull; Bangladesh</span>
        </div>
      </div>
    </div>
  );
};
