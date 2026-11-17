import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { ATTACK_TRAININGS } from '../src/data/attackTrainings';
import {
  branchesAtPosition,
  chooseOpponentStep,
  completedTrainingBranch,
  gameFromTraining,
  trainingChoices,
  trainingPracticeSeed,
} from '../src/utils/trainingTree';
import {
  chooseTrainingResponse,
  mergeTrainingProgress,
  recordTrainingResponse,
} from '../src/utils/trainingProgress';

test('all five trainings have four legal, distinct responses and useful bot practice positions', () => {
  assert.equal(ATTACK_TRAININGS.length, 5);
  const ids = new Set<string>();
  for (const training of ATTACK_TRAININGS) {
    assert.equal(training.branches.length, 4);
    assert.ok(!ids.has(training.id));
    ids.add(training.id);
    const sequences = new Set<string>();
    for (const branch of training.branches) {
      const game = new Chess();
      for (const step of branch.steps) {
        assert.ok(step.note.length > 10);
        assert.ok(game.move(step.san), `${training.id}/${branch.id}/${step.san}`);
      }
      const sequence = game.history().join(' ');
      assert.ok(!sequences.has(sequence));
      sequences.add(sequence);
      assert.equal(completedTrainingBranch(training.branches, game.history())?.id, branch.id);
      const seed = trainingPracticeSeed(training, branch);
      const start = gameFromTraining(seed.moves);
      assert.ok(seed.moves.length < branch.steps.length);
      assert.equal(start.isGameOver(), false);
      assert.equal(
        start.turn(),
        training.playerColor,
        `${training.id}/${branch.id} practice starts on learner's turn`
      );
    }
  }
});
test('every mixed-test path accepts its learner moves and selects the intended opponent response', () => {
  for (const training of ATTACK_TRAININGS)
    for (const branch of training.branches) {
      const history: string[] = [];
      const game = new Chess();
      for (const step of branch.steps) {
        assert.ok(trainingChoices(training.branches, history).some((s) => s.san === step.san));
        if (game.turn() !== training.playerColor)
          assert.equal(chooseOpponentStep(training.branches, history, branch.id)?.san, step.san);
        game.move(step.san);
        history.push(step.san);
      }
      assert.equal(completedTrainingBranch(training.branches, history)?.id, branch.id);
    }
});
test('different opponent replies produce different plans instead of forcing one trap', () => {
  const training = ATTACK_TRAININGS[0];
  const prefix = 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5'.split(' ');
  assert.deepEqual(
    new Set(trainingChoices(training.branches, prefix).map((s) => s.san)),
    new Set(['Nxd5', 'Na5', 'Nd4'])
  );
  assert.deepEqual(
    trainingChoices(training.branches, [...prefix, 'Nxd5']).map((s) => s.san),
    ['Nxf7']
  );
  assert.deepEqual(
    trainingChoices(training.branches, [...prefix, 'Na5']).map((s) => s.san),
    ['Bb5+']
  );
  assert.deepEqual(
    trainingChoices(training.branches, [...prefix, 'Nd4']).map((s) => s.san),
    ['c3']
  );
  assert.equal(branchesAtPosition(training.branches, [...prefix, 'Na5']).length, 1);
});
test('Legal’s Mate really mates, and the Scholar’s Mate warning has a mating reply', () => {
  const legal = ATTACK_TRAININGS.find((t) => t.id === 'legals-mate')!;
  assert.equal(gameFromTraining(legal.branches[0].steps.map((s) => s.san)).isCheckmate(), true);
  const scholar = gameFromTraining('e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#'.split(' '));
  assert.equal(scholar.isCheckmate(), true);
});
test('hints, mistakes and guided runs cannot earn a clean test pass; progress is independent', () => {
  let p = recordTrainingResponse({}, 'fried-liver', 'accepted', 'learn', 0, false);
  assert.equal(p['fried-liver'].accepted.tested, false);
  p = recordTrainingResponse(p, 'fried-liver', 'accepted', 'test', 0, true);
  assert.equal(p['fried-liver'].accepted.tested, false);
  p = recordTrainingResponse(p, 'fried-liver', 'accepted', 'test', 1, false);
  assert.equal(p['fried-liver'].accepted.tested, false);
  p = recordTrainingResponse(p, 'fried-liver', 'accepted', 'test', 0, false);
  assert.equal(p['fried-liver'].accepted.tested, true);
  p = recordTrainingResponse(p, 'evans-gambit', 'declined', 'test', 0, false);
  assert.equal(p['evans-gambit'].declined.tested, true);
  assert.equal(p['fried-liver'].accepted.tested, true);
  const training = ATTACK_TRAININGS[0];
  assert.notEqual(chooseTrainingResponse(training, p, 'accepted', () => 0).id, 'accepted');
});

test('merging browser progress preserves independently completed responses', () => {
  const memory = recordTrainingResponse({}, 'fried-liver', 'accepted', 'test', 0, false);
  const disk = recordTrainingResponse({}, 'fried-liver', 'polerio', 'learn', 0, false);
  const merged = mergeTrainingProgress(memory, disk);
  assert.equal(merged['fried-liver'].accepted.tested, true);
  assert.equal(merged['fried-liver'].polerio.guided, true);
});
