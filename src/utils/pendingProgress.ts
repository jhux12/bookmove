import { LineProgress } from '../types/chess';
const key = (uid: string) => `checkmate_pending_progress_${uid}`;
export function readPendingProgress(uid: string): Record<string, LineProgress> {
  try {
    const data = JSON.parse(localStorage.getItem(key(uid)) || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}
export function savePendingProgress(uid: string, progress: LineProgress) {
  const pending = readPendingProgress(uid);
  pending[progress.lineId] = progress;
  localStorage.setItem(key(uid), JSON.stringify(pending));
}
export function clearPendingProgress(uid: string, lineId: string) {
  const pending = readPendingProgress(uid);
  delete pending[lineId];
  localStorage.setItem(key(uid), JSON.stringify(pending));
}

export function readPendingGames(uid: string): import('../types/chess').ArchivedGame[] {
  try {
    const data = JSON.parse(localStorage.getItem(`checkmate_pending_games_${uid}`) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
export function writePendingGames(uid: string, games: import('../types/chess').ArchivedGame[]) {
  localStorage.setItem(`checkmate_pending_games_${uid}`, JSON.stringify(games.slice(0, 100)));
}
