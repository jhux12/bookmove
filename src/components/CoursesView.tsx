import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Flame,
  GitBranch,
  Lightbulb,
  List,
  Lock,
  Plus,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  FREE_PREVIEW_COURSE_ID,
  FREE_PREVIEW_VARIATION_ID,
  OPENING_COURSES,
  isCourseUnlocked,
  isVariationUnlocked,
} from '../data/openingCourses';
import { BOARD_THEMES } from '../data/themes';
import {
  BoardArrow,
  CustomLineSeed,
  CustomOpeningLine,
  OpeningCourse,
  OpeningVariation,
  PieceColor,
  PieceType,
  SparringSeed,
  UserPreferences,
} from '../types/chess';
import {
  computeTrainingStreak,
  exportMovesToPgn,
  findBranchingSiblings,
  parsePgnMoves,
} from '../utils/repertoire';
import { soundEngine } from '../utils/sound';
import { ChessBoard } from './ChessBoard';
import { ChessPieceSvg } from './ChessPieceSvg';
import { CoachBoardStage, CoachBottomAction } from './CoachBoardStage';
import { ResultOverlayModal } from './ResultOverlayModal';

interface CoursesViewProps {
  preferences: UserPreferences;
  onSparLine: (seed: SparringSeed) => void;
  onOpenMembership: () => void;
  focusTarget?: { courseId: string; variationId: string; nonce: number } | null;
  customSeed?: { data: CustomLineSeed; nonce: number } | null;
}

type StudioMode = 'learn' | 'drill';

