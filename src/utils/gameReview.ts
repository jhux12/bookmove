import { Chess } from 'chess.js';
import { OPENING_COURSES } from '../data/openingCourses';
import { getRankedMoves } from '../engine/chessAI';
import { ArchivedGame, CustomOpeningLine, PieceColor } from '../types/chess';
import { detectOpening } from './openings';

export type MoveClassification =
  | 'book'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface MoveReviewItem {
  ply: number; // 1-indexed
  san: string;
  from: string;
  to: string;
  color: PieceColor;
  fenBefore: string;
  fenAfter: string;
  classification: MoveClassification;
  headline: string;
  comment: string;
  evalDisplay: string;
  whiteAdvantagePct: number;
  cpAfter: number;
  bestSan: string;
  bestFrom: string;
  bestTo: string;
}

export interface SideSummary {
  accuracy: number;
  counts: Record<MoveClassification, number>;
}

export interface FullGameReview {
  items: MoveReviewItem[];
  white: SideSummary;
  black: SideSummary;
  bookPlies: number;
}

function cpToEvalMeta(cp: number, fenAfter: string): {
  evalDisplay: string;
  whiteAdvantagePct: number;
} {
  try {
    const g = new Chess(fenAfter);
    if (g.isCheckmate()) {
      const whiteWon = g.turn() === 'b';
      return {
        evalDisplay: whiteWon ? '1-0' : '0-1',
        whiteAdvantagePct: whiteWon ? 100 : 0,
      };
    }
    if (g.isDraw() || g.isStalemate()) {
      return { evalDisplay: '0.00', whiteAdvantagePct: 50 };
    }
  } catch {
    // Fallback to cp
  }

  if (Math.abs(cp) > 80000) {
    const whiteMating = cp > 0;
    const pliesLeft = Math.max(1, Math.round((90000 - Math.abs(cp)) / 100));
    const movesToMate = Math.max(1, Math.ceil(pliesLeft / 2));
    return {
      evalDisplay: `${whiteMating ? '' : '-'}M${movesToMate}`,
      whiteAdvantagePct: whiteMating ? 97 : 3,
    };
  }

  const pawns = cp / 100;
  const clamped = Math.max(-10, Math.min(10, pawns));
  const whiteAdvantagePct = Math.max(4, Math.min(96, 50 + 46 * Math.tanh(clamped / 3.5)));
  const sign = pawns > 0.01 ? '+' : '';
  return {
    evalDisplay: `${sign}${pawns.toFixed(2)}`,
    whiteAdvantagePct,
  };
}

function getCourseStepNote(sans: string[]): { note?: string; courseName?: string } | null {
  let bestLen = 0;
  let result: { note?: string; courseName?: string } | null = null;
  for (const c of OPENING_COURSES) {
    for (const v of c.variations) {
      if (sans.length > v.steps.length) continue;
      let match = true;
      for (let i = 0; i < sans.length; i++) {
        if (v.steps[i].san !== sans[i]) {
          match = false;
          break;
        }
      }
      if (match && v.steps.length >= bestLen) {
        bestLen = v.steps.length;
        const step = v.steps[sans.length - 1];
        result = {
          note: step?.note,
          courseName: `${c.title.split(':')[0]} (${v.name})`,
        };
      }
    }
  }
  return result;
}

function computeBookDepth(sans: string[], customLines: CustomOpeningLine[]): number {
  let maxDepth = 0;

  for (const c of OPENING_COURSES) {
    for (const v of c.variations) {
      let i = 0;
      while (i < sans.length && i < v.steps.length && sans[i] === v.steps[i].san) {
        i++;
      }
      if (i > maxDepth) maxDepth = i;
    }
  }

  for (const cl of customLines) {
    let i = 0;
    while (i < sans.length && i < cl.moves.length && sans[i] === cl.moves[i]) {
      i++;
    }
    if (i > maxDepth) maxDepth = i;
  }

  // Fallback to standard opening book detection up to 10 plies
  for (let len = Math.min(sans.length, 10); len > maxDepth; len--) {
    const label = detectOpening(sans.slice(0, len));
    if (label && label !== 'Custom Opening' && label !== 'Starting Position') {
      maxDepth = Math.max(maxDepth, len);
      break;
    }
  }

  return maxDepth;
}

