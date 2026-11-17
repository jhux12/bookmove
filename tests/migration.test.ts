import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeGuestProgress } from '../src/utils/guestMigration';
import { LineProgress } from '../src/types/chess';
const make = (date: string, mastery: number, attempts: number): LineProgress => ({
  userId: 'guest',
  courseId: 'course-italian',
  lineId: 'italian-giuoco-main',
  attempts,
  mistakes: 0,
  streak: 1,
  masteryPct: mastery,
  nextReviewMs: 100,
  lastPracticedAt: date,
});
test('a newer cloud review survives importing older guest mastery', () => {
  const guest = make('2026-01-01', 100, 3),
    cloud = make('2026-02-01', 85, 4);
  const merged = mergeGuestProgress(guest, cloud);
  assert.equal(merged.masteryPct, 85);
  assert.equal(merged.attempts, 4);
  assert.deepEqual(mergeGuestProgress(guest, merged), merged, 'retry is idempotent');
});
test('newer guest progress is imported without adding attempt counters twice', () => {
  const guest = make('2026-03-01', 100, 5),
    cloud = make('2026-02-01', 50, 2);
  assert.equal(mergeGuestProgress(guest, cloud).masteryPct, 100);
  assert.equal(mergeGuestProgress(guest, mergeGuestProgress(guest, cloud)).attempts, 5);
});
