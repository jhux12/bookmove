import React, { useState } from 'react';
import { Chess, Square } from 'chess.js';
import { RotateCcw } from 'lucide-react';
import { BOARD_THEMES, DEFAULT_PREFERENCES, PIECE_SETS } from '../data/themes';
import {
  AnimationSpeed,
  BoardThemeId,
  CoordinateStyle,
  PieceSetId,
  PieceType,
  UserPreferences,
} from '../types/chess';
import { soundEngine } from '../utils/sound';
import { ChessBoard } from './ChessBoard';
import { ChessPieceSvg } from './ChessPieceSvg';

interface CustomizeViewProps {
  preferences: UserPreferences;
  onUpdatePreferences: (next: UserPreferences) => void;
}

const PREVIEW_START_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

export const CustomizeView: React.FC<CustomizeViewProps> = ({
  preferences,
  onUpdatePreferences,
}) => {
  const [previewChess, setPreviewChess] = useState(() => new Chess(PREVIEW_START_FEN));
  const [previewFen, setPreviewFen] = useState(PREVIEW_START_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>({
    from: 'f1',
    to: 'c4',
  });

  const activeTheme = BOARD_THEMES[preferences.boardTheme];

  const handlePreviewMove = (from: string, to: string, promotion?: PieceType) => {
    try {
      const m = previewChess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion || 'q',
      });
      if (!m) return false;
      setPreviewFen(previewChess.fen());
      setLastMove({ from: m.from, to: m.to });
      if (m.captured) soundEngine.playCapture();
      else soundEngine.playMove();
      return true;
    } catch {
      return false;
    }
  };

  const resetPreview = () => {
    const fresh = new Chess(PREVIEW_START_FEN);
    setPreviewChess(fresh);
    setPreviewFen(PREVIEW_START_FEN);
    setLastMove({ from: 'f1', to: 'c4' });
  };

  const update = <K extends keyof UserPreferences>(key: K, val: UserPreferences[K]) => {
    onUpdatePreferences({ ...preferences, [key]: val });
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-7 items-start">
        {/* Live Preview Board */}
        <div className="flex flex-col items-center w-full">
          <div className="w-full max-w-[600px] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-lg font-bold text-slate-100">
                  Live Board Preview
                </h1>
                <p className="text-xs text-slate-400">
                  Move pieces directly on the board to test your theme, piece silhouettes, and glide speed.
                </p>
              </div>
              <button
                type="button"
                onClick={resetPreview}
                className="px-3 py-1.5 rounded-lg bg-[#161E29] hover:bg-[#222C3A] border border-slate-400/15 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Position</span>
              </button>
            </div>

            <ChessBoard
              fen={previewFen}
              orientation="w"
              boardTheme={activeTheme}
              pieceSet={preferences.pieceSet}
              coordinates={preferences.coordinates}
              showLegalMoves={preferences.showLegalMoves}
              animationSpeed={preferences.animationSpeed}
              interactive={true}
              allowedColor="both"
              lastMove={lastMove}
              showEvalBar={preferences.showEvalBar}
              evalDisplay="+0.3"
              whiteAdvantagePct={54}
              onMove={handlePreviewMove}
            />
          </div>
        </div>

        {/* Customization Controls */}
        <aside className="w-full bg-[#161E29] border border-slate-400/12 rounded-2xl p-5 space-y-6 shadow-[0_14px_38px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-100">
              Board & Piece Studio
            </h2>
            <button
              type="button"
              onClick={() => onUpdatePreferences(DEFAULT_PREFERENCES)}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Restore Defaults
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Board Theme</span>
              <span className="text-slate-400">{activeTheme.name}</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => {
                const t = BOARD_THEMES[id];
                const selected = preferences.boardTheme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update('boardTheme', id)}
                    className={`group rounded-xl p-1.5 border transition-all duration-150 cursor-pointer text-left ${
                      selected
                        ? 'border-[#E5A93C] bg-[#202B3A]'
                        : 'border-slate-400/10 bg-[#0F151E] hover:border-slate-400/30'
                    }`}
                  >
                    <div className="grid grid-cols-2 grid-rows-2 aspect-square rounded-md overflow-hidden">
                      <div style={{ backgroundColor: t.lightSquare }} />
                      <div style={{ backgroundColor: t.darkSquare }} />
                      <div style={{ backgroundColor: t.darkSquare }} />
                      <div style={{ backgroundColor: t.lightSquare }} />
                    </div>
                    <span className="block text-[10px] font-medium text-slate-200 truncate mt-1.5 text-center">
                      {t.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-400/12">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Piece Style</span>
              <span className="text-slate-400">{PIECE_SETS[preferences.pieceSet].name}</span>
            </div>
            <div className="space-y-2">
              {(Object.keys(PIECE_SETS) as PieceSetId[]).map((id) => {
                const meta = PIECE_SETS[id];
                const selected = preferences.pieceSet === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update('pieceSet', id)}
                    className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer text-left ${
                      selected
                        ? 'border-[#E5A93C] bg-[#202B3A]'
                        : 'border-slate-400/10 bg-[#0F151E] hover:border-slate-400/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100">{meta.name}</div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {meta.description}
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-0.5 px-1.5 py-1 rounded-md shrink-0"
                      style={{ backgroundColor: activeTheme.darkSquare }}
                    >
                      <div className="w-7 h-7">
                        <ChessPieceSvg type="n" color="w" pieceSet={id} />
                      </div>
                      <div className="w-7 h-7">
                        <ChessPieceSvg type="q" color="b" pieceSet={id} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3.5 pt-3 border-t border-slate-400/12">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-300">Board Coordinates</span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#0F151E] border border-slate-400/10 rounded-lg">
                {(['inside', 'outside', 'hidden'] as CoordinateStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => update('coordinates', style)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                      preferences.coordinates === style
                        ? 'bg-[#222C3A] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-300">Piece Glide Speed</span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#0F151E] border border-slate-400/10 rounded-lg">
                {(['instant', 'snappy', 'smooth'] as AnimationSpeed[]).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => update('animationSpeed', spd)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                      preferences.animationSpeed === spd
                        ? 'bg-[#222C3A] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-xs font-medium text-slate-300">Show Legal Move Indicators</span>
              <input
                type="checkbox"
                checked={preferences.showLegalMoves}
                onChange={(e) => update('showLegalMoves', e.target.checked)}
                className="w-4 h-4 accent-[#E5A93C] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-xs font-medium text-slate-300">Sound Effects</span>
              <input
                type="checkbox"
                checked={preferences.soundEnabled}
                onChange={(e) => update('soundEnabled', e.target.checked)}
                className="w-4 h-4 accent-[#E5A93C] rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-xs font-medium text-slate-300">Show Evaluation Bar</span>
              <input
                type="checkbox"
                checked={preferences.showEvalBar}
                onChange={(e) => update('showEvalBar', e.target.checked)}
                className="w-4 h-4 accent-[#E5A93C] rounded cursor-pointer"
              />
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
};
