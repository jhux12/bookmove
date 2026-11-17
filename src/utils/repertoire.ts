import { Chess } from 'chess.js';
import { OPENING_COURSES } from '../data/openingCourses';
import {
  CustomOpeningLine,
  LineProgress,
  OpeningVariation,
  PieceColor,
} from '../types/chess';
import { detectOpening } from './openings';

export { parseWeakPlies, serializeWeakPlies } from './weakPlies';

/**
 * Computes the user's consecutive active training days & lines practiced today.
 */
export function computeTrainingStreak(
  lineProgress: Record<string, LineProgress>
): { streakDays: number; practicedToday: number } {
  const dayKeys = new Set<string>();
  const toLocalDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  const today = new Date();
  const todayKey = toLocalDayKey(today);
  let practicedToday = 0;

  for (const lp of Object.values(lineProgress)) {
    if (!lp.lastPracticedAt || lp.attempts <= 0) continue;
    const dt = new Date(lp.lastPracticedAt);
    if (Number.isNaN(dt.getTime())) continue;
    const k = toLocalDayKey(dt);
    dayKeys.add(k);
    if (k === todayKey) practicedToday++;
  }

  let streakDays = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!dayKeys.has(todayKey)) {
    // Allow streak to continue if user hasn't finished today's session yet, checking yesterday
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dayKeys.has(toLocalDayKey(cursor))) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { streakDays, practicedToday };
}

/**
 * Parses a pasted PGN (with headers/comments/variations) into clean SAN moves (up to 40 plies).
 */
export function parsePgnMoves(pgnText: string): {
  moves: string[];
  suggestedName: string;
  error?: string;
} {
  const trimmed = pgnText.trim();
  if (!trimmed) {
    return { moves: [], suggestedName: '', error: 'Paste a PGN or move list first.' };
  }

  // Extract optional PGN Opening or Event header for naming
  const openingHeader = trimmed.match(/\[Opening\s+"([^"]+)"\]/i)?.[1]?.trim();
  const eventHeader = trimmed.match(/\[Event\s+"([^"]+)"\]/i)?.[1]?.trim();

  try {
    const parser = new Chess();
    parser.loadPgn(trimmed);
    const sanHistory = parser.history().slice(0, 40);
    if (sanHistory.length > 0) {
      const detected = openingHeader || detectOpening(sanHistory) || eventHeader || 'Imported Line';
      return {
        moves: sanHistory,
        suggestedName: detected === 'Custom Opening' && eventHeader ? eventHeader : detected,
      };
    }
  } catch {
    // Fallback token-by-token parser for raw move strings like "1. e4 e5 2. Nf3 Nc6"
  }

  try {
    const cleaned = trimmed
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\$\d+/g, ' ')
      .replace(/\d+\.(\.\.)?/g, ' ')
      .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const g = new Chess();
    const out: string[] = [];
    for (const tok of tokens) {
      if (out.length >= 40) break;
      const m = g.move(tok);
      if (!m) {
        return {
          moves: [],
          suggestedName: '',
          error: `Could not parse move "${tok}". Check your PGN notation.`,
        };
      }
      out.push(m.san);
    }
    if (out.length === 0) {
      return { moves: [], suggestedName: '', error: 'No legal moves found in PGN.' };
    }
    return {
      moves: out,
      suggestedName: openingHeader || detectOpening(out),
    };
  } catch {
    return { moves: [], suggestedName: '', error: 'Invalid PGN or move notation.' };
  }
}

