import React from 'react';
import { Check, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OPENING_COURSES } from '../data/openingCourses';

export const MembershipView: React.FC<{ onBrowseCourses: () => void }> = ({ onBrowseCourses }) => {
  const {
    user,
    profile,
    authLoading,
    authReady,
    effectiveTier,
    demoEnabled,
    signInWithGoogle,
    signOutUser,
    updateSubscription,
  } = useAuth();
  const total = OPENING_COURSES.reduce((n, c) => n + c.variations.length, 0);
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-[#E5A93C]">Preview release</p>
        <h1 className="mt-2 text-2xl font-bold">Learn at your own pace</h1>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Try the free lesson, or explore every course in the full demo. There is no checkout,
          subscription, or charge in this release.
        </p>
      </header>
      <section className="rounded-2xl border border-slate-400/15 bg-[#161E29] p-5 space-y-4">
        <h2 className="font-bold">
          {user ? `Welcome, ${profile.displayName}` : 'Keep your learning with you'}
        </h2>
        <p className="text-sm text-slate-400">
          {user
            ? 'Signed in. Cloud errors appear above; guest work is imported without replacing more recent account progress.'
            : 'Guest progress is saved in this browser. Sign in to import it into your account and continue on another device.'}
        </p>
        <button
          disabled={authLoading || !authReady}
          onClick={() => void (user ? signOutUser() : signInWithGoogle())}
          className="min-h-11 px-4 rounded-xl bg-[#222C3A] text-sm font-semibold inline-flex items-center gap-2"
        >
          {user ? <LogOut size={16} /> : <LogIn size={16} />}
          {user ? 'Sign out' : authLoading ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </section>
      <section className="rounded-2xl border border-[#E5A93C]/30 bg-[#161E29] p-5 space-y-5">
        <div>
          <h2 className="text-lg font-bold">Full repertoire demo</h2>
          <p className="text-sm text-slate-400 mt-2">
            Explore {OPENING_COURSES.length} courses and {total} lines. Demo access stays on this
            browser and does not create a paid membership.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-slate-300">
          {[
            'Choose Essentials, Advanced, or the Full Repertoire',
            'Learn with your coach, then test your memory',
            'Review learned lines and practice against bots',
            'Build personal lines and import or export PGN',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={17} className="shrink-0 text-[#2EB88A]" />
              {t}
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            if (effectiveTier !== 'pro') void updateSubscription('pro', 'annual');
            onBrowseCourses();
          }}
          className="min-h-12 w-full px-4 rounded-xl bg-[#E5A93C] text-slate-950 font-bold"
        >
          {effectiveTier === 'pro' ? 'Browse all courses' : 'Explore full demo — free'}
        </button>
        {demoEnabled && (
          <button
            onClick={() => void updateSubscription('free', 'annual', 'canceled')}
            className="min-h-11 w-full text-sm text-slate-400 underline"
          >
            End demo access
          </button>
        )}
      </section>
      <p className="text-xs text-slate-500 leading-relaxed">
        Paid plans are not available yet. Any future purchase will show its price and terms before
        payment.
      </p>
    </div>
  );
};
