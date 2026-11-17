import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { CoachFeedback } from './CoachFeedback';

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
  const clampedPct = Math.max(barMode === 'eval' ? 4 : 0, Math.min(barMode === 'eval' ? 96 : 100, barPct));
  const whiteLeading = clampedPct >= 50;

  return (
    <div className="coach-stage max-w-[580px] mx-auto px-3 sm:px-4 py-3 sm:py-5 flex flex-col gap-3">
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
      <div className="coach-stage-sub min-w-0">{subHeader}</div>

      {/* 2. Horizontal Evaluation or Progress Bar */}
      {barMode === 'eval' ? (
        <div
          className="coach-stage-bar relative w-full h-5 rounded-md overflow-hidden bg-[#262D38] border border-slate-400/12 flex items-center select-none"
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
        <div className="coach-stage-bar relative w-full h-5 rounded-md overflow-hidden bg-[#262D38] border border-slate-400/12 flex items-center justify-between px-2.5 select-none">
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

      <CoachFeedback
        badgeColor={badgeColor}
        badgeContent={badgeContent}
        headline={headline}
        chipText={chipText}
        comment={comment}
        bubbleActions={bubbleActions}
      />

      {/* 4. Clean Chessboard */}
      <div className="coach-stage-board w-full min-w-0">{board}</div>

      {/* 5. Minimal Horizontal Ribbon */}
      <div className="coach-stage-ribbon min-w-0">{ribbon}</div>

      {/* 6. Minimal Bottom Action Dock */}
      <div
        className="coach-stage-actions grid items-center gap-2 pt-0.5"
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
              className="min-h-[48px] px-2 sm:px-4 rounded-xl bg-[#E5A93C] hover:bg-[#F0B952] disabled:opacity-45 disabled:pointer-events-none text-[#0E131B] font-display font-bold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
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
                  ? 'bg-[#222C3A] text-[#E5A93C]'
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
        <p className="coach-stage-footer text-[11px] text-center text-slate-500">{footerHint}</p>
      )}
    </div>
  );
};