interface LearnedLineEntry {
  variation: OpeningVariation;
  courseTitle: string;
  playerColor: PieceColor;
  isDue: boolean;
  attempts: number;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  preferences,
  onSparLine,
  onOpenMembership,
  focusTarget = null,
  customSeed = null,
}) => {
  const {
    effectiveTier,
    lineProgress,
    customLines,
    recordLinePractice,
    createCustomLine,
    deleteCustomLine,
  } = useAuth();

  const boardTheme = BOARD_THEMES[preferences.boardTheme];

  // Catalog filters
  const [colorFilter, setColorFilter] = useState<'all' | 'w' | 'b'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);

  // Active selection: built-in course, custom line, or random learned session
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [activeCustomLine, setActiveCustomLine] = useState<CustomOpeningLine | null>(null);
  const [studioMode, setStudioMode] = useState<StudioMode>('learn');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Random Practice of perfected lines only (+ Daily 5-Line Session, Mix filters, Branch, Blitz 5s)
  const [randomLine, setRandomLine] = useState<LearnedLineEntry | null>(null);
  const [randomStreak, setRandomStreak] = useState(0);
  const [mixColor, setMixColor] = useState<'all' | 'w' | 'b'>('all');
  const [mixDueOnly, setMixDueOnly] = useState(false);
  const [mixCourseId, setMixCourseId] = useState<string>('all');
  const [branchMode, setBranchMode] = useState(false);
  const [branchHintText, setBranchHintText] = useState<string | null>(null);
  const [blitzMode, setBlitzMode] = useState(false);
  const [blitzRemainingMs, setBlitzRemainingMs] = useState(5000);
  const [dailySession, setDailySession] = useState<{
    queue: LearnedLineEntry[];
    index: number;
    total: number;
    completedModal: boolean;
  } | null>(null);

  // Custom line builder modal (+ PGN import)
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderColor, setBuilderColor] = useState<PieceColor>('w');
  const [builderName, setBuilderName] = useState('');
  const [builderNotes, setBuilderNotes] = useState('');
  const [builderMoves, setBuilderMoves] = useState<string[]>([]);
  const [builderLastMove, setBuilderLastMove] = useState<{ from: string; to: string } | null>(null);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [showPgnImport, setShowPgnImport] = useState(false);
  const [pgnInput, setPgnInput] = useState('');
  const builderChessRef = useRef<Chess>(new Chess());
  const [builderFen, setBuilderFen] = useState(new Chess().fen());

  // ---------------- GUIDED LEARN MODE STATE ----------------
  const [learnPly, setLearnPly] = useState(0);
  const [learnNotice, setLearnNotice] = useState<string | null>(null);
  const [learnAutoActive, setLearnAutoActive] = useState(true);

  // ---------------- FLAWLESS SOLO DRILL STATE ----------------
  const drillChessRef = useRef<Chess>(new Chess());
  const [drillFen, setDrillFen] = useState(new Chess().fen());
  const [drillStep, setDrillStep] = useState(0);
  const [drillMistakes, setDrillMistakes] = useState(0);
  const drillMistakesRef = useRef(0);
  const missedPliesRef = useRef<number[]>([]);
  const drillStartPlyRef = useRef(0);
  const [drillStartPly, setDrillStartPly] = useState(0);
  const [drillLastMove, setDrillLastMove] = useState<{ from: string; to: string } | null>(null);
  const [drillFeedback, setDrillFeedback] = useState<{
    type: 'neutral' | 'good' | 'error' | 'done';
    text: string;
  }>({ type: 'neutral', text: 'Play the opening line on your own without guide arrows.' });
  const [drillArrows, setDrillArrows] = useState<BoardArrow[]>([]);
  const [drillCompleteModal, setDrillCompleteModal] = useState<{
    open: boolean;
    masteryPct: number;
    mistakes: number;
    wasWeakSpotJump: boolean;
  }>({ open: false, masteryPct: 0, mistakes: 0, wasWeakSpotJump: false });
  const [showMixSheet, setShowMixSheet] = useState(false);
  const [showStudioSheet, setShowStudioSheet] = useState(false);

  const replyTimerRef = useRef<number | null>(null);
  const learnTimerRef = useRef<number | null>(null);
  const modalTimerRef = useRef<number | null>(null);
  const ribbonScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current);
      if (learnTimerRef.current) window.clearTimeout(learnTimerRef.current);
      if (modalTimerRef.current) window.clearTimeout(modalTimerRef.current);
    };
  }, []);

  const selectedCourse: OpeningCourse | null = useMemo(
    () => OPENING_COURSES.find((c) => c.id === selectedCourseId) ?? null,
    [selectedCourseId]
  );

  // Strictly perfected & unlocked lines ONLY (masteryPct >= 80, i.e., passed with 0 mistakes)
  const perfectedPool = useMemo<LearnedLineEntry[]>(() => {
    const now = Date.now();
    const pool: LearnedLineEntry[] = [];

    for (const c of OPENING_COURSES) {
      for (const v of c.variations) {
        if (!isVariationUnlocked(c.id, v.id, effectiveTier)) continue;
        const lp = lineProgress[v.id];
        if (lp && lp.masteryPct >= 80) {
          const attempts = lp.attempts ?? 0;
          pool.push({
            variation: v,
            courseTitle: c.title.split(':')[0],
            playerColor: c.playerColor,
            isDue: attempts > 0 && lp.nextReviewMs <= now,
            attempts,
          });
        }
      }
    }

    if (effectiveTier === 'pro') {
      for (const cl of customLines) {
        const lp = lineProgress[cl.id];
        if (lp && lp.masteryPct >= 80) {
          const attempts = lp.attempts ?? 0;
          pool.push({
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
            isDue: attempts > 0 && lp.nextReviewMs <= now,
            attempts,
          });
        }
      }
    }

    return pool;
  }, [effectiveTier, lineProgress, customLines]);

  const filteredRandomPool = useMemo<LearnedLineEntry[]>(() => {
    return perfectedPool.filter((item) => {
      if (mixColor !== 'all' && item.playerColor !== mixColor) return false;
      if (mixDueOnly && !item.isDue) return false;
      if (mixCourseId !== 'all' && item.variation.courseId !== mixCourseId) return false;
      return true;
    });
  }, [perfectedPool, mixColor, mixDueOnly, mixCourseId]);

  const activeVariation: OpeningVariation | null = useMemo(() => {
    if (randomLine) return randomLine.variation;
    if (activeCustomLine) {
      return {
        id: activeCustomLine.id,
        courseId: 'custom-repertoire',
        name: activeCustomLine.name,
        eco: 'Custom',
        difficulty: 'Club',
        summary: activeCustomLine.notes || 'Your personal repertoire line.',
        steps: activeCustomLine.moves.map((san, idx) => ({
          san,
          note:
            idx === activeCustomLine.moves.length - 1 && activeCustomLine.notes
              ? activeCustomLine.notes
              : `Custom repertoire move ${Math.floor(idx / 2) + 1}${idx % 2 === 0 ? '.' : '...'} ${san}.`,
        })),
      };
    }
    if (!selectedCourse) return null;
    return (
      selectedCourse.variations.find((v) => v.id === selectedVariationId) ??
      selectedCourse.variations[0] ??
      null
    );
  }, [randomLine, activeCustomLine, selectedCourse, selectedVariationId]);

  const activePlayerColor: PieceColor = randomLine
    ? randomLine.playerColor
    : activeCustomLine
    ? activeCustomLine.playerColor
    : selectedCourse?.playerColor ?? 'w';

  // Aggregate stats + streak across all catalog lines
  const catalogStats = useMemo(() => {
    let totalLines = 0;
    let perfectedCount = 0;
    let whiteReady = 0;
    let blackReady = 0;

    for (const c of OPENING_COURSES) {
      for (const v of c.variations) {
        totalLines++;
        const prog = lineProgress[v.id];
        if (prog && prog.masteryPct >= 80) {
          perfectedCount++;
          if (isVariationUnlocked(c.id, v.id, effectiveTier)) {
            if (c.playerColor === 'w') whiteReady++;
            else blackReady++;
          }
        }
      }
    }
    const { streakDays, practicedToday } = computeTrainingStreak(lineProgress);
    return { totalLines, perfectedCount, whiteReady, blackReady, streakDays, practicedToday };
  }, [lineProgress, effectiveTier]);

  const filteredCourses = useMemo(() => {
    return OPENING_COURSES.filter((c) => {
      if (colorFilter !== 'all' && c.playerColor !== colorFilter) return false;
      if (tierFilter === 'free' && c.id !== FREE_PREVIEW_COURSE_ID) return false;
      if (tierFilter === 'paid' && c.id === FREE_PREVIEW_COURSE_ID) return false;
      return true;
    });
  }, [colorFilter, tierFilter]);

  // Compute Guided Learn timeline positions
  const learnTimeline = useMemo(() => {
    const startFen = new Chess().fen();
    if (!activeVariation) {
      return [{ fen: startFen, lastMove: null as { from: string; to: string } | null }];
    }
    const g = new Chess();
    const list: { fen: string; lastMove: { from: string; to: string } | null }[] = [
      { fen: startFen, lastMove: null },
    ];
    for (const s of activeVariation.steps) {
      const m = g.move(s.san);
      if (!m) break;
      list.push({ fen: g.fen(), lastMove: { from: m.from, to: m.to } });
    }
    return list;
  }, [activeVariation]);

  // Is it currently the player's turn at learnPly?
  const isPlayerTurnInLearn = useMemo(() => {
    if (!activeVariation || learnPly >= activeVariation.steps.length) return false;
    const turnColor: PieceColor = learnPly % 2 === 0 ? 'w' : 'b';
    return turnColor === activePlayerColor;
  }, [activeVariation, learnPly, activePlayerColor]);

  // Guide arrow in Learn Mode (shown until the line is complete)
  const learnArrow: BoardArrow[] = useMemo(() => {
    if (studioMode !== 'learn' || !activeVariation || !isPlayerTurnInLearn) return [];
    const nextStep = activeVariation.steps[learnPly];
    if (!nextStep) return [];
    const curFen = learnTimeline[learnPly]?.fen;
    if (!curFen) return [];
    try {
      const g = new Chess(curFen);
      const m = g.move(nextStep.san);
      if (!m) return [];
      return [{ from: m.from, to: m.to, color: '#E5A93C' }];
    } catch {
      return [];
    }
  }, [studioMode, activeVariation, isPlayerTurnInLearn, learnPly, learnTimeline]);

  // Auto-play opponent replies during Guided Learn when learnAutoActive is true
  useEffect(() => {
    if (learnTimerRef.current) {
      window.clearTimeout(learnTimerRef.current);
      learnTimerRef.current = null;
    }
    if (
      studioMode !== 'learn' ||
      randomLine ||
      !activeVariation ||
      !learnAutoActive ||
      learnPly >= activeVariation.steps.length ||
      isPlayerTurnInLearn
    ) {
      return;
    }

    learnTimerRef.current = window.setTimeout(() => {
      soundEngine.playMove();
      setLearnPly((p) => Math.min(activeVariation.steps.length, p + 1));
    }, 360);

    return () => {
      if (learnTimerRef.current) {
        window.clearTimeout(learnTimerRef.current);
        learnTimerRef.current = null;
      }
    };
  }, [studioMode, randomLine, activeVariation, learnAutoActive, learnPly, isPlayerTurnInLearn]);

  // Handle user executing guided move on board in Learn Mode
  const handleGuidedLearnMove = (from: string, to: string, promotion?: PieceType): boolean => {
    if (!activeVariation || !isPlayerTurnInLearn) return false;
    const expected = activeVariation.steps[learnPly];
    const curFen = learnTimeline[learnPly]?.fen;
    if (!expected || !curFen) return false;

    try {
      const g = new Chess(curFen);
      const m = g.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' });
      if (!m) return false;

      if (m.san !== expected.san) {
        setLearnNotice(`Follow the gold guide arrow to play ${expected.san}.`);
        soundEngine.playMove();
        return false;
      }

      setLearnNotice(null);
      setLearnAutoActive(true);
      if (m.captured) soundEngine.playCapture();
      else soundEngine.playMove();

      const nextPly = learnPly + 1;
      setLearnPly(nextPly);
      return true;
    } catch {
      return false;
    }
  };

  // Init Solo Test / Flawless Recall (supports Weak-Spot Jump via startFromPly)
  const initDrillForVariation = useCallback(
    (variation: OpeningVariation, color: PieceColor, startFromPly = 0) => {
      if (replyTimerRef.current) {
        window.clearTimeout(replyTimerRef.current);
        replyTimerRef.current = null;
      }
      if (modalTimerRef.current) {
        window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
      const g = new Chess();
      drillChessRef.current = g;
      drillMistakesRef.current = 0;
      missedPliesRef.current = [];
      setDrillMistakes(0);
      setDrillArrows([]);
      setBlitzRemainingMs(5000);
      setDrillCompleteModal({
        open: false,
        masteryPct: 0,
        mistakes: 0,
        wasWeakSpotJump: startFromPly > 0,
      });

      const clampedStart = Math.max(0, Math.min(startFromPly, Math.max(0, variation.steps.length - 1)));

      if (clampedStart > 0) {
        let stepIdx = 0;
        let lastExec: { from: string; to: string } | null = null;
        while (stepIdx < clampedStart && stepIdx < variation.steps.length) {
          const mv = g.move(variation.steps[stepIdx].san);
          if (mv) lastExec = { from: mv.from, to: mv.to };
          stepIdx++;
        }
        // If we landed on opponent's turn, advance 1 opponent reply so it's the player's move
        const turnColor: PieceColor = stepIdx % 2 === 0 ? 'w' : 'b';
        if (turnColor !== color && stepIdx < variation.steps.length) {
          const mv = g.move(variation.steps[stepIdx].san);
          if (mv) lastExec = { from: mv.from, to: mv.to };
          stepIdx++;
        }

        drillStartPlyRef.current = stepIdx > 0 ? clampedStart : 0;
        setDrillStartPly(drillStartPlyRef.current);
        setDrillFen(g.fen());
        setDrillLastMove(lastExec);
        setDrillStep(stepIdx);
        setDrillFeedback({
          type: 'neutral',
          text: `Weak-spot jump to move ${Math.floor(stepIdx / 2) + 1}. Nail the upcoming tactical sequence!`,
        });
        return;
      }

      drillStartPlyRef.current = 0;
      setDrillStartPly(0);

      if (color === 'b' && variation.steps.length > 0) {
        const first = variation.steps[0];
        const exec = g.move(first.san);
        setDrillFen(g.fen());
        setDrillLastMove(exec ? { from: exec.from, to: exec.to } : null);
        setDrillStep(1);
        setDrillFeedback({
          type: 'neutral',
          text: `Opponent played ${first.san}. Play the full line flawlessly from memory.`,
        });
      } else {
        setDrillFen(g.fen());
        setDrillLastMove(null);
        setDrillStep(0);
        setDrillFeedback({
          type: 'neutral',
          text: 'Play White’s opening line flawlessly on your own (0 mistakes).',
        });
      }
    },
    []
  );

  const openCourse = useCallback(
    (course: OpeningCourse, targetVariationId?: string) => {
      if (!isCourseUnlocked(course.id, effectiveTier)) {
        onOpenMembership();
        return;
      }
      const chosen =
        (targetVariationId && course.variations.find((v) => v.id === targetVariationId)) ||
        course.variations.find((v) => isVariationUnlocked(course.id, v.id, effectiveTier)) ||
        course.variations[0];

      if (chosen && !isVariationUnlocked(course.id, chosen.id, effectiveTier)) {
        onOpenMembership();
        return;
      }

      setCatalogNotice(null);
      setRandomLine(null);
      setDailySession(null);
      setBranchHintText(null);
      setActiveCustomLine(null);
      setSelectedCourseId(course.id);
      setSelectedVariationId(chosen?.id ?? null);
      setStudioMode('learn');
      setLearnPly(0);
      setLearnNotice(null);
      setLearnAutoActive(true);
      if (chosen) initDrillForVariation(chosen, course.playerColor);
    },
    [effectiveTier, onOpenMembership, initDrillForVariation]
  );

  const openCustomLineStudio = useCallback(
    (line: CustomOpeningLine) => {
      if (effectiveTier === 'free') {
        onOpenMembership();
        return;
      }
      setCatalogNotice(null);
      setRandomLine(null);
      setDailySession(null);
      setBranchHintText(null);
      setSelectedCourseId(null);
      setSelectedVariationId(null);
      setActiveCustomLine(line);
      setStudioMode('learn');
      setLearnPly(0);
      setLearnNotice(null);
      setLearnAutoActive(true);
      const fakeVar: OpeningVariation = {
        id: line.id,
        courseId: 'custom-repertoire',
        name: line.name,
        eco: 'Custom',
        difficulty: 'Club',
        summary: line.notes,
        steps: line.moves.map((san) => ({ san, note: '' })),
      };
      initDrillForVariation(fakeVar, line.playerColor);
    },
    [effectiveTier, onOpenMembership, initDrillForVariation]
  );

  const startRandomPractice = useCallback(
    (avoidLineId?: string, overridePool?: LearnedLineEntry[]) => {
      const sourcePool = overridePool ?? filteredRandomPool;
      if (perfectedPool.length === 0) {
        setCatalogNotice(
          'No perfected lines yet. Complete the Italian preview line with guide arrows, then pass it flawlessly (0 mistakes) to unlock random practice.'
        );
        return;
      }
      if (sourcePool.length === 0) {
        setCatalogNotice('No perfected lines match your current filter. Showing all perfected lines.');
        return;
      }
      setCatalogNotice(null);

      // Branch Challenge mode: jump to a sibling variation that shares a prefix and diverges on an opponent move
      if (branchMode && randomLine) {
        const branchGroup = findBranchingSiblings(randomLine, sourcePool);
        if (branchGroup && branchGroup.siblings.length > 1) {
          const alt = branchGroup.siblings.filter(
            (s) => s.variation.id !== randomLine.variation.id
          );
          const pick = alt[Math.floor(Math.random() * alt.length)] ?? branchGroup.siblings[0];
          const divStep = pick.variation.steps[branchGroup.branchPly];
          setSelectedCourseId(null);
          setSelectedVariationId(null);
          setActiveCustomLine(null);
          setRandomLine(pick);
          setBranchHintText(
            `Branch Challenge: watch for opponent's move ${
              Math.floor(branchGroup.branchPly / 2) + 1
            }...${divStep?.san ?? ''}`
          );
          setStudioMode('drill');
          initDrillForVariation(pick.variation, pick.playerColor);
          return;
        }
      }

      const candidates =
        sourcePool.length > 1 && avoidLineId
          ? sourcePool.filter((item) => item.variation.id !== avoidLineId)
          : sourcePool;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setSelectedCourseId(null);
      setSelectedVariationId(null);
      setActiveCustomLine(null);
      setBranchHintText(null);
      setRandomLine(pick);
      setStudioMode('drill');
      initDrillForVariation(pick.variation, pick.playerColor);
    },
    [perfectedPool.length, filteredRandomPool, branchMode, randomLine, initDrillForVariation]
  );

  // One-click Today's 5-Line Session (or direct start into free Italian line if none perfected yet)
  const startDailySession = () => {
    if (perfectedPool.length === 0) {
      const italian = OPENING_COURSES.find((c) => c.id === FREE_PREVIEW_COURSE_ID);
      if (italian) {
        openCourse(italian, FREE_PREVIEW_VARIATION_ID);
      }
      return;
    }

    const sorted = [...perfectedPool].sort((a, b) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
      return a.attempts - b.attempts;
    });
    const queue = sorted.slice(0, Math.min(5, sorted.length));
    const first = queue[0];
    setDailySession({
      queue,
      index: 0,
      total: queue.length,
      completedModal: false,
    });
    setSelectedCourseId(null);
    setSelectedVariationId(null);
    setActiveCustomLine(null);
    setBranchHintText(null);
    setRandomLine(first);
    setStudioMode('drill');
    initDrillForVariation(first.variation, first.playerColor);
  };

  const selectVariation = (v: OpeningVariation) => {
    if (selectedCourse && !isVariationUnlocked(selectedCourse.id, v.id, effectiveTier)) {
      onOpenMembership();
      return;
    }
    setRandomLine(null);
    setDailySession(null);
    setSelectedVariationId(v.id);
    setStudioMode('learn');
    setLearnPly(0);
    setLearnNotice(null);
    setLearnAutoActive(true);
    initDrillForVariation(v, activePlayerColor);
  };

  const switchMode = (next: StudioMode) => {
    if (learnTimerRef.current) {
      window.clearTimeout(learnTimerRef.current);
      learnTimerRef.current = null;
    }
    setStudioMode(next);
    if (next === 'learn') {
      setLearnPly(0);
      setLearnNotice(null);
      setLearnAutoActive(true);
    } else if (next === 'drill' && activeVariation) {
      initDrillForVariation(activeVariation, activePlayerColor, 0);
    }
  };

  // Open custom builder (gated to Checkmate Pro)
  const openCustomBuilder = useCallback(
    (prefill?: CustomLineSeed) => {
      if (effectiveTier === 'free') {
        onOpenMembership();
        return;
      }
      const fresh = new Chess();
      const loadedMoves: string[] = [];
      let lastMv: { from: string; to: string } | null = null;
      if (prefill?.moves?.length) {
        for (const san of prefill.moves.slice(0, 40)) {
          try {
            const m = fresh.move(san);
            if (m) {
              loadedMoves.push(m.san);
              lastMv = { from: m.from, to: m.to };
            }
          } catch {
            break;
          }
        }
      }
      builderChessRef.current = fresh;
      setBuilderFen(fresh.fen());
      setBuilderMoves(loadedMoves);
      setBuilderLastMove(lastMv);
      setBuilderName(prefill?.name ?? '');
      setBuilderNotes(prefill?.notes ?? '');
      setBuilderColor(prefill?.playerColor ?? 'w');
      setBuilderError(null);
      setShowPgnImport(false);
      setPgnInput('');
      setShowBuilder(true);
    },
    [effectiveTier, onOpenMembership]
  );

  // React to deep-link focusTarget from Archive Opening Deviation Report
  useEffect(() => {
    if (!focusTarget) return;
    const course = OPENING_COURSES.find((c) => c.id === focusTarget.courseId);
    if (course) {
      openCourse(course, focusTarget.variationId);
    } else {
      const custom = customLines.find((cl) => cl.id === focusTarget.variationId);
      if (custom) openCustomLineStudio(custom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget?.nonce]);

  // React to Save Sideline prefill from Archive Opening Deviation Report
  useEffect(() => {
    if (!customSeed) return;
    openCustomBuilder(customSeed.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSeed?.nonce]);

  // Keyboard navigation in Guided Learn (Back/Forward inspect)
  useEffect(() => {
    if (!activeVariation || studioMode !== 'learn' || randomLine || showBuilder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setLearnAutoActive(false);
        setLearnNotice(null);
        setLearnPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        setLearnAutoActive(false);
        setLearnNotice(null);
        setLearnPly((p) => Math.min(activeVariation.steps.length, p + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeVariation, studioMode, randomLine, showBuilder]);

  const finishDrillLine = useCallback(
    async (mistakesCount: number, missedPlies: number[]) => {
      if (!activeVariation) return;
      const isWeakSpotJump = drillStartPlyRef.current > 0;
      const flawless = mistakesCount === 0;
      soundEngine.playGameEnd(flawless ? 'win' : 'draw');
      if (randomLine) {
        setRandomStreak((s) => (flawless ? s + 1 : 0));
      }

      if (isWeakSpotJump) {
        setDrillFeedback({
          type: flawless ? 'done' : 'error',
          text: flawless
            ? 'Weak spot cleared! Now run the full line from Move 1 with 0 mistakes.'
            : `${mistakesCount} mistake${mistakesCount === 1 ? '' : 's'} on the weak spot. Drill it again!`,
        });
        let latestMastery = lineProgress[activeVariation.id]?.masteryPct ?? 0;
        if (mistakesCount > 0) {
          const updated = await recordLinePractice(
            activeVariation.courseId,
            activeVariation.id,
            mistakesCount,
            missedPlies
          );
          latestMastery = updated.masteryPct;
        }
        modalTimerRef.current = window.setTimeout(() => {
          setDrillCompleteModal({
            open: true,
            masteryPct: latestMastery,
            mistakes: mistakesCount,
            wasWeakSpotJump: true,
          });
        }, 280);
        return;
      }

      setDrillFeedback({
        type: flawless ? 'done' : 'error',
        text: flawless
          ? 'Flawless recall! Line perfected and added to your random practice pool.'
          : `${mistakesCount} mistake${mistakesCount === 1 ? '' : 's'} recorded. Retry with 0 mistakes to perfect this line.`,
      });
      const updated = await recordLinePractice(
        activeVariation.courseId,
        activeVariation.id,
        mistakesCount,
        missedPlies
      );

      if (dailySession && flawless && dailySession.index + 1 >= dailySession.total) {
        modalTimerRef.current = window.setTimeout(() => {
          setDailySession((prev) => (prev ? { ...prev, completedModal: true } : null));
        }, 280);
        return;
      }

      modalTimerRef.current = window.setTimeout(() => {
        setDrillCompleteModal({
          open: true,
          masteryPct: updated.masteryPct,
          mistakes: mistakesCount,
          wasWeakSpotJump: false,
        });
      }, 280);
    },
    [activeVariation, randomLine, recordLinePractice, lineProgress, dailySession]
  );

  // Blitz 5s per-move countdown during Random Practice
  const isPlayerTurnInRandomDrill = Boolean(
    randomLine &&
      activeVariation &&
      drillStep < activeVariation.steps.length &&
      (drillStep % 2 === 0 ? 'w' : 'b') === activePlayerColor &&
      !drillCompleteModal.open &&
      !dailySession?.completedModal
  );

  useEffect(() => {
    if (!randomLine || !blitzMode || !isPlayerTurnInRandomDrill) return;
    setBlitzRemainingMs(5000);
    const interval = window.setInterval(() => {
      setBlitzRemainingMs((prev) => {
        if (prev <= 100) {
          window.clearInterval(interval);
          if (activeVariation) {
            const expected = activeVariation.steps[drillStep];
            if (expected) {
              drillMistakesRef.current += 1;
              setDrillMistakes(drillMistakesRef.current);
              missedPliesRef.current = [...missedPliesRef.current, drillStep];
              setDrillFeedback({
                type: 'error',
                text: `Time up! Play ${expected.san} to continue.`,
              });
              try {
                const temp = new Chess(drillChessRef.current.fen());
                const hint = temp.move(expected.san);
                if (hint) {
                  setDrillArrows([{ from: hint.from, to: hint.to, color: '#2EB88A' }]);
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
  }, [randomLine, blitzMode, isPlayerTurnInRandomDrill, drillStep, activeVariation]);

  const handleDrillMove = (from: string, to: string, promotion?: PieceType): boolean => {
    if (!activeVariation) return false;
    const expected = activeVariation.steps[drillStep];
    if (!expected) return false;

    const c = drillChessRef.current;
    try {
      const m = c.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' });
      if (!m) return false;

      if (m.san !== expected.san) {
        c.undo();
        drillMistakesRef.current += 1;
        setDrillMistakes(drillMistakesRef.current);
        missedPliesRef.current = [...missedPliesRef.current, drillStep];
        soundEngine.playMove();
        setDrillFeedback({
          type: 'error',
          text: `Wrong move (${m.san}). Theory plays ${expected.san}. Finish or restart for a flawless pass.`,
        });
        const temp = new Chess(c.fen());
        const hint = temp.move(expected.san);
        if (hint) {
          setDrillArrows([{ from: hint.from, to: hint.to, color: '#2EB88A' }]);
        }
        return false;
      }

      setDrillFen(c.fen());
      setDrillLastMove({ from: m.from, to: m.to });
      setDrillArrows([]);
      setDrillFeedback({
        type: 'good',
        text: expected.note ? `${m.san} — ${expected.note}` : `Correct! Played ${m.san}.`,
      });
      if (m.captured) soundEngine.playCapture();
      else soundEngine.playMove();

      const nextIdx = drillStep + 1;
      if (nextIdx >= activeVariation.steps.length) {
        setDrillStep(nextIdx);
        finishDrillLine(drillMistakesRef.current, missedPliesRef.current);
        return true;
      }

      setDrillStep(nextIdx);
      const replyStep = activeVariation.steps[nextIdx];
      replyTimerRef.current = window.setTimeout(() => {
        const reply = drillChessRef.current.move(replyStep.san);
        if (reply) {
          setDrillFen(drillChessRef.current.fen());
          setDrillLastMove({ from: reply.from, to: reply.to });
          const afterReply = nextIdx + 1;
          setDrillStep(afterReply);
          soundEngine.playMove();
          if (afterReply >= activeVariation.steps.length) {
            finishDrillLine(drillMistakesRef.current, missedPliesRef.current);
          } else {
            setDrillFeedback({
              type: 'neutral',
              text: replyStep.note
                ? `Opponent played ${reply.san}. ${replyStep.note}`
                : `Opponent played ${reply.san}. Your move?`,
            });
          }
        }
      }, 360);

      return true;
    } catch {
      return false;
    }
  };

  const showDrillHint = () => {
    if (!activeVariation) return;
    const expected = activeVariation.steps[drillStep];
    if (!expected) return;
    const temp = new Chess(drillFen);
    const m = temp.move(expected.san);
    if (m) {
      drillMistakesRef.current += 1;
      setDrillMistakes(drillMistakesRef.current);
      missedPliesRef.current = [...missedPliesRef.current, drillStep];
      setDrillArrows([{ from: m.from, to: m.to, color: '#2EB88A' }]);
      setDrillFeedback({
        type: 'error',
        text: `Hint used (${expected.san}). Restart for an unassisted flawless run.`,
      });
    }
  };

  // ---------------- BUILDER HANDLERS ----------------
  const handleBuilderMove = (from: string, to: string, promotion?: PieceType): boolean => {
    if (builderMoves.length >= 40) {
      setBuilderError('Maximum 40 half-moves per custom line.');
      return false;
    }
    const c = builderChessRef.current;
    try {
      const m = c.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' });
      if (!m) return false;
      setBuilderFen(c.fen());
      setBuilderLastMove({ from: m.from, to: m.to });
      setBuilderMoves((prev) => [...prev, m.san]);
      setBuilderError(null);
      if (m.captured) soundEngine.playCapture();
      else soundEngine.playMove();
      return true;
    } catch {
      return false;
    }
  };

  const handleApplyPgnImport = () => {
    const res = parsePgnMoves(pgnInput);
    if (res.error) {
      setBuilderError(res.error);
      return;
    }
    const g = new Chess();
    let lastMv: { from: string; to: string } | null = null;
    for (const san of res.moves) {
      const m = g.move(san);
      if (m) lastMv = { from: m.from, to: m.to };
    }
    builderChessRef.current = g;
    setBuilderFen(g.fen());
    setBuilderMoves(res.moves);
    setBuilderLastMove(lastMv);
    if (!builderName.trim() && res.suggestedName) {
      setBuilderName(res.suggestedName);
    }
    setBuilderError(null);
    setShowPgnImport(false);
    setPgnInput('');
  };

  const saveCustomLine = async () => {
    if (!builderName.trim()) {
      setBuilderError('Enter a name for your repertoire line.');
      return;
    }
    if (builderMoves.length === 0) {
      setBuilderError('Play at least 1 move on the board.');
      return;
    }
    setBuilderSaving(true);
    setBuilderError(null);
    try {
      const saved = await createCustomLine({
        name: builderName,
        playerColor: builderColor,
        moves: builderMoves,
        notes: builderNotes,
      });
      setShowBuilder(false);
      openCustomLineStudio(saved);
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : 'Unable to save line.');
    } finally {
      setBuilderSaving(false);
    }
  };

  const copyLinePgn = async (id: string, name: string, color: PieceColor, moves: string[]) => {
    try {
      await navigator.clipboard.writeText(exportMovesToPgn(name, color, moves));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  // ---------------- RENDER: RANDOM LEARNED PRACTICE STAGE ----------------
  if (randomLine && activeVariation) {
    const inDaily = Boolean(dailySession && !dailySession.completedModal);
    const hasBranchPool =
      filteredRandomPool.length > 1 && Boolean(findBranchingSiblings(randomLine, filteredRandomPool));
    const totalSteps = activeVariation.steps.length;
    const isBlitzActive = blitzMode && isPlayerTurnInRandomDrill;

    const randomBadgeColor =
      drillFeedback.type === 'error'
        ? '#EB6150'
        : drillFeedback.type === 'done' || drillFeedback.type === 'good'
        ? '#81B64C'
        : '#A88865';

    const randomBadgeContent =
      drillFeedback.type === 'error' ? (
        <X className="w-3 h-3" />
      ) : drillFeedback.type === 'done' || drillFeedback.type === 'good' ? (
        <Check className="w-3 h-3" />
      ) : (
        <Target className="w-3 h-3" />
      );

    const randomBottomActions: CoachBottomAction[] = [
      {
        id: 'mix',
        label: 'Mix',
        icon: <SlidersHorizontal className="w-4 h-4" />,
        onClick: () => setShowMixSheet(true),
        disabled: inDaily,
        active: showMixSheet,
      },
      {
        id: 'branches',
        label: 'Branches',
        icon: <GitBranch className="w-4 h-4" />,
        onClick: () => setBranchMode((v) => !v),
        active: branchMode,
      },
      {
        id: 'blitz',
        label: 'Blitz 5s',
        icon: <Timer className="w-4 h-4" />,
        onClick: () => setBlitzMode((v) => !v),
        active: blitzMode,
      },
      inDaily
        ? {
            id: 'restart',
            label: 'Restart',
            icon: <RotateCcw className="w-4 h-4" />,
            onClick: () => initDrillForVariation(activeVariation, activePlayerColor),
            primary: true,
          }
        : {
            id: 'next',
            label: 'Next Line',
            icon: <Shuffle className="w-4 h-4" />,
            onClick: () => startRandomPractice(activeVariation.id),
            primary: true,
          },
    ];

    return (
      <>
        <CoachBoardStage
          onBack={() => {
            setRandomLine(null);
            setDailySession(null);
            setShowMixSheet(false);
          }}
          backLabel="All Courses"
          title={
            dailySession
              ? `Session ${dailySession.index + 1}/${dailySession.total}`
              : 'Random Practice'
          }
          topRight={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={showDrillHint}
                disabled={drillStep >= totalSteps}
                aria-label="Show hint"
                title="Show hint"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-35 transition-colors cursor-pointer"
              >
                <Lightbulb className="w-4 h-4 text-[#2EB88A]" />
              </button>
              <button
                type="button"
                onClick={() => initDrillForVariation(activeVariation, activePlayerColor)}
                aria-label="Restart line"
                title="Restart line"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onSparLine({
                    name: activeVariation.name,
                    moves: activeVariation.steps.map((s) => s.san),
                    playerColor: activePlayerColor,
                    summary: activeVariation.summary,
                  })
                }
                aria-label="Spar vs Bot"
                title="Spar this line vs Bot"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#E5A93C] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Swords className="w-4 h-4" />
              </button>
            </div>
          }
          barMode="progress"
          barPct={
            isBlitzActive
              ? Math.round((blitzRemainingMs / 5000) * 100)
              : Math.round((drillStep / Math.max(1, totalSteps)) * 100)
          }
          barLeftLabel={
            isBlitzActive
              ? `Blitz ${(blitzRemainingMs / 1000).toFixed(1)}s`
              : `Move ${drillStep} / ${totalSteps}`
          }
          barRightLabel={
            isBlitzActive ? `Streak: ${randomStreak}` : `Mistakes: ${drillMistakes}`
          }
          barFillColor={
            isBlitzActive
              ? blitzRemainingMs <= 1800
                ? '#EB6150'
                : '#E5A93C'
              : drillMistakes > 0
              ? '#E5A93C'
              : '#2EB88A'
          }
          badgeColor={randomBadgeColor}
          badgeContent={randomBadgeContent}
          headline={activeVariation.name}
          chipText={`${activePlayerColor === 'w' ? 'White' : 'Black'} · ${activeVariation.eco}`}
          comment={drillFeedback.text}
          bubbleActions={
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
              <span className="font-mono text-[#2EB88A]">Streak: {randomStreak}</span>
              <span>·</span>
              <span>{filteredRandomPool.length} perfected matching</span>
              {branchHintText && (
                <span className="text-amber-700 font-semibold">{branchHintText}</span>
              )}
              {branchMode && !hasBranchPool && (
                <span className="text-slate-500">
                  Perfect a sibling line to unlock branches
                </span>
              )}
            </div>
          }
          board={
            <ChessBoard
              fen={drillFen}
              orientation={activePlayerColor}
              boardTheme={boardTheme}
              pieceSet={preferences.pieceSet}
              coordinates={preferences.coordinates}
              showLegalMoves={preferences.showLegalMoves}
              animationSpeed={preferences.animationSpeed}
              interactive={drillStep < totalSteps}
              allowedColor={activePlayerColor}
              lastMove={drillLastMove}
              extraArrows={drillArrows}
              showEvalBar={false}
              moveBadge={
                drillLastMove &&
                (drillFeedback.type === 'good' || drillFeedback.type === 'done')
                  ? { square: drillLastMove.to, type: 'good' }
                  : null
              }
              onMove={handleDrillMove}
            />
          }
          ribbon={
            <div className="flex items-center gap-1 bg-[#161E29] border border-slate-400/12 rounded-xl px-1.5 h-11">
              <button
                type="button"
                onClick={() =>
                  ribbonScrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' })
                }
                aria-label="Scroll moves left"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div
                ref={ribbonScrollRef}
                className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1"
              >
                {drillStep === 0 ? (
                  <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                    Play {activePlayerColor === 'w' ? 'White' : 'Black'}'s opening line from memory
                  </span>
                ) : (
                  activeVariation.steps.slice(0, drillStep).map((st, idx) => {
                    const mvNum = Math.floor(idx / 2) + 1;
                    const isLast = idx === drillStep - 1;
                    return (
                      <span
                        key={`${st.san}-${idx}`}
                        className={`px-2 py-1 rounded-md font-mono text-xs whitespace-nowrap shrink-0 ${
                          isLast
                            ? 'bg-[#253142] text-white font-semibold'
                            : 'text-slate-300'
                        }`}
                      >
                        {idx % 2 === 0 ? `${mvNum}. ` : ''}
                        {st.san}
                      </span>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  ribbonScrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })
                }
                aria-label="Scroll moves right"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          }
          bottomActions={randomBottomActions}
        />

        {/* Mix Filters Modal */}
        <AnimatePresence>
          {showMixSheet && !inDaily && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0E131B]/75 backdrop-blur-xs p-0 sm:p-4"
              onClick={() => setShowMixSheet(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-[460px] bg-[#161E29] border border-slate-400/16 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-400/12">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-100">
                      Random Mix Filters
                    </h2>
                    <p className="text-xs text-slate-400">
                      {filteredRandomPool.length} of {perfectedPool.length} perfected lines match
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMixSheet(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
                    aria-label="Close mix filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">Side</span>
                    <div className="inline-flex items-center gap-1 p-1 bg-[#0F151E] border border-slate-400/10 rounded-xl">
                      {(['all', 'w', 'b'] as const).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setMixColor(col)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            mixColor === col
                              ? 'bg-[#222C3A] text-[#F7D08A]'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {col === 'all' ? 'All' : col === 'w' ? 'White' : 'Black'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">Spaced Repetition</span>
                    <button
                      type="button"
                      onClick={() => setMixDueOnly((d) => !d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                        mixDueOnly
                          ? 'bg-[#2EB88A]/18 border-[#2EB88A]/45 text-[#2EB88A]'
                          : 'bg-[#0F151E] border-slate-400/12 text-slate-300 hover:text-white'
                      }`}
                    >
                      {mixDueOnly ? 'Due Only: On' : 'Due Only: Off'}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Course Filter
                    </label>
                    <select
                      value={mixCourseId}
                      onChange={(e) => setMixCourseId(e.target.value)}
                      className="w-full bg-[#0F151E] border border-slate-400/15 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#E5A93C]"
                    >
                      <option value="all">All Courses ({perfectedPool.length} perfected)</option>
                      {OPENING_COURSES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title.split(':')[0]}
                        </option>
                      ))}
                      {customLines.length > 0 && (
                        <option value="custom-repertoire">Custom Repertoire</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMixSheet(false);
                      onSparLine({
                        name: activeVariation.name,
                        moves: activeVariation.steps.map((s) => s.san),
                        playerColor: activePlayerColor,
                        summary: activeVariation.summary,
                      });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#0F151E] hover:bg-[#222C3A] border border-slate-400/12 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Swords className="w-4 h-4 text-[#E5A93C]" />
                    <span>Spar vs Bot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMixSheet(false);
                      startRandomPractice(activeVariation.id);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#81B64C] hover:bg-[#91C65C] text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Draw Matching Line</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ResultOverlayModal
          open={drillCompleteModal.open}
          variant={drillCompleteModal.mistakes === 0 ? 'puzzle' : 'draw'}
          title={
            drillCompleteModal.mistakes === 0 ? 'Clean Recall!' : 'Line Completed with Mistakes'
          }
          subtitle={activeVariation.name}
          details={`Session Streak: ${randomStreak} · ${
            drillCompleteModal.mistakes === 0
              ? 'Zero mistakes'
              : `${drillCompleteModal.mistakes} mistake${
                  drillCompleteModal.mistakes === 1 ? '' : 's'
                }`
          }`}
          primaryLabel={
            dailySession && drillCompleteModal.mistakes === 0 && dailySession.index + 1 < dailySession.total
              ? `Next Session Line (${dailySession.index + 2}/${dailySession.total})`
              : dailySession && drillCompleteModal.mistakes > 0
              ? 'Retry Line'
              : 'Next Random Line'
          }
          onPrimary={() => {
            const wasFlawless = drillCompleteModal.mistakes === 0;
            setDrillCompleteModal((m) => ({ ...m, open: false }));
            if (dailySession) {
              if (!wasFlawless) {
                initDrillForVariation(activeVariation, activePlayerColor);
                return;
              }
              const nextIdx = dailySession.index + 1;
              if (nextIdx < dailySession.total) {
                const nextEntry = dailySession.queue[nextIdx];
                setDailySession({ ...dailySession, index: nextIdx });
                setRandomLine(nextEntry);
                initDrillForVariation(nextEntry.variation, nextEntry.playerColor);
              }
              return;
            }
            startRandomPractice(activeVariation.id);
          }}
          secondaryLabel="Spar vs Bot"
          onSecondary={() => {
            setDrillCompleteModal((m) => ({ ...m, open: false }));
            onSparLine({
              name: activeVariation.name,
              moves: activeVariation.steps.map((s) => s.san),
              playerColor: activePlayerColor,
              summary: activeVariation.summary,
            });
          }}
          onClose={() => setDrillCompleteModal((m) => ({ ...m, open: false }))}
        />

        {/* Today's 5-Line Session Completion Overlay */}
        <ResultOverlayModal
          open={Boolean(dailySession?.completedModal)}
          variant="win"
          title="Today's Session Complete!"
          subtitle={`${dailySession?.total ?? 0} Perfected Lines Reviewed`}
          details={`Streak: ${catalogStats.streakDays} day${
            catalogStats.streakDays === 1 ? '' : 's'
          } · Your repertoire recall is sharp`}
          primaryLabel="Keep Drilling Random Mix"
          onPrimary={() => {
            setDailySession(null);
            startRandomPractice(activeVariation.id);
          }}
          secondaryLabel="Back to Courses"
          onSecondary={() => {
            setDailySession(null);
            setRandomLine(null);
          }}
          onClose={() => setDailySession(null)}
        />
      </>
    );
  }

  // ---------------- RENDER: COURSE STUDIO ----------------
  if ((selectedCourse || activeCustomLine) && activeVariation) {
    const variations = selectedCourse ? selectedCourse.variations : [];
    const currentVarIdx = variations.findIndex((v) => v.id === activeVariation.id);
    const hasNextVar = selectedCourse && currentVarIdx >= 0 && currentVarIdx < variations.length - 1;
    const nextVar = hasNextVar ? variations[currentVarIdx + 1] : null;
    const nextVarUnlocked =
      nextVar && selectedCourse
        ? isVariationUnlocked(selectedCourse.id, nextVar.id, effectiveTier)
        : false;

    const prog = lineProgress[activeVariation.id];
    const isLinePerfected = Boolean(prog && prog.masteryPct >= 80);

    // Compute Weak-Spot Heatmap for current line
    const weakEntries = Object.entries(prog?.weakPlies ?? {})
      .map(([plyStr, count]) => ({ ply: Number(plyStr), count }))
      .filter((item) => Number.isInteger(item.ply) && item.ply >= 0 && item.count > 0)
      .sort((a, b) => b.count - a.count || a.ply - b.ply);
    const worstWeak = weakEntries[0];
    const weakJumpPly = worstWeak ? Math.max(0, worstWeak.ply - 2) : 0;

    const totalSteps = activeVariation.steps.length;
    const guidedFinished = learnPly >= totalSteps;
    const currentStepObj = learnPly > 0 ? activeVariation.steps[learnPly - 1] : null;
    const upcomingStepObj = learnPly < totalSteps ? activeVariation.steps[learnPly] : null;

    const displayedFen =
      studioMode === 'learn'
        ? learnTimeline[learnPly]?.fen ?? new Chess().fen()
        : drillFen;
    const displayedLastMove =
      studioMode === 'learn'
        ? learnTimeline[learnPly]?.lastMove ?? null
        : drillLastMove;

    const studioBadgeColor =
      studioMode === 'learn'
        ? learnNotice
          ? '#EB6150'
          : guidedFinished
          ? '#2EB88A'
          : '#E5A93C'
        : drillFeedback.type === 'error'
        ? '#EB6150'
        : drillFeedback.type === 'done' || drillFeedback.type === 'good'
        ? '#81B64C'
        : '#A88865';

    const studioBadgeContent =
      studioMode === 'learn' ? (
        learnNotice ? (
          <X className="w-3 h-3" />
        ) : guidedFinished ? (
          <Check className="w-3 h-3" />
        ) : (
          <BookOpen className="w-3 h-3" />
        )
      ) : drillFeedback.type === 'error' ? (
        <X className="w-3 h-3" />
      ) : drillFeedback.type === 'done' || drillFeedback.type === 'good' ? (
        <Check className="w-3 h-3" />
      ) : (
        <Target className="w-3 h-3" />
      );

    const learnHeadline = guidedFinished
      ? 'Guided Line Complete'
      : currentStepObj
      ? `Move ${Math.floor((learnPly - 1) / 2) + 1}${
          (learnPly - 1) % 2 === 0 ? '. ' : '... '
        }${currentStepObj.san}${currentStepObj.keyIdea ? ` · ${currentStepObj.keyIdea}` : ''}`
      : 'Follow the Guide Arrows';

    const learnComment = learnNotice
      ? learnNotice
      : guidedFinished
      ? `${
          currentStepObj?.note ? `${currentStepObj.note} ` : ''
        }Now complete this line on your own with 0 mistakes before moving on.`
      : currentStepObj
      ? currentStepObj.note
      : upcomingStepObj
      ? isPlayerTurnInLearn
        ? `Play ${upcomingStepObj.san} on the board following the gold guide arrow.`
        : "Playing opponent's opening move..."
      : 'No moves in this line.';

    const drillFourthAction: CoachBottomAction =
      hasNextVar && selectedCourse && nextVar
        ? !nextVarUnlocked
          ? {
              id: 'unlock-next',
              label: 'Unlock Pro',
              icon: <Lock className="w-4 h-4" />,
              onClick: onOpenMembership,
              primary: true,
            }
          : isLinePerfected
          ? {
              id: 'next-line',
              label: 'Next Line',
              icon: <ChevronRight className="w-4 h-4" />,
              onClick: () => selectVariation(nextVar),
              primary: true,
            }
          : {
              id: 'learn-again',
              label: 'Guided Learn',
              icon: <BookOpen className="w-4 h-4" />,
              onClick: () => switchMode('learn'),
              primary: true,
            }
        : perfectedPool.length > 0
        ? {
            id: 'practice-mix',
            label: 'Practice Mix',
            icon: <Shuffle className="w-4 h-4" />,
            onClick: () => startRandomPractice(),
            primary: true,
          }
        : {
            id: 'learn-again',
            label: 'Guided Learn',
            icon: <BookOpen className="w-4 h-4" />,
            onClick: () => switchMode('learn'),
            primary: true,
          };

    const studioBottomActions: CoachBottomAction[] =
      studioMode === 'learn'
        ? [
            {
              id: 'lines',
              label: selectedCourse ? 'Lines' : 'Details',
              icon: <List className="w-4 h-4" />,
              onClick: () => setShowStudioSheet(true),
              active: showStudioSheet,
            },
            {
              id: 'back',
              label: 'Back',
              icon: <ChevronLeft className="w-4 h-4" />,
              onClick: () => {
                setLearnAutoActive(false);
                setLearnNotice(null);
                setLearnPly((p) => Math.max(0, p - 1));
              },
              disabled: learnPly === 0,
            },
            {
              id: 'restart',
              label: 'Restart',
              icon: <RotateCcw className="w-4 h-4" />,
              onClick: () => {
                setLearnNotice(null);
                setLearnPly(0);
                setLearnAutoActive(true);
              },
            },
            {
              id: 'next',
              label: guidedFinished ? 'Flawless Test' : 'Next',
              icon: guidedFinished ? (
                <Target className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              ),
              onClick: () => {
                if (guidedFinished) {
                  switchMode('drill');
                } else {
                  setLearnAutoActive(true);
                  setLearnNotice(null);
                  setLearnPly((p) => Math.min(totalSteps, p + 1));
                }
              },
              primary: true,
            },
          ]
        : [
            {
              id: 'lines',
              label: selectedCourse ? 'Lines' : 'Heatmap',
              icon: <List className="w-4 h-4" />,
              onClick: () => setShowStudioSheet(true),
              active: showStudioSheet,
            },
            {
              id: 'hint',
              label: 'Hint',
              icon: <Lightbulb className="w-4 h-4" />,
              onClick: showDrillHint,
              disabled: drillStep >= totalSteps,
            },
            {
              id: 'restart',
              label: 'Restart',
              icon: <RotateCcw className="w-4 h-4" />,
              onClick: () => initDrillForVariation(activeVariation, activePlayerColor, 0),
            },
            drillFourthAction,
          ];

    return (
      <>
        <CoachBoardStage
          onBack={() => {
            setSelectedCourseId(null);
            setActiveCustomLine(null);
            setShowStudioSheet(false);
          }}
          backLabel="All Courses"
          title={activeVariation.name}
          topRight={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  copyLinePgn(
                    activeVariation.id,
                    activeVariation.name,
                    activePlayerColor,
                    activeVariation.steps.map((s) => s.san)
                  )
                }
                aria-label="Copy PGN"
                title={copiedId === activeVariation.id ? 'Copied PGN' : 'Copy PGN'}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                {copiedId === activeVariation.id ? (
                  <Check className="w-4 h-4 text-[#2EB88A]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  onSparLine({
                    name: activeVariation.name,
                    moves: activeVariation.steps.map((s) => s.san),
                    playerColor: activePlayerColor,
                    summary: activeVariation.summary,
                  })
                }
                aria-label="Spar vs Bot"
                title="Spar this line vs Bot"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#E5A93C] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <Swords className="w-4 h-4" />
              </button>
            </div>
          }
          subHeader={
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-xl flex-1">
                <button
                  type="button"
                  onClick={() => switchMode('learn')}
                  className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    studioMode === 'learn'
                      ? 'bg-[#222C3A] text-[#F7D08A]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>1. Guided Learn</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('drill')}
                  className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    studioMode === 'drill'
                      ? 'bg-[#222C3A] text-[#2EB88A]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>2. Flawless Test</span>
                </button>
              </div>
              {perfectedPool.length > 0 && (
                <button
                  type="button"
                  onClick={() => startRandomPractice()}
                  title={`Practice ${perfectedPool.length} perfected lines randomly`}
                  className="px-3 py-2 rounded-xl bg-[#161E29] hover:bg-[#222C3A] border border-slate-400/12 text-xs font-semibold text-[#2EB88A] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Mix ({perfectedPool.length})</span>
                </button>
              )}
            </div>
          }
          barMode="progress"
          barPct={
            studioMode === 'learn'
              ? Math.round((learnPly / Math.max(1, totalSteps)) * 100)
              : Math.round((drillStep / Math.max(1, totalSteps)) * 100)
          }
          barLeftLabel={
            studioMode === 'learn'
              ? `Move ${learnPly} / ${totalSteps}`
              : `${drillStartPly > 0 ? 'Weak-Spot · ' : ''}Move ${drillStep} / ${totalSteps}`
          }
          barRightLabel={
            studioMode === 'learn'
              ? isLinePerfected
                ? 'Perfected'
                : 'Unperfected'
              : `Mistakes: ${drillMistakes}`
          }
          barFillColor={
            studioMode === 'learn'
              ? guidedFinished
                ? '#2EB88A'
                : '#E5A93C'
              : drillMistakes > 0
              ? '#E5A93C'
              : '#2EB88A'
          }
          badgeColor={studioBadgeColor}
          badgeContent={studioBadgeContent}
          headline={studioMode === 'learn' ? learnHeadline : activeVariation.name}
          chipText={
            studioMode === 'learn'
              ? `${learnPly}/${totalSteps}`
              : isLinePerfected
              ? 'Perfected'
              : activeVariation.eco
          }
          comment={studioMode === 'learn' ? learnComment : drillFeedback.text}
          bubbleActions={
            studioMode === 'learn' ? (
              guidedFinished ? (
                <button
                  type="button"
                  onClick={() => switchMode('drill')}
                  className="text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  Start Flawless 0-Mistake Test →
                </button>
              ) : upcomingStepObj && isPlayerTurnInLearn ? (
                <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                  <span className="text-amber-700">
                    Follow gold arrow ({upcomingStepObj.san})
                  </span>
                  <button
                    type="button"
                    onClick={() => switchMode('drill')}
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Skip to Test →
                  </button>
                </div>
              ) : undefined
            ) : weakEntries.length > 0 && worstWeak ? (
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                <button
                  type="button"
                  onClick={() =>
                    initDrillForVariation(activeVariation, activePlayerColor, weakJumpPly)
                  }
                  className="text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  Drill Weak Spot (Move {Math.floor(weakJumpPly / 2) + 1}) →
                </button>
                <button
                  type="button"
                  onClick={() => setShowStudioSheet(true)}
                  className="text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Heatmap ({weakEntries.length})
                </button>
              </div>
            ) : undefined
          }
          board={
            <ChessBoard
              fen={displayedFen}
              orientation={activePlayerColor}
              boardTheme={boardTheme}
              pieceSet={preferences.pieceSet}
              coordinates={preferences.coordinates}
              showLegalMoves={preferences.showLegalMoves}
              animationSpeed={preferences.animationSpeed}
              interactive={
                studioMode === 'learn' ? isPlayerTurnInLearn : drillStep < totalSteps
              }
              allowedColor={activePlayerColor}
              lastMove={displayedLastMove}
              extraArrows={studioMode === 'learn' ? learnArrow : drillArrows}
              showEvalBar={false}
              moveBadge={
                studioMode === 'learn' && displayedLastMove && learnPly > 0
                  ? { square: displayedLastMove.to, type: 'book' }
                  : studioMode === 'drill' &&
                    drillLastMove &&
                    (drillFeedback.type === 'good' || drillFeedback.type === 'done')
                  ? { square: drillLastMove.to, type: 'good' }
                  : null
              }
              onMove={studioMode === 'learn' ? handleGuidedLearnMove : handleDrillMove}
            />
          }
          ribbon={
            <div className="flex items-center gap-1 bg-[#161E29] border border-slate-400/12 rounded-xl px-1.5 h-11">
              <button
                type="button"
                onClick={() =>
                  ribbonScrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' })
                }
                aria-label="Scroll ribbon left"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={ribbonScrollRef}
                className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar px-1"
              >
                {studioMode === 'learn' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLearnAutoActive(false);
                        setLearnNotice(null);
                        setLearnPly(0);
                      }}
                      className={`px-2 py-1 rounded-md font-mono text-xs cursor-pointer shrink-0 transition-colors ${
                        learnPly === 0
                          ? 'bg-[#E5A93C] text-[#0E131B] font-bold'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      Start
                    </button>
                    {activeVariation.steps.map((s, idx) => {
                      const ply = idx + 1;
                      const moveNum = Math.floor(idx / 2) + 1;
                      const isCurrent = learnPly === ply;
                      return (
                        <button
                          key={`${s.san}-${idx}`}
                          type="button"
                          onClick={() => {
                            setLearnAutoActive(false);
                            setLearnNotice(null);
                            setLearnPly(ply);
                          }}
                          className={`px-2 py-1 rounded-md font-mono text-xs cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-[#E5A93C] text-[#0E131B] font-bold'
                              : ply < learnPly
                              ? 'bg-[#202B3A] text-slate-100'
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                          }`}
                        >
                          {idx % 2 === 0 ? `${moveNum}.` : ''}
                          {s.san}
                        </button>
                      );
                    })}
                  </>
                ) : selectedCourse && variations.length > 0 ? (
                  variations.map((v) => {
                    const active = v.id === activeVariation.id;
                    const varUnlocked = isVariationUnlocked(selectedCourse.id, v.id, effectiveTier);
                    const lp = lineProgress[v.id];
                    const perfected = (lp?.masteryPct ?? 0) >= 80;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => selectVariation(v)}
                        className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                          active
                            ? 'bg-[#253142] text-white font-semibold border border-[#E5A93C]/50'
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        {!varUnlocked ? (
                          <Lock className="w-3 h-3 text-[#E5A93C]" />
                        ) : perfected ? (
                          <CheckCircle2 className="w-3 h-3 text-[#2EB88A]" />
                        ) : null}
                        <span>{v.name}</span>
                      </button>
                    );
                  })
                ) : drillStep === 0 ? (
                  <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                    Play {activePlayerColor === 'w' ? 'White' : 'Black'}'s moves flawlessly
                  </span>
                ) : (
                  activeVariation.steps.slice(0, drillStep).map((st, idx) => {
                    const mvNum = Math.floor(idx / 2) + 1;
                    const isLast = idx === drillStep - 1;
                    return (
                      <span
                        key={`${st.san}-${idx}`}
                        className={`px-2 py-1 rounded-md font-mono text-xs whitespace-nowrap shrink-0 ${
                          isLast
                            ? 'bg-[#253142] text-white font-semibold'
                            : 'text-slate-300'
                        }`}
                      >
                        {idx % 2 === 0 ? `${mvNum}. ` : ''}
                        {st.san}
                      </span>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  ribbonScrollRef.current?.scrollBy({ left: 160, behavior: 'smooth' })
                }
                aria-label="Scroll ribbon right"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] shrink-0 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          }
          bottomActions={studioBottomActions}
        />

        {/* Course Lines & Weak-Spot Heatmap Modal Sheet */}
        <AnimatePresence>
          {showStudioSheet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0E131B]/75 backdrop-blur-xs p-0 sm:p-4"
              onClick={() => setShowStudioSheet(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-[500px] max-h-[85vh] overflow-y-auto bg-[#161E29] border border-slate-400/16 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-400/12">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span>{activePlayerColor === 'w' ? 'White' : 'Black'}</span>
                      <span>·</span>
                      <span>{activeVariation.eco}</span>
                      <span>·</span>
                      <span>{activeVariation.difficulty}</span>
                      <span>·</span>
                      <span>{Math.ceil(totalSteps / 2)} moves</span>
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-100 mt-0.5 truncate">
                      {selectedCourse ? selectedCourse.title : activeVariation.name}
                    </h2>
                    {activeVariation.summary && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {activeVariation.summary}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStudioSheet(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] shrink-0 cursor-pointer"
                    aria-label="Close course lines"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Weak-Spot Mistake Heatmap */}
                {weakEntries.length > 0 && worstWeak && (
                  <div className="p-3 rounded-xl bg-[#0F151E] border border-[#EB6150]/25 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-200">Weak-Spot Heatmap</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowStudioSheet(false);
                          setStudioMode('drill');
                          initDrillForVariation(activeVariation, activePlayerColor, weakJumpPly);
                        }}
                        className="text-[#F7D08A] hover:text-white font-semibold cursor-pointer"
                      >
                        Drill Weak Spot (Move {Math.floor(weakJumpPly / 2) + 1}) →
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                      {weakEntries.slice(0, 6).map((w) => {
                        const st = activeVariation.steps[w.ply];
                        const mvNum = Math.floor(w.ply / 2) + 1;
                        const prefix = w.ply % 2 === 0 ? `${mvNum}.` : `${mvNum}...`;
                        return (
                          <span
                            key={w.ply}
                            className="px-2 py-0.5 rounded bg-[#161E29] text-[#F9B4AB]"
                          >
                            {prefix}
                            {st?.san ?? '?'} ({w.count}x)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Course Lines List */}
                {selectedCourse && variations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300">Course Lines</span>
                      <span className="font-mono tabular-nums">{variations.length} variations</span>
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {variations.map((v) => {
                        const active = v.id === activeVariation.id;
                        const varUnlocked = isVariationUnlocked(
                          selectedCourse.id,
                          v.id,
                          effectiveTier
                        );
                        const lp = lineProgress[v.id];
                        const mastery = lp?.masteryPct ?? 0;
                        const perfected = mastery >= 80;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setShowStudioSheet(false);
                              selectVariation(v);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#202B3A] text-white font-semibold border border-[#E5A93C]/55'
                                : 'bg-[#0F151E] text-slate-300 hover:text-white hover:bg-[#1B2432]'
                            }`}
                          >
                            <span className="truncate flex items-center gap-2">
                              {!varUnlocked ? (
                                <Lock className="w-3.5 h-3.5 text-[#E5A93C] shrink-0" />
                              ) : perfected ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#2EB88A] shrink-0" />
                              ) : null}
                              <span className="truncate">{v.name}</span>
                            </span>
                            <span
                              className={`font-mono text-[11px] tabular-nums shrink-0 ${
                                !varUnlocked
                                  ? 'text-[#E5A93C]'
                                  : perfected
                                  ? 'text-[#2EB88A]'
                                  : mastery > 0
                                  ? 'text-[#E5A93C]'
                                  : 'text-slate-500'
                              }`}
                            >
                              {!varUnlocked
                                ? 'Pro'
                                : perfected
                                ? 'Perfected'
                                : mastery > 0
                                ? `${mastery}%`
                                : effectiveTier === 'free'
                                ? 'Preview'
                                : 'New'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {perfectedPool.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowStudioSheet(false);
                      startRandomPractice();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#2EB88A] hover:bg-[#38C998] text-[#0E131B] font-display font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Practice Learned Lines ({perfectedPool.length})</span>
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flawless Test Completion Modal (Gates Next Line on 0 Mistakes + Pro Lock) */}
        <ResultOverlayModal
          open={drillCompleteModal.open}
          variant={drillCompleteModal.mistakes === 0 ? 'puzzle' : 'draw'}
          title={
            drillCompleteModal.wasWeakSpotJump
              ? drillCompleteModal.mistakes === 0
                ? 'Weak Spot Cleared!'
                : 'Weak Spot Needs Another Pass'
              : drillCompleteModal.mistakes === 0
              ? 'Line Perfected!'
              : 'Mistakes Detected — Retry'
          }
          subtitle={activeVariation.name}
          details={
            drillCompleteModal.wasWeakSpotJump
              ? 'Partial weak-spot jump · Run the full line from Move 1 to record perfection'
              : drillCompleteModal.mistakes === 0
              ? 'Zero mistakes · Added to your learned lines pool'
              : `${drillCompleteModal.mistakes} mistake${
                  drillCompleteModal.mistakes === 1 ? '' : 's'
                } · Complete with 0 mistakes to unlock the next line`
          }
          primaryLabel={
            drillCompleteModal.wasWeakSpotJump
              ? 'Run Full Line Flawlessly'
              : drillCompleteModal.mistakes === 0
              ? hasNextVar
                ? nextVarUnlocked
                  ? 'Next Line'
                  : 'Unlock All 48 Lines (Pro)'
                : 'Practice Learned Lines'
              : 'Retry Flawlessly'
          }
          onPrimary={() => {
            const wasFlawless = drillCompleteModal.mistakes === 0;
            const wasWeakJump = drillCompleteModal.wasWeakSpotJump;
            setDrillCompleteModal((m) => ({ ...m, open: false }));
            if (wasWeakJump) {
              initDrillForVariation(activeVariation, activePlayerColor, 0);
              return;
            }
            if (wasFlawless) {
              if (hasNextVar && selectedCourse && nextVar) {
                if (!nextVarUnlocked) {
                  onOpenMembership();
                } else {
                  selectVariation(nextVar);
                }
              } else {
                startRandomPractice();
              }
            } else {
              initDrillForVariation(activeVariation, activePlayerColor, 0);
            }
          }}
          secondaryLabel={
            drillCompleteModal.mistakes === 0 ? 'Spar vs Bot' : 'Review with Arrows'
          }
          onSecondary={() => {
            const wasFlawless = drillCompleteModal.mistakes === 0;
            setDrillCompleteModal((m) => ({ ...m, open: false }));
            if (wasFlawless) {
              onSparLine({
                name: activeVariation.name,
                moves: activeVariation.steps.map((s) => s.san),
                playerColor: activePlayerColor,
                summary: activeVariation.summary,
              });
            } else {
              switchMode('learn');
            }
          }}
          onClose={() => setDrillCompleteModal((m) => ({ ...m, open: false }))}
        />
      </>
    );
  }

  // ---------------- RENDER: COURSE CATALOG ----------------
  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Catalog Header & Filters */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100 tracking-tight">
            Build your opening repertoire
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Learn a line. Test your memory. Make it yours.
          </p>
          <p className="text-xs text-slate-400 mt-3 tabular-nums">
            {catalogStats.perfectedCount > 0
              ? `${catalogStats.perfectedCount} of ${catalogStats.totalLines} lines learned · ${perfectedPool.length} ready to practice`
              : effectiveTier === 'free'
              ? 'Try a free Italian Game lesson. No account needed.'
              : 'Choose a course to begin.'}
          </p>
        </div>

        <button
          type="button"
          onClick={startDailySession}
          className="min-h-11 px-5 py-2.5 rounded-xl bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] text-sm font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>{perfectedPool.length > 0 ? "Start today's practice" : 'Start free lesson'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
          {/* Color Filter */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-xl">
            {(
              [
                { id: 'all', label: 'All Sides' },
                { id: 'w', label: 'White' },
                { id: 'b', label: 'Black' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setColorFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  colorFilter === opt.id
                    ? 'bg-[#222C3A] text-[#F7D08A]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tier Filter */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-xl">
            {(
              [
                { id: 'all', label: 'All Courses' },
                { id: 'free', label: 'Free' },
                { id: 'paid', label: 'Pro' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTierFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  tierFilter === opt.id
                    ? 'bg-[#222C3A] text-[#F7D08A]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {perfectedPool.length > 0 && (
            <button
              type="button"
              onClick={() => startRandomPractice()}
              className="min-h-10 px-3 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Practice learned ({perfectedPool.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => openCustomBuilder()}
            className="min-h-10 px-3 text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer sm:ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Custom line{effectiveTier === 'free' ? ' · Pro' : ''}
          </button>
        </div>

      {catalogStats.streakDays > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 border-y border-slate-400/10 py-3">
          <span className="inline-flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-[#E5A93C]" />{catalogStats.streakDays} day streak</span>
          <span>{catalogStats.whiteReady} white lines ready</span>
          <span>{catalogStats.blackReady} black lines ready</span>
        </div>
      )}

      {catalogNotice && (
        <div className="px-4 py-3 rounded-xl bg-[#161E29] border border-[#E5A93C]/40 text-xs text-[#F7D08A] flex items-center justify-between gap-3">
          <span>{catalogNotice}</span>
          <button
            type="button"
            onClick={() => setCatalogNotice(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Course Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCourses.map((course) => {
          const unlocked = isCourseUnlocked(course.id, effectiveTier);
          const totalVars = course.variations.length;
          const perfectedVars = course.variations.filter(
            (v) => (lineProgress[v.id]?.masteryPct ?? 0) >= 80
          ).length;
          const courseMastery =
            totalVars > 0 ? Math.round((perfectedVars / totalVars) * 100) : 0;
          const isPreviewCourse =
            course.id === FREE_PREVIEW_COURSE_ID && effectiveTier === 'free';

          return (
            <motion.button
              key={course.id}
              type="button"
              aria-label={`${course.title}${!unlocked ? ' · Pro course' : ''}`}
              onClick={() => openCourse(course)}
              className="group text-left w-full bg-[#161E29] border border-slate-400/12 hover:border-[#E5A93C]/50 rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        course.playerColor === 'w'
                          ? 'bg-[#EAEAEA]/10 border-slate-300/20'
                          : 'bg-[#0F151E] border-slate-400/15'
                      }`}
                    >
                      <div className="w-6 h-6">
                        <ChessPieceSvg
                          type="n"
                          color={course.playerColor}
                          pieceSet={preferences.pieceSet}
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                        <span>{course.playerColor === 'w' ? 'White' : 'Black'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{course.ecoRange}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {course.styleTag}
                      </div>
                    </div>
                  </div>

                  {!unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E5A93C] shrink-0">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Pro</span>
                    </span>
                  ) : isPreviewCourse ? (
                    <span className="text-[11px] font-semibold text-[#2EB88A] shrink-0 font-mono tabular-nums">
                      Free lesson
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2EB88A] shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                      <span>Pro</span>
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="font-display text-base font-bold text-slate-100 group-hover:text-white leading-snug">
                    {course.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {course.tagline}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-400/10">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                    <span>
                      {perfectedVars} / {totalVars} perfected
                    </span>
                    <span className={courseMastery >= 80 ? 'text-[#2EB88A]' : 'text-slate-200'}>
                      {courseMastery}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#0F151E] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        courseMastery >= 80 ? 'bg-[#2EB88A]' : 'bg-[#E5A93C]'
                      }`}
                      style={{ width: `${courseMastery}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={unlocked ? 'text-[#F7D08A]' : 'text-[#E5A93C]'}>
                    {isPreviewCourse
                      ? 'Preview Free Line'
                      : unlocked
                      ? 'Learn & Perfect Lines'
                      : 'Unlock course · Pro'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Custom Repertoire Lines Section */}
      <section className="bg-[#161E29] border border-slate-400/12 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E5A93C]" />
              <span>Your Custom Repertoire Lines</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Save personal prep or paste a PGN, pass it flawlessly, and drill it in random practice.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCustomBuilder()}
            className="px-3 py-1.5 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] border border-slate-400/15 text-xs font-semibold text-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {effectiveTier === 'free' ? (
              <>
                <Lock className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>Unlock Builder (Pro)</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>Add Custom Line</span>
              </>
            )}
          </button>
        </div>

        {customLines.length === 0 ? (
          <p className="text-xs text-slate-500">
            {effectiveTier === 'free'
              ? 'Subscribe to Checkmate Pro to author, import PGNs, and sync custom repertoire lines across devices.'
              : 'No custom lines saved yet. Click "Add Custom Line" to record moves or paste a PGN.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-400/10 border border-slate-400/10 rounded-xl overflow-hidden bg-[#0F151E]">
            {customLines.map((line) => {
              const mastery = lineProgress[line.id]?.masteryPct ?? 0;
              return (
                <div
                  key={line.id}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-display font-semibold text-slate-100 truncate">
                        {line.name}
                      </span>
                      <span className="text-slate-500 font-mono">
                        · {line.playerColor === 'w' ? 'White' : 'Black'} ·{' '}
                        {Math.ceil(line.moves.length / 2)} moves ·{' '}
                        {mastery >= 80 ? 'Perfected' : `${mastery}%`}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                      {line.moves.join(' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        copyLinePgn(line.id, line.name, line.playerColor, line.moves)
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#161E29] hover:bg-[#222C3A] text-xs font-medium text-slate-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === line.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2EB88A]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>PGN</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCustomLineStudio(line)}
                      className="px-3 py-1.5 rounded-lg bg-[#222C3A] hover:bg-[#2D3A4C] text-xs font-semibold text-white cursor-pointer"
                    >
                      Learn
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCustomLine(line.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 cursor-pointer"
                      aria-label="Delete custom line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Custom Line Builder Modal */}
      <AnimatePresence>
        {showBuilder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E131B]/75 backdrop-blur-xs overflow-y-auto"
            onClick={() => setShowBuilder(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[900px] bg-[#161E29] border border-slate-400/18 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-400/12">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-100">
                    Build Custom Repertoire Line
                  </h2>
                  <p className="text-xs text-slate-400">
                    Play moves on the board or paste a PGN sequence to save opening prep.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPgnImport((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                      showPgnImport
                        ? 'bg-[#222C3A] border-[#E5A93C]/50 text-[#F7D08A]'
                        : 'bg-[#0F151E] border-slate-400/15 text-slate-200 hover:bg-[#222C3A]'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Paste PGN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBuilder(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 cursor-pointer"
                    aria-label="Close builder"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showPgnImport && (
                <div className="p-3 rounded-xl bg-[#0F151E] border border-slate-400/15 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Paste PGN or Move List (up to 40 half-moves)
                  </label>
                  <textarea
                    value={pgnInput}
                    onChange={(e) => setPgnInput(e.target.value)}
                    rows={3}
                    placeholder="1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5"
                    className="w-full bg-[#161E29] border border-slate-400/15 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#E5A93C] resize-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPgnImport(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyPgnImport}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2EB88A] hover:bg-[#38C998] text-[#0E131B] font-bold text-xs cursor-pointer"
                    >
                      Load PGN Moves
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                <div className="w-full max-w-[440px] mx-auto">
                  <ChessBoard
                    fen={builderFen}
                    orientation={builderColor}
                    boardTheme={boardTheme}
                    pieceSet={preferences.pieceSet}
                    coordinates={preferences.coordinates}
                    showLegalMoves={preferences.showLegalMoves}
                    animationSpeed={preferences.animationSpeed}
                    interactive={true}
                    allowedColor="both"
                    lastMove={builderLastMove}
                    onMove={handleBuilderMove}
                  />
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Line Name
                    </label>
                    <input
                      type="text"
                      value={builderName}
                      onChange={(e) => setBuilderName(e.target.value)}
                      maxLength={80}
                      placeholder="e.g. Sicilian Kalashnikov Prep"
                      className="w-full bg-[#0F151E] border border-slate-400/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#E5A93C]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">Train as</span>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#0F151E] border border-slate-400/10 rounded-lg">
                      {(['w', 'b'] as PieceColor[]).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setBuilderColor(col)}
                          className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                            builderColor === col
                              ? 'bg-[#222C3A] text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {col === 'w' ? 'White' : 'Black'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Recorded Moves ({builderMoves.length}/40)
                    </label>
                    <div className="min-h-[60px] max-h-24 overflow-y-auto p-2.5 rounded-lg bg-[#0F151E] border border-slate-400/12 font-mono text-xs text-slate-200">
                      {builderMoves.length === 0 ? (
                        <span className="text-slate-500">Make moves on the board...</span>
                      ) : (
                        builderMoves
                          .map((san, idx) =>
                            idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ${san}` : san
                          )
                          .join(' ')
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const undone = builderChessRef.current.undo();
                          if (undone) {
                            setBuilderFen(builderChessRef.current.fen());
                            setBuilderMoves((prev) => prev.slice(0, -1));
                            setBuilderLastMove(null);
                          }
                        }}
                        disabled={builderMoves.length === 0}
                        className="py-1.5 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] disabled:opacity-40 text-xs text-slate-200 cursor-pointer"
                      >
                        Undo Move
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          builderChessRef.current = new Chess();
                          setBuilderFen(builderChessRef.current.fen());
                          setBuilderMoves([]);
                          setBuilderLastMove(null);
                        }}
                        disabled={builderMoves.length === 0}
                        className="py-1.5 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] disabled:opacity-40 text-xs text-slate-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Coaching Notes (optional)
                    </label>
                    <textarea
                      value={builderNotes}
                      onChange={(e) => setBuilderNotes(e.target.value)}
                      maxLength={300}
                      rows={2}
                      placeholder="Key strategic idea or reminder..."
                      className="w-full bg-[#0F151E] border border-slate-400/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#E5A93C] resize-none"
                    />
                  </div>

                  {builderError && <p className="text-xs text-[#EB6150]">{builderError}</p>}

                  <button
                    type="button"
                    disabled={builderSaving}
                    onClick={saveCustomLine}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#E5A93C] hover:bg-[#F0B952] disabled:opacity-50 text-[#0E131B] font-display font-bold text-xs cursor-pointer transition-colors"
                  >
                    {builderSaving ? 'Saving Line...' : 'Save & Learn Line'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