function buildMoveComment(
  san: string,
  bestSan: string,
  classification: MoveClassification,
  cpLoss: number,
  fenAfter: string,
  bookInfo: { note?: string; courseName?: string } | null,
  openingTitle: string
): { headline: string; comment: string } {
  const isMate = san.includes('#');
  const isCheck = !isMate && san.includes('+');
  const isCastle = san === 'O-O' || san === 'O-O-O';
  const isCapture = san.includes('x');

  if (isMate) {
    return {
      headline: `${san} is checkmate`,
      comment: 'Checkmate! A clean finishing blow to wrap up the game.',
    };
  }

  if (classification === 'book') {
    if (bookInfo?.note) {
      return {
        headline: `${san} is a book move`,
        comment: bookInfo.note,
      };
    }
    if (san === 'e4') {
      return {
        headline: `${san} is a book move`,
        comment: 'The most popular opening move in chess — claims the center and frees both your queen and bishop.',
      };
    }
    if (san === 'd4') {
      return {
        headline: `${san} is a book move`,
        comment: 'Controls central dark squares immediately while keeping your queen protected along the d-file.',
      };
    }
    return {
      headline: `${san} is a book move`,
      comment: `Sound opening theory in the ${openingTitle}, developing pieces toward the center.`,
    };
  }

  if (classification === 'best') {
    if (isCastle) {
      return {
        headline: `${san} is best`,
        comment: 'Tucks your king safely away and brings your rook into active duty.',
      };
    }
    if (isCheck) {
      return {
        headline: `${san} is best`,
        comment: 'Finds the strongest move — delivers check while seizing the initiative.',
      };
    }
    if (isCapture) {
      return {
        headline: `${san} is best`,
        comment: 'The cleanest tactical choice, capturing accurately and maintaining control.',
      };
    }
    return {
      headline: `${san} is best`,
      comment: 'Top engine choice here — improves piece coordination and keeps the position balanced.',
    };
  }

  if (classification === 'excellent' || classification === 'good') {
    return {
      headline: classification === 'excellent' ? `${san} is excellent` : `${san} is good`,
      comment:
        bestSan && bestSan !== san
          ? `A solid, practical move. ${bestSan} was slightly sharper, but your position remains in great shape.`
          : 'A sensible developing move that keeps your pieces working together.',
    };
  }

  if (classification === 'inaccuracy') {
    return {
      headline: `${san} is an inaccuracy`,
      comment:
        bestSan && bestSan !== san
          ? `Gives up a slight edge. ${bestSan} kept stronger central control — tap Show to preview it.`
          : 'Slightly imprecise, letting the opponent equalize more easily.',
    };
  }

  if (classification === 'mistake') {
    const pawns = (cpLoss / 100).toFixed(1);
    return {
      headline: `${san} is a mistake`,
      comment:
        bestSan && bestSan !== san
          ? `Dropped roughly ${pawns} pawns of advantage. Playing ${bestSan} was much stronger here.`
          : `Dropped roughly ${pawns} pawns of advantage and loosened key squares.`,
    };
  }

  return {
    headline: `${san} is a blunder`,
    comment:
      bestSan && bestSan !== san
        ? `A critical tactical slip that swings the game. ${bestSan} kept you in the fight — tap Show to see why.`
        : 'A decisive blunder that hands over material or king safety.',
  };
}

