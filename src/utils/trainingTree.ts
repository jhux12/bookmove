import { Chess } from 'chess.js';
import { AttackTraining, TrainingBranch, TrainingStep } from '../data/attackTrainings';

export function branchesAtPosition(branches: TrainingBranch[], history: string[]) {
  return branches.filter((b) => history.every((san, i) => b.steps[i]?.san === san));
}
export function trainingChoices(branches: TrainingBranch[], history: string[]): TrainingStep[] {
  const unique = new Map<string, TrainingStep>();
  for (const branch of branchesAtPosition(branches, history)) {
    const step = branch.steps[history.length];
    if (step && !unique.has(step.san)) unique.set(step.san, step);
  }
  return [...unique.values()];
}
export function gameFromTraining(history: string[]) {
  const game = new Chess();
  for (const san of history) game.move(san);
  return game;
}
export function chooseOpponentStep(
  branches: TrainingBranch[],
  history: string[],
  targetId: string
): TrainingStep | null {
  const choices = trainingChoices(branches, history);
  const target = branchesAtPosition(branches, history).find((b) => b.id === targetId)?.steps[
    history.length
  ];
  return target ?? choices[0] ?? null;
}
export function completedTrainingBranch(branches: TrainingBranch[], history: string[]) {
  return (
    branchesAtPosition(branches, history).find((b) => b.steps.length === history.length) ?? null
  );
}
export function trainingPracticeSeed(training: AttackTraining, branch: TrainingBranch) {
  return {
    name: `${training.title} · ${branch.name}`,
    moves: branch.steps.slice(0, branch.practiceFromPly).map((s) => s.san),
    playerColor: training.playerColor,
    summary: branch.lesson,
  };
}
