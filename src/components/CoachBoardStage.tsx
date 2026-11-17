import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export interface CoachBottomAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
}

interface CoachBoardStageProps {
  // Top Header
  onBack?: () => void;
  backLabel?: string;
  topLeft?: React.ReactNode;
  title: string;
  topRight?: React.ReactNode;
  subHeader?: React.ReactNode;

  // Horizontal Bar (either Eval Bar or Progress/Timer Bar)
  barMode: 'eval' | 'progress';
  barPct: number; // 0..100
  barLeftLabel?: string;
  barRightLabel?: string;
  barFillColor?: string;

  // Coach Speech Bubble
  badgeColor: string;
  badgeContent: React.ReactNode;
  headline: string;
  chipText?: string;
  comment: string;
  bubbleActions?: React.ReactNode;

  // Chessboard slot
  board: React.ReactNode;

  // Inline horizontal ribbon below board (move strip, switcher, or engine candidates)
  ribbon?: React.ReactNode;

  // 4-action minimal bottom dock (4th or marked primary gets green CTA)
  bottomActions: CoachBottomAction[];

  // Optional subtle footer note
  footerHint?: string;
}

export const CoachBoardStage: React.FC<CoachBoardStageProps> = ({
  onBack,
  backLabel = 'Back',
  topLeft,
  title,
  topRight,
  subHeader,
  barMode,
  barPct,
  barLeftLabel,
  barRightLabel,
  barFillColor = '#2EB88A',
  badgeColor,
  badgeContent,
  headline,
  chipText,
  comment,
  bubbleActions,
  board,
  ribbon,
  bottomActions,
  footerHint,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const clampedPct = Math.max(barMode === 'eval' ? 4 : 0, Math.min(barMode === 'eval' ? 96 : 100, barPct));
  const whiteLeading = clampedPct >= 50;

  return (
    <div className="max-w-[580px] mx-auto px-3 sm:px-4 py-3 sm:py-5 flex flex-col gap-3">
      {/* 1. Minimal Top Bar */}
      <header className="flex items-center justify-between gap-2 min-h-[40px]">
        <div className="flex items-center gap-1 min-w-[40px]">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {topLeft}
        </div>

        <h1 className="font-display text-base sm:text-lg font-bold text-slate-100 tracking-tight truncate text-center flex-1">
          {title}
        </h1>

        <div className="flex items-center justify-end gap-1 min-w-[40px]">
          {topRight}
        </div>
      </header>

      {/* Optional compact mode switcher / context strip */}
      {subHeader}

      {/* 2. Horizontal Evaluation or Progress Bar */}
      {barMode === 'eval' ? (
        <div
          className="relative w-full h-5 rounded-md overflow-hidden bg-[#262D38] border border-slate-400/12 flex items-center select-none"
          aria-label={`Position evaluation ${barLeftLabel ?? ''}`}
        >
          <div
            className="h-full bg-[#F1F5F9] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${clampedPct}%` }}
          />
          {barLeftLabel && (
            <span
              className={`absolute font-mono text-[11px] font-bold tabular-nums leading-none pointer-events-none ${
                whiteLeading ? 'left-2 text-[#11161E]' : 'right-2 text-[#F1F5F9]'
              }`}
            >
              {barLeftLabel}
            </span>
          )}
        </div>
      ) : (
        <div className="relative w-full h-5 rounded-md overflow-hidden bg-[#262D38] border border-slate-400/12 flex items-center justify-between px-2.5 select-none">
          <div
            className="absolute inset-y-0 left-0 opacity-85 transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${clampedPct}%`, backgroundColor: barFillColor }}
          />
          <span className="relative z-10 font-mono text-[11px] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {barLeftLabel}
          </span>
          {barRightLabel && (
            <span className="relative z-10 font-mono text-[11px] font-bold tabular-nums text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              {barRightLabel}
            </span>
          )}
        </div>
      )}

      {/* 3. Coach Avatar + White Speech Bubble */}
      <div className="flex items-end gap-3">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-[#161E29] border border-slate-400/20 shrink-0 shadow-md">
          {!avatarFailed ? (
            <img
              src="/src/assets/images/bot_avatar_viktor_1794860679687.jpg"
              alt="Chess coach"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-display font-bold text-slate-200 text-base">
              CM
            </div>
          )}
        </div>

        <div className="relative flex-1 min-w-0 bg-white text-[#141B24] rounded-2xl px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
          <div
            className="absolute -left-1.5 bottom-4 w-3 h-3 rotate-45 bg-white rounded-[2px]"
            aria-hidden="true"
          />

          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white font-display font-extrabold text-[10px]"
                style={{ backgroundColor: badgeColor }}
              >
                {badgeContent}
              </span>
              <span className="font-display font-bold text-sm text-[#141B24] truncate">
                {headline}
              </span>
            </div>

            {chipText && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold tabular-nums shrink-0">
                {chipText}
              </span>
            )}
          </div>

          <p className="relative text-xs sm:text-[13px] text-slate-600 leading-snug mt-1">
            {comment}
          </p>

          {bubbleActions && (
            <div className="relative flex flex-wrap items-center gap-3 mt-1.5 pt-1.5 border-t border-slate-200/80 text-[11px] font-semibold">
              {bubbleActions}
            </div>
          )}
        </div>
      </div>

      {/* 4. Clean Chessboard */}
      <div className="w-full">{board}</div>

      {/* 5. Minimal Horizontal Ribbon */}
      {ribbon}

      {/* 6. Minimal Bottom Action Dock */}
      <div
        className="grid items-center gap-2 pt-0.5"
        style={{
          gridTemplateColumns: bottomActions
            .map((a) => (a.primary ? '1.45fr' : '1fr'))
            .join(' '),
        }}
      >
        {bottomActions.map((act) =>
          act.primary ? (
            <button
              key={act.id}
              type="button"
              onClick={act.onClick}
              disabled={act.disabled}
              className="min-h-[48px] px-4 rounded-xl bg-[#81B64C] hover:bg-[#91C65C] disabled:opacity-45 disabled:pointer-events-none text-white font-display font-bold text-sm flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(129,182,76,0.28)] transition-colors cursor-pointer whitespace-nowrap"
            >
              {act.icon}
              <span>{act.label}</span>
            </button>
          ) : (
            <button
              key={act.id}
              type="button"
              onClick={act.onClick}
              disabled={act.disabled}
              className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer ${
                act.active
                  ? 'bg-[#222C3A] text-[#81B64C]'
                  : 'text-slate-300 hover:text-white hover:bg-[#161E29]'
              }`}
            >
              {act.icon}
              <span className="text-[11px] font-medium whitespace-nowrap">{act.label}</span>
            </button>
          )
        )}
      </div>

      {footerHint && (
        <p className="text-[11px] text-center text-slate-500">{footerHint}</p>
      )}
    </div>
  );
};
