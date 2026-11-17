import { Chess } from 'chess.js';
import { TIME_CONTROLS } from '../../src/data/themes';
import { test, expect, Page } from '@playwright/test';
const square = (p: Page, s: string) => p.locator(`[data-square="${s}"]:visible`);
const nav = (p: Page, name: string) =>
  p.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
for (const width of [320, 390])
  test(`mobile setup has a reachable start action at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await nav(page, 'Play Bots').click();
    await expect(page.getByRole('button', { name: 'Play Clara', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
test('keyboard-only piece movement advances a lesson and leaves the board fixed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Start free lesson', exact: true }).click();
  const before = await square(page, 'a8').boundingBox();
  await square(page, 'e2').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Move 0 / 13', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Move 2 / 13', { exact: true })).toBeVisible();
  const after = await square(page, 'a8').boundingBox();
  expect(after!.y).toBeCloseTo(before!.y, 0);
  await expect(page.getByRole('img', { name: 'Chess coach', exact: true })).toBeVisible();
});
test('depth selection is cumulative, persisted, and accessible', async ({ page }) => {
  await nav(page, 'Account').click();
  await page.getByRole('button', { name: 'Explore full demo — free', exact: true }).click();
  const card = page.getByRole('button', {
    name: 'Italian Game: Giuoco Piano & Attacks',
    exact: true,
  });
  await card.click();
  const dialog = page.getByRole('dialog', { name: 'Choose your course depth' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio').nth(2).check();
  await dialog.getByRole('button', { name: 'Continue with Full Repertoire', exact: true }).click();
  await page.getByRole('button', { name: 'Change course depth' }).click();
  await expect(page.getByRole('radio').nth(2)).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('checkmate_course_depths_v1')!)['course-italian']
    )
  ).toBe('full');
});
test('completion dialog fits mobile, traps focus, and closes on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Start free lesson', exact: true }).click();
  await page.getByRole('button', { name: '2. Test', exact: true }).click();
  for (const [from, to] of [
    ['e2', 'e4'],
    ['g1', 'f3'],
    ['f1', 'c4'],
    ['c2', 'c3'],
    ['d2', 'd4'],
    ['c3', 'd4'],
    ['c1', 'd2'],
  ]) {
    await square(page, from).click();
    await square(page, to).click();
    // Wait for the opponent's automatic lesson reply before the next player move.
    await page.waitForTimeout(800);
  }
  const dialog = page.getByRole('dialog', { name: 'Line learned!', exact: true });
  await expect(dialog).toBeVisible();
  expect(
    await dialog
      .locator('button')
      .evaluateAll((bs) => bs.every((b) => b.scrollWidth <= b.clientWidth + 1))
  ).toBe(true);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});
test('unfinished game restores history and requires confirmation to discard', async ({ page }) => {
  await nav(page, 'Play Bots').click();
  await page.getByRole('button', { name: 'Play Clara', exact: true }).click();
  await square(page, 'e2').click();
  await square(page, 'e4').click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('checkmate_active_game_v1') || 'null');
        return s?.pgn?.includes('e4');
      })
    )
    .toBe(true);
  await page.reload();
  const resume = page.getByRole('dialog', { name: 'Resume your game' });
  await expect(resume).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(resume).not.toBeVisible();
  await page.getByRole('button', { name: 'Play Clara', exact: true }).click();
  await expect(resume).toBeVisible();
  await resume.getByRole('button', { name: 'Resume game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const pgn = await page.evaluate(
        () => JSON.parse(localStorage.getItem('checkmate_active_game_v1')!).pgn
      );
      const g = new Chess();
      g.loadPgn(pgn);
      return g.history().length;
    })
    .toBe(2);
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('checkmate_active_game_v1')!)
            .pgn.split(/\s/)
            .filter((s: string) => s === 'e4').length
      )
    )
    .toBe(1);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Start a new game?', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Discard game', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play Clara', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('checkmate_active_game_v1'))).toBeNull();
});
test('account explains demo access without presenting a simulated purchase', async ({ page }) => {
  await nav(page, 'Account').click();
  await expect(
    page.getByText('There is no checkout, subscription, or charge in this release.', {
      exact: false,
    })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore full demo — free', exact: true }).click();
  await nav(page, 'Account').click();
  await expect(page.getByRole('button', { name: 'End demo access' })).toBeVisible();
  await page.getByRole('button', { name: 'End demo access' }).click();
  await expect(page.getByRole('button', { name: 'Explore full demo — free' })).toBeVisible();
});

test('desktop coaching stays beside the board through move navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Start free lesson', exact: true }).click();
  const board = page.locator('[role=group][aria-label^=Chessboard]:visible');
  const initial = await board.boundingBox();
  const coach = await page.getByRole('region', { name: 'Coach feedback' }).boundingBox();
  expect(coach!.x).toBeGreaterThan(initial!.x + initial!.width);
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    const next = await board.boundingBox();
    expect(next!.y).toBeCloseTo(initial!.y, 0);
    expect(next!.width).toBeCloseTo(initial!.width, 0);
  }
});
test('promotion can be completed from the keyboard in a restored game', async ({ page }) => {
  const g = new Chess();
  for (const m of ['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2']) g.move(m);
  await page.evaluate(
    (s) => {
      localStorage.setItem('checkmate_active_game_v1', JSON.stringify(s));
      sessionStorage.setItem('checkmate_tab', 'play');
    },
    {
      version: 1,
      id: 'promotion-fixture',
      pgn: g.pgn(),
      botId: 'clara',
      playerColor: 'w',
      orientation: 'w',
      assistMode: 'friendly',
      timeControl: TIME_CONTROLS[0],
      whiteClock: null,
      blackClock: null,
    }
  );
  await page.reload();
  await page.getByRole('button', { name: 'Resume game', exact: true }).click();
  await square(page, 'b7').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Choose promotion piece' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Promote to queen', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem('checkmate_active_game_v1')!).pgn.includes('bxa8=Q')
      )
    )
    .toBe(true);
});