export function exportMovesToPgn(
  name: string,
  playerColor: PieceColor,
  moves: string[]
): string {
  const moveStr = moves
    .map((san, idx) => (idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ${san}` : san))
    .join(' ');
  const safeName = name.replace(/"/g, "'");
  return `[Event "Checkmate Repertoire"]\n[Opening "${safeName}"]\n[Orientation "${
    playerColor === 'w' ? 'White' : 'Black'
  }"]\n\n${moveStr} *`;
}

export interface LearnedVariationItem {
  variation: OpeningVariation;
  courseTitle: string;
  playerColor: PieceColor;
}

/**
 * Finds sibling perfected lines that share a non-trivial prefix and diverge on an opponent move,
 * enabling true opponent-deviation branch recognition drills.
 */
export function findBranchingSiblings<T extends LearnedVariationItem>(
  target: T,
  pool: T[]
): {
  branchPly: number;
  siblings: T[];
} | null {
  const sameColor = pool.filter(
    (item) =>
      item.playerColor === target.playerColor && item.variation.id !== target.variation.id
  );
  if (sameColor.length === 0) return null;

  let bestBranchPly = -1;
  const siblingsByPly = new Map<number, T[]>();

  for (const cand of sameColor) {
    const a = target.variation.steps;
    const b = cand.variation.steps;
    let common = 0;
    while (common < a.length && common < b.length && a[common].san === b[common].san) {
      common++;
    }
    if (common < 2) continue;
    // Check if divergence happens on an opponent turn (i.e. turnColor !== playerColor)
    const divTurn: PieceColor = common % 2 === 0 ? 'w' : 'b';
    if (divTurn !== target.playerColor && common < a.length && common < b.length) {
      const existing = siblingsByPly.get(common) ?? [];
      existing.push(cand);
      siblingsByPly.set(common, existing);
      if (common > bestBranchPly) bestBranchPly = common;
    }
  }

  if (bestBranchPly < 0) return null;
  return {
    branchPly: bestBranchPly,
    siblings: [target, ...(siblingsByPly.get(bestBranchPly) ?? [])],
  };
}

export interface GameRepertoireAnalysis {
  matchedCourseId: string | null;
  matchedVariationId: string | null;
  matchedLineName: string;
  isCustomLine: boolean;
  matchedPlies: number;
  totalLinePlies: number;
  deviatedBy: 'none' | 'player' | 'opponent';
  deviationMoveNumber: number;
  expectedSan: string | null;
  playedSan: string | null;
  seedMoves: string[];
}

/**
 * Compares a finished bot game against the entire course + custom repertoire catalog
 * to report where the player or bot left theory.
 */
export function analyzeGameAgainstRepertoire(
  gameSans: string[],
  playerColor: PieceColor,
  customLines: CustomOpeningLine[]
): GameRepertoireAnalysis | null {
  if (gameSans.length === 0) return null;

  interface CandidateLine {
    courseId: string | null;
    variationId: string | null;
    name: string;
    isCustom: boolean;
    steps: string[];
  }

  const candidates: CandidateLine[] = [];

  for (const c of OPENING_COURSES) {
    if (c.playerColor !== playerColor) continue;
    for (const v of c.variations) {
      candidates.push({
        courseId: c.id,
        variationId: v.id,
        name: `${c.title.split(':')[0]} — ${v.name}`,
        isCustom: false,
        steps: v.steps.map((s) => s.san),
      });
    }
  }

  for (const cl of customLines) {
    if (cl.playerColor !== playerColor) continue;
    candidates.push({
      courseId: 'custom-repertoire',
      variationId: cl.id,
      name: cl.name,
      isCustom: true,
      steps: cl.moves,
    });
  }

  let best: CandidateLine | null = null;
  let bestMatchPlies = 0;

  for (const cand of candidates) {
    let matched = 0;
    while (
      matched < gameSans.length &&
      matched < cand.steps.length &&
      gameSans[matched] === cand.steps[matched]
    ) {
      matched++;
    }
    if (matched > bestMatchPlies) {
      bestMatchPlies = matched;
      best = cand;
    }
  }

  if (!best || bestMatchPlies < 2) return null;

  if (bestMatchPlies >= best.steps.length) {
    return {
      matchedCourseId: best.courseId,
      matchedVariationId: best.variationId,
      matchedLineName: best.name,
      isCustomLine: best.isCustom,
      matchedPlies: bestMatchPlies,
      totalLinePlies: best.steps.length,
      deviatedBy: 'none',
      deviationMoveNumber: Math.ceil(best.steps.length / 2),
      expectedSan: null,
      playedSan: null,
      seedMoves: gameSans.slice(0, Math.min(gameSans.length, 16)),
    };
  }

  const divTurn: PieceColor = bestMatchPlies % 2 === 0 ? 'w' : 'b';
  const deviatedBy = divTurn === playerColor ? 'player' : 'opponent';

  return {
    matchedCourseId: best.courseId,
    matchedVariationId: best.variationId,
    matchedLineName: best.name,
    isCustomLine: best.isCustom,
    matchedPlies: bestMatchPlies,
    totalLinePlies: best.steps.length,
    deviatedBy,
    deviationMoveNumber: Math.floor(bestMatchPlies / 2) + 1,
    expectedSan: best.steps[bestMatchPlies] ?? null,
    playedSan: gameSans[bestMatchPlies] ?? null,
    seedMoves: gameSans.slice(0, Math.min(gameSans.length, bestMatchPlies + 2)),
  };
}
