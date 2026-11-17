import { doc, Firestore, runTransaction, Timestamp } from 'firebase/firestore';
import { ArchivedGame, CustomOpeningLine, LineProgress } from '../types/chess';
import { parseWeakPlies, serializeWeakPlies } from './weakPlies';

import { mergeGuestProgress } from './mergeProgress';
export { mergeGuestProgress } from './mergeProgress';

const safeDate = (iso: string) => {
  const ms = Date.parse(iso);
  return Timestamp.fromMillis(Number.isFinite(ms) ? Math.min(ms, Date.now()) : Date.now());
};
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,64}$/.test(id);
export async function migrateGuestWork(
  db: Firestore,
  uid: string,
  progress: Record<string, LineProgress>,
  custom: CustomOpeningLine[],
  games: ArchivedGame[]
) {
  for (const [id, guest] of Object.entries(progress)) {
    if (!validId(id)) continue;
    const ref = doc(db, 'users', uid, 'lineProgress', id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data();
      const cloud = d
        ? ({
            ...d,
            weakPlies: parseWeakPlies(d.weakPlies),
            lastPracticedAt: d.lastPracticedAt?.toDate().toISOString(),
          } as LineProgress)
        : undefined;
      const merged = mergeGuestProgress(guest, cloud);
      if (cloud && merged === cloud) return;
      const { attempts, mistakes, streak, masteryPct, nextReviewMs } = merged;
      tx.set(ref, {
        userId: uid,
        courseId: guest.courseId,
        lineId: id,
        attempts,
        mistakes,
        streak,
        masteryPct,
        nextReviewMs,
        weakPlies: serializeWeakPlies(merged.weakPlies ?? {}),
        lastPracticedAt: safeDate(merged.lastPracticedAt),
      });
    });
  }
  for (const line of custom) {
    if (!validId(line.id)) continue;
    const ref = doc(db, 'users', uid, 'customLines', line.id);
    await runTransaction(db, async (tx) => {
      if (!(await tx.get(ref)).exists())
        tx.set(ref, {
          userId: uid,
          name: line.name,
          playerColor: line.playerColor,
          moves: line.moves,
          notes: line.notes,
          createdAt: safeDate(line.createdAt),
        });
    });
  }
  for (const game of games.slice(0, 100)) {
    if (!validId(game.id)) continue;
    const ref = doc(db, 'users', uid, 'games', game.id);
    await runTransaction(db, async (tx) => {
      if (!(await tx.get(ref)).exists()) {
        const {
          botId,
          botName,
          botElo,
          playerColor,
          result,
          termination,
          openingName,
          moveCount,
          pgn,
          assistMode,
          timeControlLabel,
        } = game;
        tx.set(ref, {
          userId: uid,
          botId,
          botName,
          botElo,
          playerColor,
          result,
          termination,
          openingName,
          moveCount,
          pgn,
          assistMode,
          timeControlLabel,
          playedAt: safeDate(game.playedAt),
        });
      }
    });
  }
}
