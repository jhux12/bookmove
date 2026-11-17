import { Chess, Move, PieceSymbol } from 'chess.js';
import { BotProfile, PieceType } from '../types/chess';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables from White's perspective (rank 8 at index 0, rank 1 at index 7)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -22, -22, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 12, 16, 16, 12, 0, -30],
  [-30, 5, 16, 22, 22, 16, 5, -30],
  [-30, 0, 16, 22, 22, 16, 0, -30],
  [-30, 5, 12, 16, 16, 12, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 8, 12, 12, 8, 0, -10],
  [-10, 6, 6, 12, 12, 6, 6, -10],
  [-10, 0, 12, 12, 12, 12, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 6, 0, 0, 0, 0, 6, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [8, 14, 14, 14, 14, 14, 14, 8],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 6, 6, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 6, 6, 6, 6, 0, -10],
  [-5, 0, 6, 6, 6, 6, 0, -5],
  [0, 0, 6, 6, 6, 6, 0, -5],
  [-10, 6, 6, 6, 6, 6, 0, -10],
  [-10, 0, 6, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_MID_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

const KING_END_PST = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10, 0, 0, -10, -20, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -30, 0, 0, 0, 0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50],
];

const PST_MAP: Record<Exclude<PieceSymbol, 'k'>, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
};

/**
 * Static board evaluation in centipawns from White's perspective (+ favors White, - favors Black).
 */
export function evaluateBoardStatic(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99000 : 99000;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  const board = chess.board();
  let totalNonPawnMaterial = 0;
  let score = 0;

  let whiteBishops = 0;
  let blackBishops = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      if (sq.type !== 'p' && sq.type !== 'k') {
        totalNonPawnMaterial += PIECE_VALUES[sq.type];
      }
      if (sq.type === 'b') {
        if (sq.color === 'w') whiteBishops++;
        else blackBishops++;
      }
    }
  }

  const isEndgame = totalNonPawnMaterial <= 2600;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;

      const row = sq.color === 'w' ? r : 7 - r;
      let val = PIECE_VALUES[sq.type];

      if (sq.type === 'k') {
        val += isEndgame ? KING_END_PST[row][c] : KING_MID_PST[row][c];
      } else {
        val += PST_MAP[sq.type][row][c];
      }

      score += sq.color === 'w' ? val : -val;
    }
  }

  // Bishop pair bonus
  if (whiteBishops >= 2) score += 32;
  if (blackBishops >= 2) score -= 32;

  // Small tempo / check bonus
  if (chess.inCheck()) {
    score += chess.turn() === 'w' ? -28 : 28;
  }

  return score;
}

function scoreMoveOrder(move: Move): number {
  let score = 0;
  if (move.captured) {
    score += 10 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece];
  }
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion];
  }
  if (move.san.includes('+')) {
    score += 45;
  }
  if (move.san === 'O-O' || move.san === 'O-O-O') {
    score += 35;
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => scoreMoveOrder(b) - scoreMoveOrder(a));
}

interface SearchContext {
  deadline: number;
  nodes: number;
  aborted: boolean;
}

function quiescence(chess: Chess, alpha: number, beta: number, maximizing: boolean, ctx: SearchContext, qDepth = 0): number {
  ctx.nodes++;
  if ((ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) {
    ctx.aborted = true;
    return evaluateBoardStatic(chess);
  }

  const standPat = evaluateBoardStatic(chess);
  if (qDepth >= 3 || chess.isGameOver()) {
    return standPat;
  }

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const captures = orderMoves(
      chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion)
    );
    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, false, ctx, qDepth + 1);
      chess.undo();
      if (ctx.aborted) return standPat;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;

    const captures = orderMoves(
      chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion)
    );
    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, true, ctx, qDepth + 1);
      chess.undo();
      if (ctx.aborted) return standPat;
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ctx: SearchContext
): number {
  ctx.nodes++;
  if ((ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) {
    ctx.aborted = true;
    return evaluateBoardStatic(chess);
  }

  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      // Prefer faster mates
      return maximizing ? -90000 - depth * 100 : 90000 + depth * 100;
    }
    return 0;
  }

  if (depth <= 0) {
    return quiescence(chess, alpha, beta, maximizing, ctx);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));
  if (moves.length === 0) return 0;

  if (maximizing) {
    let value = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const childScore = alphaBeta(chess, depth - 1, alpha, beta, false, ctx);
      chess.undo();
      if (ctx.aborted) return value === -Infinity ? evaluateBoardStatic(chess) : value;
      if (childScore > value) value = childScore;
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const move of moves) {
      chess.move(move);
      const childScore = alphaBeta(chess, depth - 1, alpha, beta, true, ctx);
      chess.undo();
      if (ctx.aborted) return value === Infinity ? evaluateBoardStatic(chess) : value;
      if (childScore < value) value = childScore;
      if (value < beta) beta = value;
      if (alpha >= beta) break;
    }
    return value;
  }
}

export interface EvaluatedMove {
  move: Move;
  scoreCp: number; // From White's perspective
}

