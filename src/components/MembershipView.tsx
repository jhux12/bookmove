import React, { useState } from 'react';
import {
  Check,
  Crown,
  Lock,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OPENING_COURSES } from '../data/openingCourses';
import { BillingCycle } from '../types/chess';

interface MembershipViewProps {
  onBrowseCourses: () => void;
}

const FREE_PREVIEW_FEATURES = [
  '1 Preview Opening Line: Italian Game (Giuoco Piano: Central Strike)',
  'Interactive Guided Arrows + Flawless Solo Recall Test',
  'All 7 Other Opening Courses & 47 Variations Locked',
  'Full AI Bot Sparring, Tactical Puzzles & Endgame Drills',
];

const PRO_FEATURES = [
  'All 8 Opening Courses & 48+ Deep Repertoire Variations Unlocked',
  'Random Learned Practice with Side, Course & Due Filters',
  'Opponent Deviation Branch Trainer & Timed 5s Blitz Recall',
  'Ply-Level Mistake Heatmap & Weak-Spot Jump Drills',
  'Custom Repertoire Builder with PGN Import & Export',
  'Post-Game Opening Deviation Report & Cloud Sync',
];

export const MembershipView: React.FC<MembershipViewProps> = ({ onBrowseCourses }) => {
  const {
    user,
    authLoading,
    authError,
    profile,
    effectiveTier,
    lineProgress,
    customLines,
    signInWithGoogle,
    signOutUser,
    updateSubscription,
  } = useAuth();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>(profile.billingCycle);
  const [updatingAction, setUpdatingAction] = useState<'activate' | 'cancel' | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const totalCatalogLines = OPENING_COURSES.reduce((acc, c) => acc + c.variations.length, 0);
  const masteredCount = Object.values(lineProgress).filter((p) => p.masteryPct >= 80).length;
  const isPro = effectiveTier === 'pro';
  const proMonthlyPrice = billingCycle === 'annual' ? 6 : 9;

  const handleActivatePro = async () => {
    setUpdatingAction('activate');
    setStatusBanner(null);
    try {
      await updateSubscription('pro', billingCycle, 'active');
      setStatusBanner(
        user
          ? `Checkmate Pro (${billingCycle}) activated and synced to your account.`
          : `Checkmate Pro preview activated locally. Sign in with Google to sync across devices.`
      );
    } finally {
      setUpdatingAction(null);
    }
  };

  const handleCancelPro = async () => {
    setUpdatingAction('cancel');
    setStatusBanner(null);
    try {
      await updateSubscription('pro', billingCycle, 'canceled');
      setStatusBanner(
        'Subscription canceled. Reverted to Free Preview (1 Italian Game line unlocked).'
      );
    } finally {
      setUpdatingAction(null);
    }
  };

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-7 space-y-7">
      {/* Header & Account Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#161E29] border border-slate-400/12 rounded-2xl p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
            <span>
              {masteredCount} / {totalCatalogLines} Lines Perfected
            </span>
            <span aria-hidden="true">·</span>
            <span>{customLines.length} Custom Lines</span>
            <span aria-hidden="true">·</span>
            <span className={isPro ? 'text-[#2EB88A] font-semibold' : 'text-[#E5A93C] font-semibold'}>
              {isPro ? 'Checkmate Pro Active' : 'Free Preview (1 Line)'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-100 tracking-tight">
            {user ? `Welcome, ${profile.displayName}` : 'Checkmate Pro Membership'}
          </h1>
          <p className="text-xs text-slate-400">
            {user
              ? `Signed in as ${profile.email} · Your mastery, weak-spot heatmaps, and custom lines sync automatically.`
              : 'Sign in with Google to sync your opening mastery, custom lines, and Checkmate Pro membership across devices.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#2EB88A] font-medium px-3 py-1.5 rounded-lg bg-[#0F151E] border border-[#2EB88A]/25">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Synced</span>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="px-3.5 py-2 rounded-xl bg-[#0F151E] hover:bg-[#222C3A] border border-slate-400/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={authLoading}
              className="px-4 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#F0B952] disabled:opacity-50 text-[#0E131B] font-display font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'Signing in...' : 'Sign In with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="px-4 py-3 rounded-xl bg-red-950/40 border border-[#EB6150]/40 text-xs text-[#FCA5A5]">
          {authError}
        </div>
      )}

      {statusBanner && (
        <div className="px-4 py-3 rounded-xl bg-[#2EB88A]/12 border border-[#2EB88A]/35 text-xs text-[#A7F3D0] flex items-center justify-between gap-3">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={onBrowseCourses}
            className="font-semibold text-white underline cursor-pointer shrink-0"
          >
            Go to Courses
          </button>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-100">
            One Membership. Every Opening Unlocked.
          </h2>
          <p className="text-xs text-slate-400">
            Preview 1 Italian Game line free, or unlock all {totalCatalogLines} repertoire variations and advanced drills with Checkmate Pro.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-xl">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              billingCycle === 'monthly'
                ? 'bg-[#222C3A] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              billingCycle === 'annual'
                ? 'bg-[#222C3A] text-[#F7D08A]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Annual (Save 33%)
          </button>
        </div>
      </div>

      {/* Preview vs Single Subscription Tier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Free Preview Card */}
        <div
          className={`rounded-2xl p-6 flex flex-col justify-between gap-6 border ${
            !isPro
              ? 'bg-[#1A2432] border-[#2EB88A]/70'
              : 'bg-[#161E29] border-slate-400/12'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <h3 className="font-display text-lg font-bold text-slate-100">
                  Free Preview
                </h3>
              </div>
              {!isPro && (
                <span className="text-[11px] font-semibold text-[#2EB88A]">
                  Current Access
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Try the guided arrow walkthrough and flawless recall workflow with one Italian Game line before subscribing.
            </p>

            <div className="pt-1">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold text-white tabular-nums">
                  $0
                </span>
                <span className="text-xs text-slate-400">preview</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                1 Italian Game line unlocked · No card needed
              </p>
            </div>

            <ul className="space-y-2.5 pt-3 border-t border-slate-400/12">
              {FREE_PREVIEW_FEATURES.map((feat, i) => (
                <li key={feat} className="flex items-start gap-2 text-xs text-slate-300">
                  {i === 2 ? (
                    <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  ) : (
                    <Check className="w-4 h-4 text-[#2EB88A] shrink-0 mt-0.5" />
                  )}
                  <span className={`leading-snug ${i === 2 ? 'text-slate-400' : ''}`}>
                    {feat}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onBrowseCourses}
            className="w-full py-2.5 px-4 rounded-xl bg-[#222C3A] hover:bg-[#2D3A4C] text-slate-100 font-display font-bold text-xs transition-colors cursor-pointer"
          >
            Preview Italian Game Line
          </button>
        </div>

        {/* Single Subscription Tier: Checkmate Pro */}
        <div
          className={`rounded-2xl p-6 flex flex-col justify-between gap-6 border ${
            isPro
              ? 'bg-[#1A2432] border-[#2EB88A]'
              : 'bg-[#18212E] border-[#E5A93C]/75'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#E5A93C]" />
                <h3 className="font-display text-lg font-bold text-slate-100">
                  Checkmate Pro
                </h3>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  isPro ? 'text-[#2EB88A]' : 'text-[#E5A93C]'
                }`}
              >
                {isPro ? 'Active Membership' : 'Full Access'}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Complete opening mastery suite with all {OPENING_COURSES.length} courses ({totalCatalogLines} variations), deviation branches, blitz drills, and PGN tools.
            </p>

            <div className="pt-1">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold text-white tabular-nums">
                  ${proMonthlyPrice}
                </span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                {billingCycle === 'annual'
                  ? 'Billed $72 annually · Cancel anytime'
                  : 'Billed monthly · Cancel anytime'}
              </p>
            </div>

            <ul className="space-y-2.5 pt-3 border-t border-slate-400/12">
              {PRO_FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-xs text-slate-200">
                  <Check className="w-4 h-4 text-[#2EB88A] shrink-0 mt-0.5" />
                  <span className="leading-snug">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            {isPro ? (
              <>
                <button
                  type="button"
                  onClick={onBrowseCourses}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2EB88A]/18 border border-[#2EB88A]/40 text-[#2EB88A] hover:bg-[#2EB88A]/25 font-display font-bold text-xs transition-colors cursor-pointer"
                >
                  Open All {totalCatalogLines} Repertoire Lines
                </button>
                <button
                  type="button"
                  disabled={updatingAction === 'cancel'}
                  onClick={handleCancelPro}
                  className="w-full py-1.5 text-[11px] font-medium text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  {updatingAction === 'cancel' ? 'Canceling...' : 'Cancel Subscription'}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={updatingAction === 'activate'}
                onClick={handleActivatePro}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] font-display font-bold text-xs transition-colors cursor-pointer"
              >
                {updatingAction === 'activate'
                  ? 'Activating Pro...'
                  : `Unlock Checkmate Pro ($${proMonthlyPrice}/mo)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
