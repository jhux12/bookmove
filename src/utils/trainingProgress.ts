import { ATTACK_TRAININGS, AttackTraining } from '../data/attackTrainings';
export const TRAINING_PROGRESS_KEY = 'checkmate_attack_training_progress_v1';
export interface ResponseProgress {
  guided: boolean;
  tested: boolean;
  attempts: number;
  lastMistakes: number;
  lastUsedHint: boolean;
}
export type TrainingProgress = Record<string, Record<string, ResponseProgress>>;
export function readTrainingProgress(): TrainingProgress {
  try {
    const raw = JSON.parse(localStorage.getItem(TRAINING_PROGRESS_KEY) || '{}');
    const result: TrainingProgress = {};
    for (const training of ATTACK_TRAININGS)
      for (const branch of training.branches) {
        const value = raw?.[training.id]?.[branch.id];
        if (!value || typeof value !== 'object') continue;
        result[training.id] ??= {};
        result[training.id][branch.id] = {
          guided: value.guided === true,
          tested: value.tested === true,
          attempts:
            Number.isSafeInteger(value.attempts) && value.attempts >= 0 ? value.attempts : 0,
          lastMistakes:
            Number.isSafeInteger(value.lastMistakes) && value.lastMistakes >= 0
              ? value.lastMistakes
              : 0,
          lastUsedHint: value.lastUsedHint === true,
        };
      }
    return result;
  } catch {
    return {};
  }
}
export function mergeTrainingProgress(
  memory: TrainingProgress,
  disk: TrainingProgress
): TrainingProgress {
  const merged: TrainingProgress = { ...disk };
  for (const [trainingId, responses] of Object.entries(memory))
    for (const [branchId, row] of Object.entries(responses)) {
      const saved = disk[trainingId]?.[branchId];
      merged[trainingId] = {
        ...merged[trainingId],
        [branchId]: {
          ...(!saved || row.attempts > saved.attempts ? row : saved),
          guided: row.guided || saved?.guided === true,
          tested: row.tested || saved?.tested === true,
          attempts: Math.max(row.attempts, saved?.attempts ?? 0),
        },
      };
    }
  return merged;
}
export function recordTrainingResponse(
  progress: TrainingProgress,
  trainingId: string,
  branchId: string,
  mode: 'learn' | 'test',
  mistakes: number,
  usedHint: boolean
): TrainingProgress {
  const previous = progress[trainingId]?.[branchId];
  return {
    ...progress,
    [trainingId]: {
      ...progress[trainingId],
      [branchId]: {
        guided: previous?.guided === true || mode === 'learn',
        tested: previous?.tested === true || (mode === 'test' && mistakes === 0 && !usedHint),
        attempts: (previous?.attempts ?? 0) + (mode === 'test' ? 1 : 0),
        lastMistakes: mistakes,
        lastUsedHint: usedHint,
      },
    },
  };
}
// Prioritize unseen responses, then the least-practiced response. Ties are
// shuffled and the previous branch is avoided when another choice is available.
export function chooseTrainingResponse(
  training: AttackTraining,
  progress: TrainingProgress,
  previousId?: string,
  random: () => number = Math.random
) {
  const status = progress[training.id] ?? {};
  const unpassed = training.branches.filter((b) => !status[b.id]?.tested);
  const candidates = unpassed.length ? unpassed : training.branches;
  const alternate = candidates.filter((b) => b.id !== previousId);
  const pool = alternate.length ? alternate : candidates;
  const least = Math.min(...pool.map((b) => status[b.id]?.attempts ?? 0));
  const ties = pool.filter((b) => (status[b.id]?.attempts ?? 0) === least);
  return ties[Math.min(ties.length - 1, Math.floor(random() * ties.length))];
}
