import React, { useState } from 'react';
import coachAvatar from '../assets/images/bot_avatar_viktor_1794860679687.jpg';

interface CoachFeedbackProps {
  badgeColor: string;
  badgeContent: React.ReactNode;
  headline: string;
  chipText?: string;
  comment: string;
  bubbleActions?: React.ReactNode;
}

// Keep feedback and actions within reserved rows so moves cannot shift the board.
export function CoachFeedback({ badgeColor, badgeContent, headline, chipText, comment, bubbleActions }: CoachFeedbackProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
      <section
        aria-label="Coach feedback"
        className="flex items-start gap-2 sm:gap-3"
      >
        <div className="mt-3 w-10 h-10 sm:w-12 sm:h-12 shrink-0 overflow-hidden rounded-xl border border-slate-400/15 bg-[#161E29]">
          {avatarFailed ? (
            <span role="img" aria-label="Chess coach" className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">CM</span>
          ) : (
            <img
              src={coachAvatar}
              alt="Chess coach"
              width={48}
              height={48}
              onError={() => setAvatarFailed(true)}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 h-36 sm:h-32 shrink-0 grid grid-rows-[auto_minmax(0,1fr)_2rem] gap-2 rounded-xl border border-slate-400/12 bg-[#161E29] p-3 sm:p-4"
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-white font-bold text-[10px]"
              style={{ backgroundColor: badgeColor }}
              aria-hidden="true"
            >
              {badgeContent}
            </span>
            <span title={headline} className="font-display font-semibold text-sm text-slate-100 truncate">
              {headline}
            </span>
          </div>
          {chipText && (
            <span className="text-slate-400 font-mono text-[11px] tabular-nums shrink-0">
              {chipText}
            </span>
          )}
        </div>
        <p tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain text-xs sm:text-[13px] text-slate-300 leading-relaxed" aria-live="polite" aria-atomic="true">
          {comment}
        </p>
        <div className="min-h-0 overflow-y-auto overscroll-contain flex items-center text-[11px] font-semibold [&_button]:text-[#F7D08A] [&_span]:text-slate-400 [&>div]:w-full">
          {bubbleActions}
        </div>
        </div>
      </section>
  );
}