export function getRankedMoves(fen: string, maxDepth = 3, budgetMs = 450): EvaluatedMove[] {
  const chess = new Chess(fen);
  const legalMoves = orderMoves(chess.moves({ verbose: true }));
  if (legalMoves.length === 0) return [];

  const maximizing = chess.turn() === 'w';
  const deadline = performance.now() + budgetMs;
  const ctx: SearchContext = { deadline, nodes: 0, aborted: false };

  let bestResults: EvaluatedMove[] = legalMoves.map((m) => ({ move: m, scoreCp: 0 }));

  // Iterative deepening up to maxDepth within time budget
  for (let d = 1; d <= maxDepth; d++) {
    const currentPass: EvaluatedMove[] = [];
    for (const m of legalMoves) {
      chess.move(m);
      const score = alphaBeta(chess, d - 1, -Infinity, Infinity, !maximizing, ctx);
      chess.undo();
      if (ctx.aborted) break;
      currentPass.push({ move: m, scoreCp: score });
    }
    if (!ctx.aborted && currentPass.length === legalMoves.length) {
      currentPass.sort((a, b) => (maximizing ? b.scoreCp - a.scoreCp : a.scoreCp - b.scoreCp));
      bestResults = currentPass;
      // Re-order root moves for next depth iteration
      legalMoves.splice(0, legalMoves.length, ...currentPass.map((r) => r.move));
      if (Math.abs(bestResults[0].scoreCp) > 85000) break; // Forced mate found
    } else {
      break;
    }
  }

  return bestResults;
}

export function chooseBotMove(fen: string, bot: BotProfile): Move | null {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  // Classical opening book variety on move 1 for intermediate+ bots
  if (chess.history().length === 0 && chess.moveNumber() === 1 && bot.searchDepth >= 2) {
    const preferredOpenings = ['e4', 'd4', 'c4', 'Nf3'];
    const candidates = legalMoves.filter((m) => preferredOpenings.includes(m.san));
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  const ranked = getRankedMoves(fen, bot.searchDepth, bot.searchDepth >= 4 ? 480 : 340);
  if (ranked.length === 0) return legalMoves[0];

  // Intentional beginner/intermediate human-like blunder probability
  if (bot.blunderRate > 0 && Math.random() < bot.blunderRate && ranked.length > 2) {
    const poolEnd = Math.min(ranked.length, Math.max(3, Math.ceil(ranked.length * 0.65)));
    const idx = Math.floor(Math.random() * poolEnd);
    return ranked[idx].move;
  }

  // Add subtle centipawn noise per bot personality
  const isWhite = chess.turn() === 'w';
  if (bot.noiseCp > 0) {
    const noisy = ranked.map((r) => {
      const jitter = (Math.random() - 0.5) * 2 * bot.noiseCp;
      const aggressionBonus =
        bot.aggression > 1 && (r.move.captured || r.move.san.includes('+'))
          ? (isWhite ? 1 : -1) * 18 * (bot.aggression - 1)
          : 0;
      return {
        move: r.move,
        effective: r.scoreCp + jitter + aggressionBonus,
      };
    });
    noisy.sort((a, b) => (isWhite ? b.effective - a.effective : a.effective - b.effective));
    return noisy[0].move;
  }

  return ranked[0].move;
}

export function getPositionEvaluation(fen: string, depth = 2): {
  cp: number;
  display: string;
  whiteAdvantagePct: number;
} {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    const whiteWon = chess.turn() === 'b';
    return {
      cp: whiteWon ? 99000 : -99000,
      display: whiteWon ? '1-0' : '0-1',
      whiteAdvantagePct: whiteWon ? 100 : 0,
    };
  }
  if (chess.isDraw()) {
    return { cp: 0, display: '0.0', whiteAdvantagePct: 50 };
  }

  const ranked = getRankedMoves(fen, depth, 220);
  const cp = ranked.length > 0 ? ranked[0].scoreCp : evaluateBoardStatic(chess);

  // Mate display check
  if (Math.abs(cp) > 80000) {
    const whiteMating = cp > 0;
    const pliesLeft = Math.max(1, Math.round((90000 - Math.abs(cp)) / 100));
    const movesToMate = Math.max(1, Math.ceil(pliesLeft / 2));
    return {
      cp,
      display: `${whiteMating ? '' : '-'}M${movesToMate}`,
      whiteAdvantagePct: whiteMating ? 97 : 3,
    };
  }

  const pawns = cp / 100;
  const clampedPawns = Math.max(-10, Math.min(10, pawns));
  // Smooth sigmoid-like mapping for eval bar visual fill
  const whiteAdvantagePct = 50 + 46 * Math.tanh(clampedPawns / 3.5);
  const sign = pawns > 0.05 ? '+' : '';
  return {
    cp,
    display: `${sign}${pawns.toFixed(1)}`,
    whiteAdvantagePct: Math.max(4, Math.min(96, whiteAdvantagePct)),
  };
}

export function getCapturedPieces(fen: string): {
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  whiteMaterialDiff: number;
} {
  const startingCounts: Record<Exclude<PieceType, 'k'>, number> = {
    q: 1,
    r: 2,
    b: 2,
    n: 2,
    p: 8,
  };
  const currentWhite: Record<Exclude<PieceType, 'k'>, number> = { q: 0, r: 0, b: 0, n: 0, p: 0 };
  const currentBlack: Record<Exclude<PieceType, 'k'>, number> = { q: 0, r: 0, b: 0, n: 0, p: 0 };

  const chess = new Chess(fen);
  const board = chess.board();
  let whitePts = 0;
  let blackPts = 0;
  const pts: Record<Exclude<PieceType, 'k'>, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq || sq.type === 'k') continue;
      if (sq.color === 'w') {
        currentWhite[sq.type]++;
        whitePts += pts[sq.type];
      } else {
        currentBlack[sq.type]++;
        blackPts += pts[sq.type];
      }
    }
  }

  const order: Exclude<PieceType, 'k'>[] = ['q', 'r', 'b', 'n', 'p'];
  const capturedByWhite: PieceType[] = [];
  const capturedByBlack: PieceType[] = [];

  for (const t of order) {
    const missingBlack = Math.max(0, startingCounts[t] - currentBlack[t]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(t);
    const missingWhite = Math.max(0, startingCounts[t] - currentWhite[t]);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(t);
  }

  return {
    capturedByWhite,
    capturedByBlack,
    whiteMaterialDiff: whitePts - blackPts,
  };
}
