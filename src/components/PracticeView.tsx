import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  GitBranch,
  Lightbulb,
  List,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BOTS } from '../data/bots';
import { OPENING_COURSES, isVariationUnlocked } from '../data/openingCourses';
import { ENDGAME_DRILLS, TACTICAL_PUZZLES } from '../data/practice';
import { BOARD_THEMES } from '../data/themes';
import { chooseBotMove, getPositionEvaluation, getRankedMoves } from '../engine/chessAI';
import { BoardArrow, OpeningVariation, PieceColor, PieceType, UserPreferences } from '../types/chess';
import { detectOpening } from '../utils/openings';
import { findBranchingSiblings } from '../utils/repertoire';
import { soundEngine } from '../utils/sound';
import { ChessBoard } from './ChessBoard';
import { CoachBoardStage, CoachBottomAction } from './CoachBoardStage';
import { ResultOverlayModal } from './ResultOverlayModal';

interface PracticeViewProps {
  preferences: UserPreferences;
  onGoToCourses?: () => void;
}

type PracticeMode = 'review' | 'puzzles' | 'endgames' | 'analysis';

interface ReviewQueueItem {
  variation: OpeningVariation;
  courseTitle: string;
  playerColor: PieceColor;
  masteryPct: number;
  isDue: boolean;
  attempts: number;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  preferences,
  onGoToCourses,
}) => {
  const { effectiveTier, lineProgress, customLines, recordLinePractice } = useAuth();
  const [mode, setMode] = useState<PracticeMode>('review');
  const [showSheet, setShowSheet] = useState(false);
  const boardTheme = BOARD_THEMES[preferences.boardTheme];

  // ---------------- PUZZLES STATE ----------------
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const puzzle = TACTICAL_PUZZLES[puzzleIdx];
  const puzzleChessRef = useRef<Chess>(new Chess(puzzle.fen));
  const [puzzleFen, setPuzzleFen] = useState(puzzle.fen);
  const [puzzleStep, setPuzzleStep] = useState(0);
  const [puzzleStatus, setPuzzleStatus] = useState<'solving' | 'wrong' | 'solved'>('solving');
  const [showPuzzleHint, setShowPuzzleHint] = useState(false);
  const [puzzleStreak, setPuzzleStreak] = useState(0);
  const [puzzleLastMove, setPuzzleLastMove] = useState<{ from: string; to: string } | null>(null);
  const [puzzleArrows, setPuzzleArrows] = useState<BoardArrow[]>([]);
  const [showPuzzleModal, setShowPuzzleModal] = useState(false);
  const puzzleModalTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (puzzleModalTimerRef.current) window.clearTimeout(puzzleModalTimerRef.current);
    };
  }, []);

  const loadPuzzle = useCallback((idx: number) => {
    if (puzzleModalTimerRef.current) {
      window.clearTimeout(puzzleModalTimerRef.current);
      puzzleModalTimerRef.current = null;
    }
    const target = TACTICAL_PUZZLES[idx];
    puzzleChessRef.current = new Chess(target.fen);
    setPuzzleIdx(idx);
    setPuzzleFen(target.fen);
    setPuzzleStep(0);
    setPuzzleStatus('solving');
    setShowPuzzleHint(false);
    setPuzzleLastMove(null);
    setPuzzleArrows([]);
    setShowPuzzleModal(false);
  }, []);

  const handlePuzzleMove = (from: string, to: string, promotion?: PieceType): boolean => {
    if (puzzleStatus === 'solved') return false;
    const c = puzzleChessRef.current;
    const expectedSan = puzzle.solution[puzzleStep];
    if (!expectedSan) return false;

    try {
      const m = c.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' });
      if (!m) return false;

      if (m.san !== expectedSan) {
        c.undo();
        setPuzzleStatus('wrong');
        soundEngine.playMove();
        return false;
      }

      setPuzzleFen(c.fen());
      setPuzzleLastMove({ from: m.from, to: m.to });
      setPuzzleArrows([]);
      setPuzzleStatus('solving');

      if (m.san.includes('#') || m.san.includes('+')) soundEngine.playCheck();
      else if (m.captured) soundEngine.playCapture();
      else soundEngine.playMove();

      const nextStep = puzzleStep + 1;
      if (nextStep >= puzzle.solution.length) {
        setPuzzleStep(nextStep);
        setPuzzleStatus('solved');
        setPuzzleStreak((s) => s + 1);
        soundEngine.playGameEnd('win');
        if (puzzleModalTimerRef.current) window.clearTimeout(puzzleModalTimerRef.current);
        puzzleModalTimerRef.current = window.setTimeout(() => {
          setShowPuzzleModal(true);
        }, 280);
      } else {
        setPuzzleStep(nextStep);
        window.setTimeout(() => {
          const replySan = puzzle.solution[nextStep];
          if (!replySan) return;
          const reply = puzzleChessRef.current.move(replySan);
          if (reply) {
            setPuzzleFen(puzzleChessRef.current.fen());
            setPuzzleLastMove({ from: reply.from, to: reply.to });
            setPuzzleStep(nextStep + 1);
            soundEngine.playMove();
          }
        }, 380);
      }
      return true;
    } catch {
      return false;
    }
  };

  const revealPuzzleHint = () => {
    setShowPuzzleHint(true);
    const c = new Chess(puzzleFen);
    const targetSan = puzzle.solution[puzzleStep];
    if (!targetSan) return;
    const m = c.move(targetSan);
    if (m) {
      setPuzzleArrows([{ from: m.from, to: m.to, color: '#81B64C' }]);
    }
  };

  // ---------------- ENDGAMES STATE ----------------
  const [endgameIdx, setEndgameIdx] = useState(0);
  const endgame = ENDGAME_DRILLS[endgameIdx];
  const endgameChessRef = useRef<Chess>(new Chess(endgame.fen));
  const [endgameFen, setEndgameFen] = useState(endgame.fen);
  const [endgameOrientation, setEndgameOrientation] = useState<PieceColor>(endgame.playerColor);
  const [endgameLastMove, setEndgameLastMove] = useState<{ from: string; to: string } | null>(null);
  const [endgameResult, setEndgameResult] = useState<string | null>(null);
  const [endgameThinking, setEndgameThinking] = useState(false);

  const loadEndgame = useCallback((idx: number) => {
    const drill = ENDGAME_DRILLS[idx];
    endgameChessRef.current = new Chess(drill.fen);
    setEndgameIdx(idx);
    setEndgameFen(drill.fen);
    setEndgameOrientation(drill.playerColor);
    setEndgameLastMove(null);
    setEndgameResult(null);
    setEndgameThinking(false);
  }, []);

  const handleEndgameMove = (from: string, to: string, promotion?: PieceType): boolean => {
    if (endgameThinking || endgameResult) return false;
    const c = endgameChessRef.current;
    try {
      const m = c.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' });
      if (!m) return false;
      setEndgameFen(c.fen());
      setEndgameLastMove({ from: m.from, to: m.to });
      if (m.captured) soundEngine.playCapture();
      else soundEngine.playMove();

      if (c.isCheckmate()) {
        setEndgameResult('Checkmate! Endgame mastered.');
        soundEngine.playGameEnd('win');
        return true;
      }
      if (c.isDraw() || c.isStalemate()) {
        setEndgameResult('Draw — watch out for stalemate!');
        soundEngine.playGameEnd('draw');
        return true;
      }

      setEndgameThinking(true);
      window.setTimeout(() => {
        const masterBot = BOTS[4];
        const replyMove = chooseBotMove(c.fen(), masterBot);
        if (replyMove) {
          const exec = c.move(replyMove);
          if (exec) {
            setEndgameFen(c.fen());
            setEndgameLastMove({ from: exec.from, to: exec.to });
            soundEngine.playMove();
            if (c.isCheckmate()) {
              setEndgameResult('Checkmate against you. Try again!');
              soundEngine.playGameEnd('loss');
            } else if (c.isDraw() || c.isStalemate()) {
              setEndgameResult('Draw — stalemate or insufficient material.');
              soundEngine.playGameEnd('draw');
            }
          }
        }
        setEndgameThinking(false);
      }, 420);

      return true;
    } catch {
      return false;
    }
  };

  // ---------------- PERFECTED LINES RANDOM PRACTICE POOL ----------------
  const [mixColorFilter, setMixColorFilter] = useState<'all' | 'w' | 'b'>('all');
  const [mixDueOnly, setMixDueOnly] = useState(false);
  const [mixCourseFilter, setMixCourseFilter] = useState<string>('all');
  const [blitzMode, setBlitzMode] = useState(false);
  const [blitzRemainingMs, setBlitzRemainingMs] = useState(5000);
  const [branchMode, setBranchMode] = useState(false);

  const allLearnedQueue = useMemo<ReviewQueueItem[]>(() => {
    const now = Date.now();
    const items: ReviewQueueItem[] = [];

    for (const c of OPENING_COURSES) {
      for (const v of c.variations) {
        if (!isVariationUnlocked(c.id, v.id, effectiveTier)) continue;
        const lp = lineProgress[v.id];
        if (!lp || lp.masteryPct < 80) continue;
        const attempts = lp.attempts ?? 0;
        const masteryPct = lp.masteryPct;
        const isDue = attempts > 0 && lp.nextReviewMs <= now;
        items.push({
          variation: v,
          courseTitle: c.title.split(':')[0],
          playerColor: c.playerColor,
          masteryPct,
          isDue,
          attempts,
        });
      }
    }

    if (effectiveTier === 'pro') {
      for (const cl of customLines) {
        const lp = lineProgress[cl.id];
        if (!lp || lp.masteryPct < 80) continue;
        const attempts = lp.attempts ?? 0;
        const masteryPct = lp.masteryPct;
        const isDue = attempts > 0 && lp.nextReviewMs <= now;
        items.push({
          variation: {
            id: cl.id,
            courseId: 'custom-repertoire',
            name: cl.name,
            eco: 'Custom',
            difficulty: 'Club',
            summary: cl.notes || 'Personal custom line.',
            steps: cl.moves.map((san) => ({ san, note: '' })),
          },
          courseTitle: 'Custom Repertoire',
          playerColor: cl.playerColor,
          masteryPct,
          isDue,
          attempts,
        });
      }
    }

    return items.sort((a, b) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
      return a.attempts - b.attempts;
    });
  }, [effectiveTier, lineProgress, customLines]);

  const reviewQueue = useMemo<ReviewQueueItem[]>(() => {
    return allLearnedQueue.filter((item) => {
      if (mixColorFilter !== 'all' && item.playerColor !== mixColorFilter) return false;
      if (mixDueOnly && !item.isDue) return false;
      if (mixCourseFilter !== 'all' && item.variation.courseId !== mixCourseFilter) return false;
      return true;
    });
  }, [allLearnedQueue, mixColorFilter, mixDueOnly, mixCourseFilter]);

  const [reviewLineId, setReviewLineId] = useState<string>(() => {
    if (reviewQueue.length === 0) return '';
    return reviewQueue[Math.floor(Math.random() * reviewQueue.length)].variation.id;
  });
  const activeReviewItem = useMemo(
    () => reviewQueue.find((i) => i.variation.id === reviewLineId) ?? reviewQueue[0],
    [reviewQueue, reviewLineId]
  );

  const openingChessRef = useRef<Chess>(new Chess());
  const [openingFen, setOpeningFen] = useState(new Chess().fen());
  const [openingStep, setOpeningStep] = useState(0);
  const [openingMistakes, setOpeningMistakes] = useState(0);
  const openingMistakesRef = useRef(0);
  const missedPliesRef = useRef<number[]>([]);
  const [openingNote, setOpeningNote] = useState('');
  const [openingLastMove, setOpeningLastMove] = useState<{ from: string; to: string } | null>(null);
  const [openingFeedback, setOpeningFeedback] = useState<string | null>(null);
  const [openingArrow, setOpeningArrow] = useState<BoardArrow[]>([]);
  const [branchHintText, setBranchHintText] = useState<string | null>(null);
  const [reviewDoneModal, setReviewDoneModal] = useState<{ open: boolean; masteryPct: number }>({
    open: false,
    masteryPct: 0,
  });

  const loadReviewItem = useCallback((item: ReviewQueueItem | undefined, branchNotice?: string | null) => {
    if (!item) return;
    const fresh = new Chess();
    openingChessRef.current = fresh;
    setReviewLineId(item.variation.id);
    setOpeningMistakes(0);
    openingMistakesRef.current = 0;
    missedPliesRef.current = [];
    setOpeningFeedback(null);
    setOpeningArrow([]);
    setOpeningLastMove(null);
    setBlitzRemainingMs(5000);
    setBranchHintText(branchNotice ?? null);
    setReviewDoneModal({ open: false, masteryPct: 0 });

    if (item.playerColor === 'b' && item.variation.steps.length > 0) {
      const first = item.variation.steps[0];
      const exec = fresh.move(first.san);
      setOpeningFen(fresh.fen());
      if (exec) setOpeningLastMove({ from: exec.from, to: exec.to });
      setOpeningStep(1);
      setOpeningNote(
        first.note ? `${first.san}: ${first.note}` : `Opponent played ${first.san}. Your reply?`
      );
    } else {
      setOpeningFen(fresh.fen());
      setOpeningStep(0);
      const first = item.variation.steps[0];
      setOpeningNote(
        first ? `Play your opening move from memory (${item.variation.name}).` : 'Ready to drill.'
      );
    }
  }, []);

  const pickRandomLearnedLine = useCallback(
    (avoidId?: string) => {
      if (reviewQueue.length === 0) return;
      if (branchMode && activeReviewItem) {
        const group = findBranchingSiblings(activeReviewItem, reviewQueue);
        if (group && group.siblings.length > 1) {
          const alt = group.siblings.filter((s) => s.variation.id !== activeReviewItem.variation.id);
          const chosen = alt[Math.floor(Math.random() * alt.length)] ?? group.siblings[0];
          const divStep = chosen.variation.steps[group.branchPly];
          loadReviewItem(
            chosen,
            `Branch Challenge: watch for opponent's move ${Math.floor(group.branchPly / 2) + 1}...${
              divStep?.san ?? ''
            }`
          );
          return;
        }
      }
      const candidates =
        reviewQueue.length > 1 && avoidId
          ? reviewQueue.filter((i) => i.variation.id !== avoidId)
          : reviewQueue;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      loadReviewItem(chosen, null);
    },
    [reviewQueue, loadReviewItem, branchMode, activeReviewItem]
  );

  useEffect(() => {
    if (activeReviewItem) {
      loadReviewItem(activeReviewItem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReviewItem?.variation.id]);

  const finishReviewItem = useCallback(
    async (item: ReviewQueueItem, mistakes: number, missedPlies: number[]) => {
      soundEngine.playGameEnd('win');
      setOpeningFeedback(
        mistakes === 0 ? 'Clean review! Mastery & review interval extended.' : 'Review complete!'
      );
      const res = await recordLinePractice(
        item.variation.courseId,
        item.variation.id,
        mistakes,
        missedPlies
      );
      window.setTimeout(() => {
        setReviewDoneModal({ open: true, masteryPct: res.masteryPct });
      }, 280);
    },
    [recordLinePractice]
  );

  const isPlayerTurnInReview = Boolean(
    mode === 'review' &&
      activeReviewItem &&
      openingStep < activeReviewItem.variation.steps.length &&
      (openingStep % 2 === 0 ? 'w' : 'b') === activeReviewItem.playerColor
  );

  useEffect(() => {
    if (!blitzMode || !isPlayerTurnInReview || reviewDoneModal.open) return;
    setBlitzRemainingMs(5000);
    const interval = window.setInterval(() => {
      setBlitzRemainingMs((prev) => {
        if (prev <= 100) {
          window.clearInterval(interval);
          if (activeReviewItem) {
            const expected = activeReviewItem.variation.steps[openingStep];
            if (expected) {
              openingMistakesRef.current += 1;
              setOpeningMistakes(openingMistakesRef.current);
              missedPliesRef.current = [...missedPliesRef.current, openingStep];
              setOpeningFeedback(`Time up! Play ${expected.san} to continue.`);
              try {
                const temp = new Chess(openingChessRef.current.fen());
                const hint = temp.move(expected.san);
                if (hint) {
                  setOpeningArrow([{ from: hint.from, to: hint.to, color: '#81B64C' }]);
                }
              } catch {
                // Ignore
              }
            }
          }
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [blitzMode, isPlayerTurnInReview, openingStep, reviewDoneModal.open, activeReviewItem]);

  const handleOpeningMove = (from: string, to: string, promotion?: PieceType): boolean => {
    if (!activeReviewItem) return false;
    const c = openingChessRef.current;
    const expected = activeReviewItem.variation.steps[openingStep];
    if (!expected) return false;

    try {
      const m = c.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' });
      if (!m) return false;

      if (m.san !== expected.san) {
        c.undo();
        openingMistakesRef.current += 1;
        setOpeningMistakes(openingMistakesRef.current);
        missedPliesRef.current = [...missedPliesRef.current, openingStep];
        setOpeningFeedback(`Theory recommends ${expected.san}. Play that move to continue.`);
        const temp = new Chess(c.fen());
        const hintMove = temp.move(expected.san);
        if (hintMove) {
          setOpeningArrow([{ from: hintMove.from, to: hintMove.to, color: '#81B64C' }]);
        }
        return false;
      }

      setOpeningFen(c.fen());
      setOpeningLastMove({ from: m.from, to: m.to });
      setOpeningFeedback(null);
      setOpeningArrow([]);
      setOpeningNote(expected.note ? `${m.san}: ${expected.note}` : `Played ${m.san}.`);
      soundEngine.playMove();

      const nextIdx = openingStep + 1;
      if (nextIdx >= activeReviewItem.variation.steps.length) {
        setOpeningStep(nextIdx);
        finishReviewItem(activeReviewItem, openingMistakesRef.current, missedPliesRef.current);
      } else {
        setOpeningStep(nextIdx);
        const replyStep = activeReviewItem.variation.steps[nextIdx];
        window.setTimeout(() => {
          const reply = openingChessRef.current.move(replyStep.san);
          if (reply) {
            setOpeningFen(openingChessRef.current.fen());
            setOpeningLastMove({ from: reply.from, to: reply.to });
            const after = nextIdx + 1;
            setOpeningStep(after);
            setOpeningNote(
              replyStep.note
                ? `${reply.san}: ${replyStep.note}`
                : `Opponent played ${reply.san}.`
            );
            soundEngine.playMove();
            if (after >= activeReviewItem.variation.steps.length) {
              finishReviewItem(activeReviewItem, openingMistakesRef.current, missedPliesRef.current);
            }
          }
        }, 380);
      }

      return true;
    } catch {
      return false;
    }
  };

  const revealOpeningHint = () => {
    if (!activeReviewItem) return;
    const expected = activeReviewItem.variation.steps[openingStep];
    if (!expected) return;
    try {
      const temp = new Chess(openingChessRef.current.fen());
      const m = temp.move(expected.san);
      if (m) {
        openingMistakesRef.current += 1;
        setOpeningMistakes(openingMistakesRef.current);
        missedPliesRef.current = [...missedPliesRef.current, openingStep];
        setOpeningArrow([{ from: m.from, to: m.to, color: '#81B64C' }]);
        setOpeningFeedback(`Hint: theory plays ${expected.san}.`);
      }
    } catch {
      // Ignore
    }
  };

  // ---------------- ANALYSIS BOARD STATE ----------------
  const analysisChessRef = useRef<Chess>(new Chess());
  const [analysisFen, setAnalysisFen] = useState(new Chess().fen());
  const [analysisOrientation, setAnalysisOrientation] = useState<PieceColor>('w');
  const [analysisLastMove, setAnalysisLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showCandidateArrows, setShowCandidateArrows] = useState(true);
  const [fenInput, setFenInput] = useState('');
  const [fenError, setFenError] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const analysisEval = useMemo(
    () => getPositionEvaluation(analysisFen, 2),
    [analysisFen]
  );

  const analysisCandidates = useMemo(() => {
    if (mode !== 'analysis') return [];
    return getRankedMoves(analysisFen, 2, 240).slice(0, 3);
  }, [analysisFen, mode]);

  const analysisArrows: BoardArrow[] = useMemo(() => {
    if (!showCandidateArrows) return [];
    const palette = ['#81B64C', '#59A6E8', '#E5A93C'];
    return analysisCandidates.map((c, idx) => ({
      from: c.move.from,
      to: c.move.to,
      color: palette[idx] || '#81B64C',
    }));
  }, [analysisCandidates, showCandidateArrows]);

  const analysisOpening = useMemo(() => {
    return detectOpening(analysisChessRef.current.history());
  }, [analysisFen]);

  const handleAnalysisMove = (from: string, to: string, promotion?: PieceType): boolean => {
    const c = analysisChessRef.current;
    try {
      const m = c.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' });
      if (!m) return false;
      setAnalysisFen(c.fen());
      setAnalysisLastMove({ from: m.from, to: m.to });
      if (m.captured) soundEngine.playCapture();
      else soundEngine.playMove();
      return true;
    } catch {
      return false;
    }
  };

  const handleLoadFen = () => {
    try {
      const test = new Chess(fenInput.trim());
      analysisChessRef.current = test;
      setAnalysisFen(test.fen());
      setAnalysisLastMove(null);
      setFenError(null);
      setFenInput('');
      setShowSheet(false);
    } catch {
      setFenError('Invalid FEN string.');
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel(null), 1600);
  };

  const dueReviewCount = useMemo(() => reviewQueue.filter((i) => i.isDue).length, [reviewQueue]);

  const endgameEval = useMemo(() => {
    if (mode !== 'endgames') return { display: '0.0', whiteAdvantagePct: 50 };
    return getPositionEvaluation(endgameFen, 2);
  }, [endgameFen, mode]);

  // Compact Mode Tabs rendered seamlessly inside the centered stage
  const modeTabs = (
    <div className="grid grid-cols-4 gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-xl">
      {(
        [
          { id: 'review', label: `Learned (${reviewQueue.length})` },
          { id: 'puzzles', label: 'Puzzles' },
          { id: 'endgames', label: 'Endgames' },
          { id: 'analysis', label: 'Analyze' },
        ] as { id: PracticeMode; label: string }[]
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            setMode(item.id);
            setShowSheet(false);
          }}
          className={`py-1.5 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap truncate ${
            mode === item.id
              ? 'bg-[#222C3A] text-[#F7D08A]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  // ---------------- EMPTY / NO-MATCH STATES FOR PRACTICE LEARNED ----------------
  if (mode === 'review' && (allLearnedQueue.length === 0 || reviewQueue.length === 0)) {
    return (
      <div className="max-w-[580px] mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-4">
        <header className="flex items-center justify-center min-h-[40px]">
          <h1 className="font-display text-base sm:text-lg font-bold text-slate-100">
            Practice Learned
          </h1>
        </header>
        {modeTabs}

        {allLearnedQueue.length === 0 ? (
          <div className="bg-[#161E29] border border-slate-400/12 rounded-2xl p-8 text-center space-y-3">
            <Shuffle className="w-8 h-8 text-[#81B64C] mx-auto" />
            <h2 className="font-display text-base font-bold text-slate-100">
              No learned lines yet
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Learn a line in Courses, then complete its memory test without mistakes. It will appear here for review.
            </p>
            {onGoToCourses && (
              <button
                type="button"
                onClick={onGoToCourses}
                className="mt-2 px-5 py-2.5 rounded-xl bg-[#81B64C] hover:bg-[#91C65C] text-white font-display font-bold text-xs transition-colors cursor-pointer"
              >
                Open Courses
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[#161E29] border border-slate-400/12 rounded-2xl p-8 text-center space-y-3">
            <h2 className="font-display text-base font-bold text-slate-100">
              No learned lines match the active filter
            </h2>
            <button
              type="button"
              onClick={() => {
                setMixColorFilter('all');
                setMixDueOnly(false);
                setMixCourseFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-[#222C3A] hover:bg-[#2D3A4C] text-xs font-semibold text-white cursor-pointer"
            >
              Reset Filters ({allLearnedQueue.length} Total)
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---------------- CONFIGURE STAGE PROPS BY ACTIVE MODE ----------------
  let stageTitle = 'Practice';
  let topRight: React.ReactNode = null;
  let barMode: 'eval' | 'progress' = 'progress';
  let barPct = 0;
  let barLeftLabel = '';
  let barRightLabel = '';
  let barFillColor = '#81B64C';
  let badgeColor = '#81B64C';
  let badgeContent: React.ReactNode = '★';
  let headline = '';
  let chipText = '';
  let comment = '';
  let bubbleActions: React.ReactNode = null;
  let boardNode: React.ReactNode = null;
  let ribbonNode: React.ReactNode = null;
  let bottomActions: CoachBottomAction[] = [];

  if (mode === 'review' && activeReviewItem) {
    stageTitle = 'Practice Learned';
    topRight = (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={revealOpeningHint}
          disabled={openingStep >= activeReviewItem.variation.steps.length}
          title="Hint"
          aria-label="Show hint"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-35 cursor-pointer"
        >
          <Lightbulb className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => loadReviewItem(activeReviewItem)}
          title="Restart line"
          aria-label="Restart line"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    );

    barMode = 'progress';
    if (blitzMode && isPlayerTurnInReview) {
      barPct = Math.round((blitzRemainingMs / 5000) * 100);
      barLeftLabel = `Blitz Recall · ${(blitzRemainingMs / 1000).toFixed(1)}s`;
      barRightLabel = `${openingMistakes} mistakes`;
      barFillColor = blitzRemainingMs <= 1800 ? '#CA3431' : '#E5A93C';
    } else {
      barPct = Math.round(
        (openingStep / Math.max(1, activeReviewItem.variation.steps.length)) * 100
      );
      barLeftLabel = `Move ${openingStep} / ${activeReviewItem.variation.steps.length}`;
      barRightLabel = `${activeReviewItem.masteryPct}% Mastery`;
      barFillColor = openingMistakes > 0 ? '#E5A93C' : '#81B64C';
    }

    const isError = Boolean(openingFeedback && (openingFeedback.includes('recommends') || openingFeedback.includes('Time up')));
    badgeColor = isError ? '#E6912C' : openingStep >= activeReviewItem.variation.steps.length ? '#81B64C' : '#A88865';
    badgeContent = isError ? '?' : <BookOpen className="w-3 h-3" />;
    headline = activeReviewItem.variation.name;
    chipText = activeReviewItem.variation.eco;
    comment = openingFeedback || branchHintText || openingNote;

    boardNode = (
      <ChessBoard
        fen={openingFen}
        orientation={activeReviewItem.playerColor}
        boardTheme={boardTheme}
        pieceSet={preferences.pieceSet}
        coordinates={preferences.coordinates}
        showLegalMoves={preferences.showLegalMoves}
        animationSpeed={preferences.animationSpeed}
        interactive={openingStep < activeReviewItem.variation.steps.length}
        allowedColor={activeReviewItem.playerColor}
        lastMove={openingLastMove}
        extraArrows={openingArrow}
        moveBadge={
          openingLastMove && !isError && openingStep > 0
            ? { square: openingLastMove.to, type: 'good' }
            : null
        }
        onMove={handleOpeningMove}
      />
    );

    const playedSteps = activeReviewItem.variation.steps.slice(0, openingStep);
    ribbonNode = (
      <div className="flex items-center gap-1 bg-[#131922] border border-slate-400/10 rounded-xl px-2.5 h-11 overflow-x-auto no-scrollbar">
        {playedSteps.length === 0 ? (
          <span className="text-xs text-slate-400 font-mono">
            Play {activeReviewItem.playerColor === 'w' ? 'White' : 'Black'} moves from memory...
          </span>
        ) : (
          playedSteps.map((st, idx) => (
            <React.Fragment key={`${st.san}-${idx}`}>
              {idx % 2 === 0 && (
                <span className="font-mono text-xs text-slate-500 pl-1 shrink-0">
                  {Math.floor(idx / 2) + 1}.
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded font-mono text-xs shrink-0 ${
                  idx === playedSteps.length - 1
                    ? 'bg-[#263140] text-white font-bold'
                    : 'text-slate-300'
                }`}
              >
                {st.san}
              </span>
            </React.Fragment>
          ))
        )}
      </div>
    );

    bottomActions = [
      {
        id: 'filters',
        label: 'Mix',
        icon: <SlidersHorizontal className="w-4 h-4" />,
        onClick: () => setShowSheet(true),
      },
      {
        id: 'branches',
        label: 'Branches',
        icon: <GitBranch className="w-4 h-4" />,
        active: branchMode,
        onClick: () => setBranchMode((b) => !b),
      },
      {
        id: 'blitz',
        label: 'Blitz 5s',
        icon: <Timer className="w-4 h-4" />,
        active: blitzMode,
        onClick: () => setBlitzMode((b) => !b),
      },
      {
        id: 'next',
        label: 'Next Line',
        icon: <Shuffle className="w-4 h-4" />,
        primary: true,
        onClick: () => pickRandomLearnedLine(activeReviewItem.variation.id),
      },
    ];
  } else if (mode === 'puzzles') {
    stageTitle = 'Tactical Puzzles';
    topRight = (
      <span className="font-mono text-xs text-slate-300 tabular-nums pr-1">
        Streak {puzzleStreak}
      </span>
    );

    barMode = 'progress';
    barPct = Math.round(((puzzleIdx + 1) / TACTICAL_PUZZLES.length) * 100);
    barLeftLabel = `Puzzle ${puzzleIdx + 1} / ${TACTICAL_PUZZLES.length}`;
    barRightLabel = puzzle.theme;
    barFillColor = puzzleStatus === 'solved' ? '#81B64C' : puzzleStatus === 'wrong' ? '#E6912C' : '#5C8BB0';

    badgeColor = puzzleStatus === 'solved' ? '#81B64C' : puzzleStatus === 'wrong' ? '#E6912C' : '#5C8BB0';
    badgeContent = puzzleStatus === 'solved' ? '★' : puzzleStatus === 'wrong' ? '?' : '!';
    headline = puzzle.title;
    chipText = `${puzzle.rating}`;
    comment =
      puzzleStatus === 'solved'
        ? 'Puzzle solved! Clean calculation.'
        : puzzleStatus === 'wrong'
        ? 'Not quite — check all checks, captures, and forcing threats.'
        : showPuzzleHint
        ? puzzle.hintText
        : `White to move. Find the winning ${puzzle.theme.toLowerCase()}.`;

    boardNode = (
      <ChessBoard
        fen={puzzleFen}
        orientation="w"
        boardTheme={boardTheme}
        pieceSet={preferences.pieceSet}
        coordinates={preferences.coordinates}
        showLegalMoves={preferences.showLegalMoves}
        animationSpeed={preferences.animationSpeed}
        interactive={puzzleStatus !== 'solved'}
        allowedColor="w"
        lastMove={puzzleLastMove}
        extraArrows={puzzleArrows}
        moveBadge={
          puzzleLastMove && puzzleStatus !== 'wrong'
            ? { square: puzzleLastMove.to, type: puzzleStatus === 'solved' ? 'best' : 'good' }
            : null
        }
        onMove={handlePuzzleMove}
      />
    );

    ribbonNode = (
      <div className="flex items-center gap-1 bg-[#131922] border border-slate-400/10 rounded-xl px-1.5 h-11">
        <button
          type="button"
          onClick={() => loadPuzzle((puzzleIdx - 1 + TACTICAL_PUZZLES.length) % TACTICAL_PUZZLES.length)}
          aria-label="Previous puzzle"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar px-1">
          {TACTICAL_PUZZLES.map((pz, idx) => (
            <button
              key={pz.id}
              type="button"
              onClick={() => loadPuzzle(idx)}
              className={`px-2.5 py-1 rounded-md font-mono text-xs transition-colors cursor-pointer shrink-0 ${
                idx === puzzleIdx
                  ? 'bg-[#263140] text-white font-bold ring-1 ring-slate-400/35'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              #{idx + 1} · {pz.rating}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => loadPuzzle((puzzleIdx + 1) % TACTICAL_PUZZLES.length)}
          aria-label="Next puzzle"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );

    bottomActions = [
      {
        id: 'list',
        label: 'Puzzles',
        icon: <List className="w-4 h-4" />,
        onClick: () => setShowSheet(true),
      },
      {
        id: 'hint',
        label: 'Hint',
        icon: <Lightbulb className="w-4 h-4" />,
        disabled: puzzleStatus === 'solved',
        onClick: revealPuzzleHint,
      },
      {
        id: 'retry',
        label: 'Retry',
        icon: <RotateCcw className="w-4 h-4" />,
        onClick: () => loadPuzzle(puzzleIdx),
      },
      {
        id: 'next',
        label: 'Next Puzzle',
        primary: true,
        onClick: () => loadPuzzle((puzzleIdx + 1) % TACTICAL_PUZZLES.length),
      },
    ];
  } else if (mode === 'endgames') {
    stageTitle = 'Endgame Drills';
    topRight = (
      <button
        type="button"
        onClick={() => setEndgameOrientation((o) => (o === 'w' ? 'b' : 'w'))}
        aria-label="Flip board"
        title="Flip board"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer"
      >
        <ArrowLeftRight className="w-4 h-4" />
      </button>
    );

    barMode = 'eval';
    barPct = endgameEval.whiteAdvantagePct;
    barLeftLabel = endgameEval.display;

    badgeColor = endgameResult ? '#81B64C' : '#5C8BB0';
    badgeContent = endgameResult ? '★' : '✓';
    headline = endgame.title;
    chipText = endgame.difficulty;
    comment = endgameResult || `${endgame.goal} ${endgame.description}`;

    boardNode = (
      <ChessBoard
        fen={endgameFen}
        orientation={endgameOrientation}
        boardTheme={boardTheme}
        pieceSet={preferences.pieceSet}
        coordinates={preferences.coordinates}
        showLegalMoves={preferences.showLegalMoves}
        animationSpeed={preferences.animationSpeed}
        interactive={!endgameThinking && !endgameResult}
        allowedColor={endgame.playerColor}
        lastMove={endgameLastMove}
        showEvalBar={false}
        onMove={handleEndgameMove}
      />
    );

    ribbonNode = (
      <div className="flex items-center gap-1 bg-[#131922] border border-slate-400/10 rounded-xl px-1.5 h-11">
        <button
          type="button"
          onClick={() => loadEndgame((endgameIdx - 1 + ENDGAME_DRILLS.length) % ENDGAME_DRILLS.length)}
          aria-label="Previous drill"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar px-1">
          {ENDGAME_DRILLS.map((dr, idx) => (
            <button
              key={dr.id}
              type="button"
              onClick={() => loadEndgame(idx)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer shrink-0 ${
                idx === endgameIdx
                  ? 'bg-[#263140] text-white font-semibold ring-1 ring-slate-400/35'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {dr.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => loadEndgame((endgameIdx + 1) % ENDGAME_DRILLS.length)}
          aria-label="Next drill"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );

    bottomActions = [
      {
        id: 'list',
        label: 'Drills',
        icon: <List className="w-4 h-4" />,
        onClick: () => setShowSheet(true),
      },
      {
        id: 'flip',
        label: 'Flip',
        icon: <ArrowLeftRight className="w-4 h-4" />,
        onClick: () => setEndgameOrientation((o) => (o === 'w' ? 'b' : 'w')),
      },
      {
        id: 'reset',
        label: 'Reset',
        icon: <RotateCcw className="w-4 h-4" />,
        onClick: () => loadEndgame(endgameIdx),
      },
      {
        id: 'next',
        label: 'Next Drill',
        primary: true,
        onClick: () => loadEndgame((endgameIdx + 1) % ENDGAME_DRILLS.length),
      },
    ];
  } else {
    // mode === 'analysis'
    const topCand = analysisCandidates[0];
    const topEvalStr = topCand
      ? `${topCand.scoreCp > 0 ? '+' : ''}${(topCand.scoreCp / 100).toFixed(2)}`
      : analysisEval.display;

    stageTitle = 'Analysis Board';
    topRight = (
      <button
        type="button"
        onClick={() => setAnalysisOrientation((o) => (o === 'w' ? 'b' : 'w'))}
        aria-label="Flip board"
        title="Flip board"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer"
      >
        <ArrowLeftRight className="w-4 h-4" />
      </button>
    );

    barMode = 'eval';
    barPct = analysisEval.whiteAdvantagePct;
    barLeftLabel = analysisEval.display;

    badgeColor = '#81B64C';
    badgeContent = '★';
    headline = analysisOpening;
    chipText = analysisEval.display;
    comment = topCand
      ? `Top engine choice is ${topCand.move.san} (${topEvalStr}). Tap a candidate move below or drag pieces freely to explore lines.`
      : 'Game over in this position. Undo or reset to explore another line.';

    boardNode = (
      <ChessBoard
        fen={analysisFen}
        orientation={analysisOrientation}
        boardTheme={boardTheme}
        pieceSet={preferences.pieceSet}
        coordinates={preferences.coordinates}
        showLegalMoves={preferences.showLegalMoves}
        animationSpeed={preferences.animationSpeed}
        interactive={true}
        allowedColor="both"
        lastMove={analysisLastMove}
        extraArrows={analysisArrows}
        showEvalBar={false}
        onMove={handleAnalysisMove}
      />
    );

    ribbonNode = (
      <div className="flex items-center gap-1 bg-[#131922] border border-slate-400/10 rounded-xl px-1.5 h-11">
        <button
          type="button"
          onClick={() => {
            const undone = analysisChessRef.current.undo();
            if (undone) {
              setAnalysisFen(analysisChessRef.current.fen());
              setAnalysisLastMove(null);
            }
          }}
          title="Undo move"
          aria-label="Undo move"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1">
          {analysisCandidates.length === 0 ? (
            <span className="text-xs text-slate-500 font-mono">No legal moves</span>
          ) : (
            analysisCandidates.map((cand, idx) => {
              const dotColors = ['#81B64C', '#59A6E8', '#E5A93C'];
              const evalNum = (cand.scoreCp / 100).toFixed(2);
              return (
                <button
                  key={cand.move.san}
                  type="button"
                  onClick={() =>
                    handleAnalysisMove(
                      cand.move.from,
                      cand.move.to,
                      cand.move.promotion as PieceType | undefined
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1C2430] hover:bg-[#263140] text-xs font-mono cursor-pointer shrink-0 transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dotColors[idx] }}
                  />
                  <span className="font-bold text-slate-100">{cand.move.san}</span>
                  <span className="text-slate-400 tabular-nums">
                    {cand.scoreCp > 0 ? `+${evalNum}` : evalNum}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    );

    bottomActions = [
      {
        id: 'fen',
        label: 'FEN/PGN',
        icon: <SlidersHorizontal className="w-4 h-4" />,
        onClick: () => setShowSheet(true),
      },
      {
        id: 'arrows',
        label: 'Arrows',
        icon: <Sparkles className="w-4 h-4" />,
        active: showCandidateArrows,
        onClick: () => setShowCandidateArrows((v) => !v),
      },
      {
        id: 'flip',
        label: 'Flip',
        icon: <ArrowLeftRight className="w-4 h-4" />,
        onClick: () => setAnalysisOrientation((o) => (o === 'w' ? 'b' : 'w')),
      },
      {
        id: 'reset',
        label: 'Reset Board',
        primary: true,
        icon: <RotateCcw className="w-4 h-4" />,
        onClick: () => {
          analysisChessRef.current = new Chess();
          setAnalysisFen(analysisChessRef.current.fen());
          setAnalysisLastMove(null);
        },
      },
    ];
  }

  return (
    <>
      <CoachBoardStage
        title={stageTitle}
        topRight={topRight}
        subHeader={modeTabs}
        barMode={barMode}
        barPct={barPct}
        barLeftLabel={barLeftLabel}
        barRightLabel={barRightLabel}
        barFillColor={barFillColor}
        badgeColor={badgeColor}
        badgeContent={badgeContent}
        headline={headline}
        chipText={chipText}
        comment={comment}
        bubbleActions={bubbleActions}
        board={boardNode}
        ribbon={ribbonNode}
        bottomActions={bottomActions}
      />

      {/* Secondary Modal Sheet (Filters / Lists / FEN & PGN) */}
      <AnimatePresence>
        {showSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0E131B]/75 backdrop-blur-xs"
            onClick={() => setShowSheet(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-[460px] bg-[#161E29] border border-slate-400/18 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-400/12">
                <h2 className="font-display text-base font-bold text-slate-100">
                  {mode === 'review'
                    ? 'Practice Mix & Learned Lines'
                    : mode === 'puzzles'
                    ? 'Tactical Puzzles'
                    : mode === 'endgames'
                    ? 'Endgame Drills'
                    : 'Position Import & Export'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowSheet(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {mode === 'review' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1 p-1 bg-[#0F151E] border border-slate-400/12 rounded-lg text-xs">
                      {(['all', 'w', 'b'] as const).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setMixColorFilter(col)}
                          className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                            mixColorFilter === col
                              ? 'bg-[#222C3A] text-[#F7D08A]'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {col === 'all' ? 'All' : col === 'w' ? 'White' : 'Black'}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMixDueOnly((d) => !d)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                        mixDueOnly
                          ? 'bg-[#E5A93C]/20 border-[#E5A93C]/50 text-[#F7D08A]'
                          : 'bg-[#0F151E] border-slate-400/12 text-slate-300'
                      }`}
                    >
                      Due Only ({dueReviewCount})
                    </button>
                  </div>

                  <select
                    value={mixCourseFilter}
                    onChange={(e) => setMixCourseFilter(e.target.value)}
                    className="w-full bg-[#0F151E] border border-slate-400/12 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#E5A93C]"
                  >
                    <option value="all">All Courses ({allLearnedQueue.length} learned)</option>
                    {OPENING_COURSES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title.split(':')[0]}
                      </option>
                    ))}
                    {customLines.length > 0 && <option value="custom-repertoire">Custom Lines</option>}
                  </select>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {reviewQueue.map((item) => {
                      const active = item.variation.id === activeReviewItem?.variation.id;
                      return (
                        <button
                          key={item.variation.id}
                          type="button"
                          onClick={() => {
                            loadReviewItem(item);
                            setShowSheet(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer ${
                            active
                              ? 'bg-[#202B3A] text-white font-semibold border border-[#E5A93C]/50'
                              : 'bg-[#0F151E] text-slate-300 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{item.variation.name}</span>
                          <span className="font-mono text-[11px] text-[#2EB88A] shrink-0">
                            {item.isDue ? 'Due' : `${item.masteryPct}%`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode === 'puzzles' && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {TACTICAL_PUZZLES.map((pz, i) => (
                    <button
                      key={pz.id}
                      type="button"
                      onClick={() => {
                        loadPuzzle(i);
                        setShowSheet(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                        i === puzzleIdx
                          ? 'bg-[#202B3A] text-white font-semibold border border-[#E5A93C]/50'
                          : 'bg-[#0F151E] text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{pz.title}</span>
                      <span className="font-mono text-[11px] text-slate-400 ml-2 shrink-0">
                        {pz.rating}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'endgames' && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {ENDGAME_DRILLS.map((drill, idx) => (
                    <button
                      key={drill.id}
                      type="button"
                      onClick={() => {
                        loadEndgame(idx);
                        setShowSheet(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center justify-between cursor-pointer ${
                        idx === endgameIdx
                          ? 'bg-[#202B3A] text-white font-semibold border border-[#E5A93C]/50'
                          : 'bg-[#0F151E] text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{drill.title}</span>
                      <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                        {drill.difficulty}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'analysis' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={fenInput}
                      onChange={(e) => setFenInput(e.target.value)}
                      placeholder="Paste FEN position..."
                      className="flex-1 min-w-0 bg-[#0F151E] border border-slate-400/15 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#E5A93C]"
                    />
                    <button
                      type="button"
                      onClick={handleLoadFen}
                      className="px-3.5 py-2 rounded-lg bg-[#81B64C] hover:bg-[#91C65C] text-xs font-bold text-white cursor-pointer shrink-0"
                    >
                      Load
                    </button>
                  </div>
                  {fenError && <p className="text-xs text-[#EB6150]">{fenError}</p>}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(analysisFen, 'fen')}
                      className="py-2.5 px-3 rounded-xl bg-[#0F151E] hover:bg-[#222C3A] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedLabel === 'fen' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2EB88A]" />
                          <span>Copied FEN</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy FEN</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(analysisChessRef.current.pgn(), 'pgn')}
                      className="py-2.5 px-3 rounded-xl bg-[#0F151E] hover:bg-[#222C3A] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedLabel === 'pgn' ? (
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
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centered Random Learned Line Celebration Popup */}
      <ResultOverlayModal
        open={mode === 'review' && reviewDoneModal.open && Boolean(activeReviewItem)}
        variant="puzzle"
        title="Practice Complete!"
        subtitle={activeReviewItem?.variation.name ?? ''}
        details={`${reviewDoneModal.masteryPct}% Mastery · ${
          openingMistakes === 0
            ? 'Perfect recall'
            : `${openingMistakes} mistake${openingMistakes === 1 ? '' : 's'}`
        }`}
        primaryLabel="Next Random Line"
        onPrimary={() => {
          setReviewDoneModal((m) => ({ ...m, open: false }));
          pickRandomLearnedLine(activeReviewItem?.variation.id);
        }}
        secondaryLabel="Repeat Line"
        onSecondary={() => loadReviewItem(activeReviewItem)}
        onClose={() => setReviewDoneModal((m) => ({ ...m, open: false }))}
      />

      {/* Centered Puzzle Celebration Popup */}
      <ResultOverlayModal
        open={mode === 'puzzles' && puzzleStatus === 'solved' && showPuzzleModal}
        variant="puzzle"
        title="Puzzle Solved!"
        subtitle={puzzle.title}
        details={`${puzzle.theme} · Rating ${puzzle.rating} · Streak ${puzzleStreak}`}
        primaryLabel="Next Puzzle"
        onPrimary={() => loadPuzzle((puzzleIdx + 1) % TACTICAL_PUZZLES.length)}
        secondaryLabel="Retry"
        onSecondary={() => loadPuzzle(puzzleIdx)}
        onClose={() => setShowPuzzleModal(false)}
      />
    </>
  );
};
