import { Chess } from 'chess.js';
import { AssistMode, MoveRecord, PieceColor, TimeControl } from '../types/chess';
import { BOTS } from '../data/bots';

export const GAME_SESSION_KEY = 'checkmate_active_game_v1';
export interface GameSession {
  version: 1;
  id: string;
  pgn: string;
  botId: string;
  playerColor: PieceColor;
  orientation: PieceColor;
  assistMode: AssistMode;
  timeControl: TimeControl;
  whiteClock: number | null;
  blackClock: number | null;
}
export function readGameSession(): GameSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(GAME_SESSION_KEY) || 'null');
    if (
      !s ||
      s.version !== 1 ||
      typeof s.id !== 'string' ||
      typeof s.pgn !== 'string' ||
      s.pgn.length > 20000 ||
      !BOTS.some((b) => b.id === s.botId)
    )
      return null;
    if (
      !['w', 'b'].includes(s.playerColor) ||
      !['w', 'b'].includes(s.orientation) ||
      !['challenge', 'friendly', 'coach'].includes(s.assistMode)
    )
      return null;
    if (
      !s.timeControl ||
      !Number.isFinite(s.timeControl.initialSeconds) ||
      !Number.isFinite(s.timeControl.incrementSeconds)
    )
      return null;
    if (![s.whiteClock, s.blackClock].every((t) => t === null || (Number.isFinite(t) && t >= 0)))
      return null;
    const chess = new Chess();
    chess.loadPgn(s.pgn);
    if (chess.isGameOver()) return null;
    return s;
  } catch {
    return null;
  }
}
export function recordsFromGame(chess: Chess): MoveRecord[] {
  return chess
    .history({ verbose: true })
    .map((m) => ({
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color,
      fen: m.after,
      ...(m.captured ? { captured: m.captured } : {}),
      ...(m.promotion ? { promotion: m.promotion } : {}),
    }));
}
