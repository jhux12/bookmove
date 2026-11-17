import { test, expect, Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { ATTACK_TRAININGS, AttackTraining, TrainingBranch } from '../../src/data/attackTrainings';
import { TRAINING_PROGRESS_KEY } from '../../src/utils/trainingProgress';
import { TIME_CONTROLS } from '../../src/data/themes';
const square = (p: Page, s: string) => p.locator(`[data-square="${s}"]:visible`);
const nav = (p: Page, name: string) =>
  p.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
async function openTraining(p: Page, t: AttackTraining) {
  await p.goto('/');
  await nav(p, 'Attacks').click();
  await p.getByRole('button', { name: `Open ${t.title} training`, exact: true }).click();
}
async function playResponse(p: Page, t: AttackTraining, b: TrainingBranch) {
  const game = new Chess();
  for (let i = 0; i < b.steps.length; i++) {
    const learner = game.turn() === t.playerColor;
    const move = game.move(b.steps[i].san);
    if (learner) {
      await expect(p.getByText(`Move ${i}`, { exact: true })).toBeVisible();
      await square(p, move.from).click();
      await square(p, move.to).click();
    }
    await expect(p.getByText(`Move ${i + 1}`, { exact: true })).toBeVisible();
  }
}

test.describe('all standalone response paths', () => {
  test.describe.configure({ mode: 'parallel' });
  for (const training of ATTACK_TRAININGS)
    for (const branch of training.branches)
      test(`${training.title}: mixed test adapts to ${branch.id}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        // Make this the only unpassed response so the coverage scheduler selects it.
        await page.addInitScript(
          ({ key, t, id }) => {
            const responses = Object.fromEntries(
              t.branches.map((b) => [
                b.id,
                {
                  guided: false,
                  tested: b.id !== id,
                  attempts: 0,
                  lastMistakes: 0,
                  lastUsedHint: false,
                },
              ])
            );
            localStorage.setItem(key, JSON.stringify({ [t.id]: responses }));
          },
          { key: TRAINING_PROGRESS_KEY, t: training, id: branch.id }
        );
        await openTraining(page, training);
        await page.getByRole('button', { name: 'Mixed response test', exact: true }).click();
        await playResponse(page, training, branch);
        await expect(
          page.getByRole('dialog', { name: 'Clean test passed', exact: true })
        ).toBeVisible();
        expect(
          await page.evaluate(
            ({ key, t, id }) => JSON.parse(localStorage.getItem(key)!)[t][id].tested,
            { key: TRAINING_PROGRESS_KEY, t: training.id, id: branch.id }
          )
        ).toBe(true);
        expect(errors).toEqual([]);
      });
});
test('a legal wrong move is rejected and a hint prevents clean-test credit', async ({ page }) => {
  const t = ATTACK_TRAININGS[0],
    b = t.branches[0];
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await openTraining(page, t);
  await page.getByRole('button', { name: 'Mixed response test', exact: true }).click();
  await square(page, 'a2').click();
  await square(page, 'a3').click();
  await expect(page.getByText('Move 0', { exact: true })).toBeVisible();
  await expect(page.getByText(/That move is legal, but it is outside/)).toBeVisible();
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await playResponse(page, t, b);
  await expect(page.getByRole('dialog', { name: 'Response completed', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!)['fried-liver'].accepted,
      TRAINING_PROGRESS_KEY
    )
  ).toMatchObject({ tested: false, lastMistakes: 1, lastUsedHint: true });
});
test('guided completion is separate from recall credit and survives refresh', async ({ page }) => {
  const t = ATTACK_TRAININGS[3],
    b = t.branches[1];
  await openTraining(page, t);
  await page.getByRole('button', { name: 'Learn this response', exact: true }).nth(1).click();
  await playResponse(page, t, b);
  await expect(page.getByRole('dialog', { name: 'Response learned', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: `Open ${t.title} training`, exact: true }).click();
  await expect(page.getByText('Guided complete', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!)['legals-mate']['knight-captured'],
      TRAINING_PROGRESS_KEY
    )
  ).toMatchObject({ guided: true, tested: false });
});
test('training bot practice preserves an unfinished game until replacement is confirmed', async ({
  page,
}) => {
  const saved = {
    version: 1,
    id: 'existing-game',
    pgn: '1. e4 e5',
    botId: 'clara',
    playerColor: 'w',
    orientation: 'w',
    assistMode: 'friendly',
    timeControl: TIME_CONTROLS[0],
    whiteClock: null,
    blackClock: null,
  };
  await page.addInitScript((s) => {
    localStorage.setItem('checkmate_active_game_v1', JSON.stringify(s));
  }, saved);
  const t = ATTACK_TRAININGS[3];
  await openTraining(page, t);
  await page.getByRole('button', { name: 'Practice position vs bot', exact: true }).first().click();
  const confirm = page.getByRole('dialog', { name: 'Replace your saved game?', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep current game' }).click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('checkmate_active_game_v1')!).id)
  ).toBe('existing-game');
  await page.getByRole('button', { name: 'Practice position vs bot', exact: true }).first().click();
  await confirm.getByRole('button', { name: 'Replace game and practice' }).click();
  await expect(page.getByText(/Sparring Line:/)).toBeVisible();
  await page.getByRole('button', { name: 'Play Clara', exact: true }).click();
  const pgn = await page.evaluate(
    () => JSON.parse(localStorage.getItem('checkmate_active_game_v1')!).pgn
  );
  const g = new Chess();
  g.loadPgn(pgn);
  expect(g.history()).toEqual(
    t.branches[0].steps.slice(0, t.branches[0].practiceFromPly).map((s) => s.san)
  );
});
test('training catalog, overview and coach stage fit a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openTraining(page, ATTACK_TRAININGS[2]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Start guided lesson', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Chess coach', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