function emptyCounts(): Record<MoveClassification, number> {
  return {
    book: 0,
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
}

export function analyzeMatchMoves(
  game: ArchivedGame,
  customLines: CustomOpeningLine[]
): FullGameReview {
  const sans = game.moves.map((m) => m.san);
  const bookPlies = computeBookDepth(sans, customLines);

  const items: MoveReviewItem[] = [];
  const whiteCounts = emptyCounts();
  const blackCounts = emptyCounts();
  let whitePenalty = 0;
  let whiteScored = 0;
  let blackPenalty = 0;
  let blackScored = 0;

  const replay = new Chess();

  for (let i = 0; i < game.moves.length; i++) {
    const m = game.moves[i];
    const fenBefore = replay.fen();
    const mover = m.color;

    // Fast bounded search (depth 1 + quiescence ~2ms/move) for responsive instant review
    const rankedBefore = getRankedMoves(fenBefore, 1, 22);
    const bestEntry = rankedBefore[0];
    const bestSan = bestEntry ? bestEntry.move.san : m.san;
    const bestFrom = bestEntry ? bestEntry.move.from : m.from;
    const bestTo = bestEntry ? bestEntry.move.to : m.to;
    const bestCpBefore = bestEntry ? bestEntry.scoreCp : 0;

    let playedCp = bestCpBefore;
    const playedEntry = rankedBefore.find((r) => r.move.san === m.san);
    if (playedEntry) {
      playedCp = playedEntry.scoreCp;
    }

    try {
      replay.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
    } catch {
      replay.move(m.san);
    }
    const fenAfter = m.fen || replay.fen();

    const rawLoss = mover === 'w' ? bestCpBefore - playedCp : playedCp - bestCpBefore;
    const cpLoss = Math.max(0, rawLoss);

    let classification: MoveClassification;
    if (i < bookPlies) {
      classification = 'book';
    } else if (m.san.includes('#') || m.san === bestSan || cpLoss <= 15) {
      classification = 'best';
    } else if (cpLoss <= 45) {
      classification = 'excellent';
    } else if (cpLoss <= 85) {
      classification = 'good';
    } else if (cpLoss <= 145) {
      classification = 'inaccuracy';
    } else if (cpLoss <= 270) {
      classification = 'mistake';
    } else {
      classification = 'blunder';
    }

    if (mover === 'w') {
      whiteCounts[classification]++;
      if (classification !== 'book') {
        whitePenalty += Math.min(350, cpLoss);
        whiteScored++;
      }
    } else {
      blackCounts[classification]++;
      if (classification !== 'book') {
        blackPenalty += Math.min(350, cpLoss);
        blackScored++;
      }
    }

    const prefixSans = sans.slice(0, i + 1);
    const bookInfo = classification === 'book' ? getCourseStepNote(prefixSans) : null;
    const openingTitle = detectOpening(prefixSans);
    const { headline, comment } = buildMoveComment(
      m.san,
      bestSan,
      classification,
      cpLoss,
      fenAfter,
      bookInfo,
      openingTitle
    );

    const { evalDisplay, whiteAdvantagePct } = cpToEvalMeta(playedCp, fenAfter);

    items.push({
      ply: i + 1,
      san: m.san,
      from: m.from,
      to: m.to,
      color: mover,
      fenBefore,
      fenAfter,
      classification,
      headline,
      comment,
      evalDisplay,
      whiteAdvantagePct,
      cpAfter: playedCp,
      bestSan,
      bestFrom,
      bestTo,
    });
  }

  const calcAccuracy = (penalty: number, count: number): number => {
    if (count === 0) return 99;
    const avgLoss = penalty / count;
    return Math.round(Math.max(28, Math.min(99, 100 - avgLoss * 0.24)));
  };

  return {
    items,
    white: {
      accuracy: calcAccuracy(whitePenalty, whiteScored),
      counts: whiteCounts,
    },
    black: {
      accuracy: calcAccuracy(blackPenalty, blackScored),
      counts: blackCounts,
    },
    bookPlies,
  };
}

/**
 * Generates a 1-to-2 move preview from fenBefore showing the engine's recommended best move + reply.
 */
export function computeBestContinuationPreview(fenBefore: string): {
  fenAfterBest: string;
  bestMove: { from: string; to: string; san: string };
  replyMove: { from: string; to: string; san: string } | null;
} | null {
  try {
    const ranked = getRankedMoves(fenBefore, 2, 140);
    if (ranked.length === 0) return null;
    const g = new Chess(fenBefore);
    const best = g.move(ranked[0].move.san);
    if (!best) return null;

    let replyMove: { from: string; to: string; san: string } | null = null;
    if (!g.isGameOver()) {
      const replyRanked = getRankedMoves(g.fen(), 1, 70);
      if (replyRanked.length > 0) {
        const rep = g.move(replyRanked[0].move.san);
        if (rep) replyMove = { from: rep.from, to: rep.to, san: rep.san };
      }
    }

    return {
      fenAfterBest: g.fen(),
      bestMove: { from: best.from, to: best.to, san: best.san },
      replyMove,
    };
  } catch {
    return null;
  }
}
