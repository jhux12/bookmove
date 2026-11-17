import { chooseBotMove } from './chessAI';
import { BotProfile } from '../types/chess';
self.onmessage = ({ data }: MessageEvent<{ fen: string; bot: BotProfile }>) => {
  try {
    const move = chooseBotMove(data.fen, data.bot);
    self.postMessage({
      move: move ? { from: move.from, to: move.to, promotion: move.promotion } : null,
    });
  } catch {
    self.postMessage({ error: 'Could not calculate a move. Please try again.' });
  }
};
