import React from 'react';
import { BotProfile, PieceColor, PieceSetId, PieceType } from '../types/chess';
import { BotAvatar } from './BotAvatar';
import { ChessPieceSvg } from './ChessPieceSvg';

interface PlayerStripProps {
  name: string;
  elo?: number;
  bot?: BotProfile;
  pieceColor: PieceColor;
  capturedPieces: PieceType[];
  materialAdvantage: number;
  pieceSet: PieceSetId;
  isActiveTurn: boolean;
  clockSeconds: number | null;
  dialogue?: string | null;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const PlayerStrip: React.FC<PlayerStripProps> = ({
  name,
  elo,
  bot,
  pieceColor,
  capturedPieces,
  materialAdvantage,
  pieceSet,
  isActiveTurn,
  clockSeconds,
  dialogue,
}) => {
  const capturedColor: PieceColor = pieceColor === 'w' ? 'b' : 'w';
  const isLowTime = clockSeconds !== null && clockSeconds > 0 && clockSeconds <= 20;

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-2.5 rounded-xl bg-[#161E29]/80 border border-slate-400/10 transition-colors duration-150">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {bot ? (
          <BotAvatar bot={bot} sizeClass="w-10 h-10" />
        ) : (
          <div className="w-10 h-10 shrink-0 rounded-lg bg-[#222C3A] border border-slate-400/15 flex items-center justify-center font-display font-bold text-xs tracking-wide text-slate-100">
            YOU
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-sm text-slate-100 truncate">
              {name}
            </span>
            {elo !== undefined && (
              <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                {elo}
              </span>
            )}
            {isActiveTurn && (
              <span className="text-[11px] font-semibold text-[#E5A93C] shrink-0">
                Turn
              </span>
            )}
          </div>

          {dialogue ? (
            <p className="text-xs text-slate-300/80 truncate mt-0.5">{dialogue}</p>
          ) : (
            <div className="flex items-center gap-1 h-4 mt-0.5">
              {capturedPieces.length > 0 && (
                <div className="flex items-center -space-x-1">
                  {capturedPieces.slice(0, 12).map((p, idx) => (
                    <div key={`${p}-${idx}`} className="w-4 h-4">
                      <ChessPieceSvg type={p} color={capturedColor} pieceSet={pieceSet} />
                    </div>
                  ))}
                </div>
              )}
              {materialAdvantage > 0 && (
                <span className="font-mono text-[11px] font-semibold text-slate-300 tabular-nums ml-1">
                  +{materialAdvantage}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {clockSeconds !== null && (
        <div
          className={`shrink-0 px-3 py-1.5 rounded-lg font-mono text-base font-bold tabular-nums border transition-colors duration-150 ${
            isActiveTurn
              ? isLowTime
                ? 'bg-[#7F1D1D] text-white border-red-400/40'
                : 'bg-[#F1F5F9] text-[#0E131B] border-white'
              : 'bg-[#0F151E] text-slate-400 border-slate-400/12'
          }`}
        >
          {formatClock(clockSeconds)}
        </div>
      )}
    </div>
  );
};
