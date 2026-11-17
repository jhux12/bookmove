import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Plus,
  RotateCcw,
  Star,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isVariationUnlocked } from '../data/openingCourses';
import { BOARD_THEMES } from '../data/themes';
import { ArchivedGame, BoardArrow, CustomLineSeed, PieceColor, UserPreferences } from '../types/chess';
import {
  MoveClassification,
  analyzeMatchMoves,
  computeBestContinuationPreview,
} from '../utils/gameReview';
import { analyzeGameAgainstRepertoire } from '../utils/repertoire';
import { ChessBoard } from './ChessBoard';

interface ArchiveViewProps {
  preferences: UserPreferences;
  games: ArchivedGame[];
  initialReviewGame: ArchivedGame | null;
  onClearInitialReview: () => void;
  onDeleteGame: (id: string) => void;
  onClearAll: () => void;
  onPlayBots: () => void;
  onDrillRepertoireLine?: (courseId: string, variationId: string) => void;
  onSaveCustomPrep?: (seed: CustomLineSeed) => void;
  onReviewModeChange?: (reviewing: boolean) => void;
}

const BADGE_META: Record<
  MoveClassification,
  { color: string; short: string; label: string }
> = {
  book: { color: '#A88865', short: 'Book', label: 'Book' },
  best: { color: '#81B64C', short: '★', label: 'Best' },
  excellent: { color: '#96BC4B', short: '!', label: 'Excellent' },
  good: { color: '#96BC4B', short: '✓', label: 'Good' },
  inaccuracy: { color: '#F7C631', short: '?!', label: 'Inaccuracy' },
  mistake: { color: '#E6912C', short: '?', label: 'Mistake' },
  blunder: { color: '#CA3431', short: '??', label: 'Blunder' },
};

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  preferences,
  games,
  initialReviewGame,
  onClearInitialReview,
  onDeleteGame,
  onClearAll,
  onPlayBots,
  onDrillRepertoireLine,
  onSaveCustomPrep,
  onReviewModeChange,
}) => {
  const { effectiveTier, customLines } = useAuth();
  const [reviewGame, setReviewGame] = useState<ArchivedGame | null>(initialReviewGame);
  const [viewPly, setViewPly] = useState<number>(
    initialReviewGame ? (initialReviewGame.moves.length > 0 ? 1 : 0) : 0
  );
  const [orientation, setOrientation] = useState<PieceColor>(
    initialReviewGame ? initialReviewGame.playerColor : 'w'
  );
  const [filterResult, setFilterResult] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [copiedPgn, setCopiedPgn] = useState(false);

  // Minimal Review Controls State
  const [showBestArrow, setShowBestArrow] = useState(false);
  const [showBestLinePreview, setShowBestLinePreview] = useState(false);
  const [showReportDrawer, setShowReportDrawer] = useState(false);
  const [coachAvatarFailed, setCoachAvatarFailed] = useState(false);

  const moveStripRef = useRef<HTMLDivElement>(null);
  const activeMoveBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (initialReviewGame) {
      setReviewGame(initialReviewGame);
      setViewPly(initialReviewGame.moves.length > 0 ? 1 : 0);
      setOrientation(initialReviewGame.playerColor);
      setShowBestArrow(false);
      setShowBestLinePreview(false);
      setShowReportDrawer(false);
    }
  }, [initialReviewGame]);

  useEffect(() => {
    onReviewModeChange?.(Boolean(reviewGame));
  }, [reviewGame, onReviewModeChange]);

  const boardTheme = BOARD_THEMES[preferences.boardTheme];

  const stats = useMemo(() => {
    let w = 0;
    let l = 0;
    let d = 0;
    for (const g of games) {
      if (g.result === 'win') w++;
      else if (g.result === 'loss') l++;
      else d++;
    }
    return { total: games.length, w, l, d };
  }, [games]);

  const filteredGames = useMemo(() => {
    if (filterResult === 'all') return games;
    return games.filter((g) => g.result === filterResult);
  }, [games, filterResult]);

  const openReview = (game: ArchivedGame) => {
    setReviewGame(game);
    setViewPly(game.moves.length > 0 ? 1 : 0);
    setOrientation(game.playerColor);
    setShowBestArrow(false);
    setShowBestLinePreview(false);
    setShowReportDrawer(false);
  };

  const closeReview = () => {
    setReviewGame(null);
    setShowReportDrawer(false);
    onClearInitialReview();
  };

  // Full fast move-by-move review analysis
  const fullReview = useMemo(() => {
    if (!reviewGame) return null;
    return analyzeMatchMoves(reviewGame, customLines);
  }, [reviewGame, customLines]);

  const bookReport = useMemo(() => {
    if (!reviewGame) return null;
    return analyzeGameAgainstRepertoire(
      reviewGame.moves.map((m) => m.san),
      reviewGame.playerColor,
      customLines
    );
  }, [reviewGame, customLines]);

  const currentItem = useMemo(() => {
    if (!fullReview || viewPly <= 0) return null;
    return fullReview.items[Math.min(viewPly - 1, fullReview.items.length - 1)] ?? null;
  }, [fullReview, viewPly]);

  // Compute on-demand best-move preview when user clicks "Show"
  const bestContinuation = useMemo(() => {
    if (!showBestLinePreview || !reviewGame) return null;
    const fenToAnalyze = currentItem ? currentItem.fenBefore : new Chess().fen();
    return computeBestContinuationPreview(fenToAnalyze);
  }, [showBestLinePreview, reviewGame, currentItem]);

  // Auto-scroll active move button cleanly into view inside the inline move ribbon
  useEffect(() => {
    if (activeMoveBtnRef.current && moveStripRef.current) {
      activeMoveBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [viewPly]);

  // Keyboard navigation in Review mode
  useEffect(() => {
    if (!reviewGame) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setShowBestLinePreview(false);
        setViewPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setShowBestLinePreview(false);
        setViewPly((p) => Math.min(reviewGame.moves.length, p + 1));
      } else if (e.key === 'Home') {
        setShowBestLinePreview(false);
        setViewPly(0);
      } else if (e.key === 'End') {
        setShowBestLinePreview(false);
        setViewPly(reviewGame.moves.length);
      } else if (e.key === 'f' || e.key === 'F') {
        setOrientation((o) => (o === 'w' ? 'b' : 'w'));
      } else if (e.key === 'b' || e.key === 'B') {
        setShowBestArrow((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reviewGame]);

  if (reviewGame && fullReview) {
    const displayedFen =
      showBestLinePreview && bestContinuation
        ? bestContinuation.fenAfterBest
        : currentItem
        ? currentItem.fenAfter
        : new Chess().fen();

    const displayedLastMove =
      showBestLinePreview && bestContinuation
        ? {
            from: bestContinuation.bestMove.from,
            to: bestContinuation.bestMove.to,
          }
        : currentItem
        ? { from: currentItem.from, to: currentItem.to }
        : null;

    const evalDisplay = currentItem ? currentItem.evalDisplay : '+0.20';
    const whiteAdvPct = currentItem ? currentItem.whiteAdvantagePct : 52;
    const whiteLeading = whiteAdvPct >= 50;

    // Determine arrows for Best / Show controls
    const reviewArrows: BoardArrow[] = [];
    if (showBestLinePreview && bestContinuation) {
      reviewArrows.push({
        from: bestContinuation.bestMove.from,
        to: bestContinuation.bestMove.to,
        color: '#81B64C',
      });
    } else if (showBestArrow) {
      if (currentItem) {
        reviewArrows.push({
          from: currentItem.bestFrom,
          to: currentItem.bestTo,
          color: '#81B64C',
        });
      } else if (fullReview.items[0]) {
        reviewArrows.push({
          from: fullReview.items[0].bestFrom,
          to: fullReview.items[0].bestTo,
          color: '#81B64C',
        });
      }
    }

    const moveBadge =
      !showBestLinePreview && currentItem
        ? { square: currentItem.to, type: currentItem.classification }
        : null;

    const badgeMeta = currentItem ? BADGE_META[currentItem.classification] : BADGE_META.book;

    const canDrillMatched =
      bookReport &&
      bookReport.matchedCourseId &&
      bookReport.matchedVariationId &&
      !bookReport.isCustomLine &&
      isVariationUnlocked(bookReport.matchedCourseId, bookReport.matchedVariationId, effectiveTier);

    const isAtDeviation = Boolean(
      bookReport &&
        bookReport.deviatedBy !== 'none' &&
        viewPly === bookReport.matchedPlies + 1
    );

    const atEnd = viewPly >= reviewGame.moves.length;

    const handleStepNext = () => {
      setShowBestLinePreview(false);
      if (atEnd) {
        setViewPly(reviewGame.moves.length > 0 ? 1 : 0);
      } else {
        setViewPly((p) => Math.min(reviewGame.moves.length, p + 1));
      }
    };

    const handleStepPrev = () => {
      setShowBestLinePreview(false);
      setViewPly((p) => Math.max(0, p - 1));
    };

    return (
      <div className="max-w-[580px] mx-auto px-3 sm:px-4 py-3 sm:py-5 flex flex-col gap-3">
        {/* 1. Minimal Top Bar */}
        <header className="flex items-center justify-between gap-3 h-10">
          <button
            type="button"
            onClick={closeReview}
            aria-label="Back to match archive"
            className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="font-display text-lg font-bold text-slate-100 tracking-tight truncate">
            Game Review
          </h1>

          <div className="flex items-center gap-1 -mr-1">
            <button
              type="button"
              onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
              title="Flip board (F)"
              aria-label="Flip board"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowReportDrawer(true)}
              title="Match summary & opening report"
              aria-label="Match summary and opening report"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 2. Horizontal Evaluation Bar */}
        <div
          className="relative w-full h-5 rounded-md overflow-hidden bg-[#262D38] border border-slate-400/12 flex items-center select-none"
          aria-label={`Position evaluation ${evalDisplay}`}
        >
          <div
            className="h-full bg-[#F1F5F9] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${Math.max(4, Math.min(96, whiteAdvPct))}%` }}
          />
          <span
            className={`absolute font-mono text-[11px] font-bold tabular-nums leading-none pointer-events-none ${
              whiteLeading ? 'left-2 text-[#11161E]' : 'right-2 text-[#F1F5F9]'
            }`}
          >
            {evalDisplay}
          </span>
        </div>

        {/* 3. Coach Avatar + Speech Bubble */}
        <div className="flex items-end gap-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-[#161E29] border border-slate-400/20 shrink-0 shadow-md">
            {!coachAvatarFailed ? (
              <img
                src="/src/assets/images/bot_avatar_viktor_1794860679687.jpg"
                alt="Chess coach"
                referrerPolicy="no-referrer"
                onError={() => setCoachAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display font-bold text-slate-200 text-base">
                CM
              </div>
            )}
          </div>

          <div className="relative flex-1 min-w-0 bg-white text-[#141B24] rounded-2xl px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
            {/* Speech pointer tail */}
            <div
              className="absolute -left-1.5 bottom-4 w-3 h-3 rotate-45 bg-white rounded-[2px]"
              aria-hidden="true"
            />

            <div className="relative flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white font-display font-extrabold text-[10px]"
                  style={{ backgroundColor: showBestLinePreview ? '#81B64C' : badgeMeta.color }}
                >
                  {!showBestLinePreview && currentItem?.classification === 'book' ? (
                    <BookOpen className="w-3 h-3" />
                  ) : showBestLinePreview ? (
                    '★'
                  ) : (
                    badgeMeta.short
                  )}
                </span>
                <span className="font-display font-bold text-sm text-[#141B24] truncate">
                  {showBestLinePreview && bestContinuation
                    ? `Best line: ${bestContinuation.bestMove.san}${
                        bestContinuation.replyMove ? ` → ${bestContinuation.replyMove.san}` : ''
                      }`
                    : currentItem
                    ? currentItem.headline
                    : `${reviewGame.openingName}`}
                </span>
              </div>

              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold tabular-nums shrink-0">
                {evalDisplay}
              </span>
            </div>

            <p className="relative text-xs sm:text-[13px] text-slate-600 leading-snug mt-1">
              {showBestLinePreview && bestContinuation
                ? `Playing ${bestContinuation.bestMove.san} improves piece activity and keeps the cleanest evaluation${
                    bestContinuation.replyMove
                      ? `, meeting ${bestContinuation.replyMove.san} comfortably.`
                      : '.'
                  }`
                : currentItem
                ? currentItem.comment
                : `vs ${reviewGame.botName} (${reviewGame.botElo}) · Tap Next to step through the game move by move.`}
            </p>

            {/* Contextual inline action inside coach bubble (only on deviation or preview) */}
            {(isAtDeviation || showBestLinePreview) && (
              <div className="relative flex flex-wrap items-center gap-3 mt-1.5 pt-1.5 border-t border-slate-200/80 text-[11px] font-semibold">
                {showBestLinePreview && (
                  <button
                    type="button"
                    onClick={() => setShowBestLinePreview(false)}
                    className="text-[#4F7D24] hover:underline cursor-pointer"
                  >
                    Return to game move
                  </button>
                )}
                {!showBestLinePreview && isAtDeviation && bookReport && canDrillMatched && onDrillRepertoireLine && (
                  <button
                    type="button"
                    onClick={() =>
                      onDrillRepertoireLine(
                        bookReport.matchedCourseId!,
                        bookReport.matchedVariationId!
                      )
                    }
                    className="text-[#4F7D24] hover:underline cursor-pointer"
                  >
                    Drill {bookReport.matchedLineName.split('—')[1]?.trim() || 'this line'} →
                  </button>
                )}
                {!showBestLinePreview && isAtDeviation && bookReport?.deviatedBy === 'opponent' && onSaveCustomPrep && (
                  <button
                    type="button"
                    onClick={() =>
                      onSaveCustomPrep({
                        name: `${reviewGame.openingName} vs ${bookReport.playedSan}`,
                        moves: bookReport.seedMoves,
                        playerColor: reviewGame.playerColor,
                        notes: `Sideline played by ${reviewGame.botName} on move ${bookReport.deviationMoveNumber}.`,
                      })
                    }
                    className="text-amber-700 hover:underline cursor-pointer"
                  >
                    Save sideline →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Clean Chessboard */}
        <div className="w-full">
          <ChessBoard
            fen={displayedFen}
            orientation={orientation}
            boardTheme={boardTheme}
            pieceSet={preferences.pieceSet}
            coordinates={preferences.coordinates}
            showLegalMoves={false}
            animationSpeed={preferences.animationSpeed}
            interactive={false}
            lastMove={displayedLastMove}
            extraArrows={reviewArrows}
            moveBadge={moveBadge}
            showEvalBar={false}
            onMove={() => false}
          />
        </div>

        {/* 5. Minimal Horizontal Move Strip */}
        <div className="flex items-center gap-1 bg-[#131922] border border-slate-400/10 rounded-xl px-1.5 h-11">
          <button
            type="button"
            onClick={handleStepPrev}
            disabled={viewPly <= 0}
            aria-label="Previous move"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            ref={moveStripRef}
            className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar px-1"
          >
            {fullReview.items.map((item, idx) => {
              const isWhite = idx % 2 === 0;
              const moveNum = Math.floor(idx / 2) + 1;
              const isActive = viewPly === item.ply;
              const showTinyIcon =
                item.classification === 'best' ||
                item.classification === 'blunder' ||
                item.classification === 'mistake' ||
                item.classification === 'inaccuracy';
              const meta = BADGE_META[item.classification];

              return (
                <React.Fragment key={item.ply}>
                  {isWhite && (
                    <span className="font-mono text-xs text-slate-500 pl-1 select-none shrink-0">
                      {moveNum}.
                    </span>
                  )}
                  <button
                    ref={isActive ? activeMoveBtnRef : undefined}
                    type="button"
                    onClick={() => {
                      setShowBestLinePreview(false);
                      setViewPly(item.ply);
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-mono text-xs transition-colors cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-[#263140] text-white font-bold ring-1 ring-slate-400/35'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <span>{item.san}</span>
                    {showTinyIcon && (
                      <span
                        className="w-3.5 h-3.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none"
                        style={{ backgroundColor: meta.color }}
                      >
                        {meta.short}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowBestLinePreview(false);
              setViewPly((p) => Math.min(reviewGame.moves.length, p + 1));
            }}
            disabled={atEnd}
            aria-label="Next move"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 transition-colors cursor-pointer shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 6. Minimal 4-Button Bottom Control Bar */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1.45fr] items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setShowReportDrawer(true)}
            className="min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-slate-300 hover:text-white hover:bg-[#161E29] transition-colors cursor-pointer"
          >
            <Star className="w-4 h-4" />
            <span className="text-[11px] font-medium">Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBestLinePreview((v) => !v)}
            className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              showBestLinePreview
                ? 'bg-[#222C3A] text-[#81B64C]'
                : 'text-slate-300 hover:text-white hover:bg-[#161E29]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span className="text-[11px] font-medium">Show</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBestArrow((v) => !v)}
            className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              showBestArrow
                ? 'bg-[#222C3A] text-[#81B64C]'
                : 'text-slate-300 hover:text-white hover:bg-[#161E29]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span className="text-[11px] font-medium">Best</span>
          </button>

          <button
            type="button"
            onClick={handleStepNext}
            className="min-h-[48px] px-4 rounded-xl bg-[#81B64C] hover:bg-[#91C65C] text-white font-display font-bold text-sm flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(129,182,76,0.28)] transition-colors cursor-pointer whitespace-nowrap"
          >
            {atEnd ? (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Restart</span>
              </>
            ) : (
              <span>Next</span>
            )}
          </button>
        </div>

        {/* Summary & Opening Book Report Modal Drawer */}
        <AnimatePresence>
          {showReportDrawer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0E131B]/75 backdrop-blur-xs"
              onClick={() => setShowReportDrawer(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-[460px] bg-[#161E29] border border-slate-400/18 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-400/12">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span
                        className={
                          reviewGame.result === 'win'
                            ? 'text-[#2EB88A] font-semibold'
                            : reviewGame.result === 'loss'
                            ? 'text-[#EB6150] font-semibold'
                            : 'text-[#E5A93C] font-semibold'
                        }
                      >
                        {reviewGame.result === 'win'
                          ? 'Victory'
                          : reviewGame.result === 'loss'
                          ? 'Defeat'
                          : 'Draw'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{reviewGame.termination}</span>
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-100 mt-0.5">
                      {reviewGame.openingName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReportDrawer(false)}
                    aria-label="Close summary"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Accuracy Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#0F151E] border border-slate-400/10">
                    <div className="text-[11px] text-slate-400">
                      {reviewGame.playerColor === 'w' ? 'You (White)' : `${reviewGame.botName} (White)`}
                    </div>
                    <div className="font-mono text-xl font-bold text-slate-100 tabular-nums mt-0.5">
                      {fullReview.white.accuracy}%
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      {fullReview.white.counts.best} best · {fullReview.white.counts.mistake} mist ·{' '}
                      {fullReview.white.counts.blunder} blun
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0F151E] border border-slate-400/10">
                    <div className="text-[11px] text-slate-400">
                      {reviewGame.playerColor === 'b' ? 'You (Black)' : `${reviewGame.botName} (Black)`}
                    </div>
                    <div className="font-mono text-xl font-bold text-slate-100 tabular-nums mt-0.5">
                      {fullReview.black.accuracy}%
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      {fullReview.black.counts.best} best · {fullReview.black.counts.mistake} mist ·{' '}
                      {fullReview.black.counts.blunder} blun
                    </div>
                  </div>
                </div>

                {/* Opening Book Deviation Report */}
                {bookReport && (
                  <div className="p-3.5 rounded-xl bg-[#0F151E] border border-slate-400/10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#E5A93C]" />
                        <span>Opening Book Report</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {bookReport.matchedPlies}/{bookReport.totalLinePlies} plies
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {bookReport.deviatedBy === 'none' ? (
                        <>
                          Followed full repertoire line{' '}
                          <span className="text-[#2EB88A] font-semibold">
                            {bookReport.matchedLineName}
                          </span>
                          .
                        </>
                      ) : bookReport.deviatedBy === 'player' ? (
                        <>
                          You left{' '}
                          <span className="text-slate-100 font-semibold">
                            {bookReport.matchedLineName}
                          </span>{' '}
                          on move{' '}
                          <span className="font-mono text-[#E5A93C]">
                            {bookReport.deviationMoveNumber}
                          </span>{' '}
                          (played{' '}
                          <span className="font-mono text-[#EB6150]">{bookReport.playedSan}</span>{' '}
                          instead of{' '}
                          <span className="font-mono text-[#2EB88A]">
                            {bookReport.expectedSan}
                          </span>
                          ).
                        </>
                      ) : (
                        <>
                          {reviewGame.botName} left{' '}
                          <span className="text-slate-100 font-semibold">
                            {bookReport.matchedLineName}
                          </span>{' '}
                          on move{' '}
                          <span className="font-mono text-[#E5A93C]">
                            {bookReport.deviationMoveNumber}
                          </span>{' '}
                          with{' '}
                          <span className="font-mono text-[#E5A93C]">{bookReport.playedSan}</span>.
                        </>
                      )}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {bookReport.matchedPlies > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowBestLinePreview(false);
                            setViewPly(
                              Math.min(reviewGame.moves.length, bookReport.matchedPlies + 1)
                            );
                            setShowReportDrawer(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#161E29] hover:bg-[#222C3A] text-xs font-medium text-slate-200 cursor-pointer"
                        >
                          Jump to Deviation
                        </button>
                      )}
                      {onDrillRepertoireLine &&
                        canDrillMatched &&
                        bookReport.matchedCourseId &&
                        bookReport.matchedVariationId && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowReportDrawer(false);
                              onDrillRepertoireLine(
                                bookReport.matchedCourseId!,
                                bookReport.matchedVariationId!
                              );
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#2EB88A]/18 hover:bg-[#2EB88A]/28 text-xs font-semibold text-[#2EB88A] flex items-center gap-1 cursor-pointer"
                          >
                            <Target className="w-3.5 h-3.5" />
                            <span>Drill This Line</span>
                          </button>
                        )}
                      {onSaveCustomPrep && bookReport.deviatedBy === 'opponent' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowReportDrawer(false);
                            onSaveCustomPrep({
                              name: `${reviewGame.openingName} vs ${bookReport.playedSan}`,
                              moves: bookReport.seedMoves,
                              playerColor: reviewGame.playerColor,
                              notes: `Sideline played by ${reviewGame.botName} on move ${bookReport.deviationMoveNumber}.`,
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#E5A93C]/18 hover:bg-[#E5A93C]/28 text-xs font-semibold text-[#F7D08A] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save Sideline</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(reviewGame.pgn).catch(() => {});
                      setCopiedPgn(true);
                      window.setTimeout(() => setCopiedPgn(false), 1600);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#0F151E] hover:bg-[#222C3A] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedPgn ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#2EB88A]" />
                        <span>Copied PGN</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy PGN</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportDrawer(false)}
                    className="py-2.5 px-3 rounded-xl bg-[#81B64C] hover:bg-[#91C65C] text-xs font-bold text-white cursor-pointer"
                  >
                    Back to Review
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ---------------- MATCH ARCHIVE LIST VIEW ----------------
  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100 tracking-tight">
            Game Archive
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono tabular-nums">
            <span>{stats.total} Games</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#2EB88A]">{stats.w} Wins</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#EB6150]">{stats.l} Losses</span>
            <span aria-hidden="true">·</span>
            <span>{stats.d} Draws</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-lg">
            {(['all', 'win', 'loss', 'draw'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterResult(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  filterResult === f ? 'bg-[#222C3A] text-[#F7D08A]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'win' ? 'Wins' : f === 'loss' ? 'Losses' : 'Draws'}
              </button>
            ))}
          </div>

          {games.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="px-3 py-2 rounded-lg bg-[#161E29] hover:bg-red-950/60 border border-slate-400/12 text-xs font-medium text-slate-300 hover:text-red-300 transition-colors cursor-pointer"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <div className="bg-[#161E29] border border-slate-400/12 rounded-2xl p-10 text-center space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-100">
            {games.length === 0 ? 'No completed bot games yet' : 'No matching games'}
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {games.length === 0
              ? 'Finish a match against any bot to save the move log here for move-by-move coach review and opening book analysis.'
              : 'Try switching the result filter above to view your other matches.'}
          </p>
          {games.length === 0 && (
            <button
              type="button"
              onClick={onPlayBots}
              className="mt-2 px-4 py-2 rounded-lg bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] font-display font-bold text-xs transition-colors cursor-pointer"
            >
              Play a Bot
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#161E29] border border-slate-400/12 rounded-2xl overflow-hidden divide-y divide-slate-400/10">
          {filteredGames.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-xs font-bold ${
                      g.result === 'win'
                        ? 'text-[#2EB88A]'
                        : g.result === 'loss'
                        ? 'text-[#EB6150]'
                        : 'text-[#E5A93C]'
                    }`}
                  >
                    {g.result === 'win' ? 'Win' : g.result === 'loss' ? 'Loss' : 'Draw'}
                  </span>
                  <span className="font-display font-semibold text-sm text-slate-100 truncate">
                    vs {g.botName} ({g.botElo})
                  </span>
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    · {g.playerColor === 'w' ? 'White' : 'Black'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                  <span className="truncate">{g.openingName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{g.termination}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{g.moveCount} moves</span>
                  <span aria-hidden="true">·</span>
                  <span>{new Date(g.playedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openReview(g)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#81B64C] hover:bg-[#91C65C] text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  Review
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteGame(g.id)}
                  className="p-1.5 rounded-lg bg-[#0F151E] hover:bg-red-950/60 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                  aria-label="Delete game"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
