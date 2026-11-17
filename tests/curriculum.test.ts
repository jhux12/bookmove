import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { OPENING_COURSES } from '../src/data/openingCourses';
import { getDepthLines } from '../src/data/openingCurriculum';

test('every study line replays legally, has instruction, and has a distinct sequence', () => {
  const ids = new Set<string>();
  let total = 0;
  for (const course of OPENING_COURSES) {
    const sequences = new Set<string>();
    for (const line of course.variations) {
      assert.equal(line.courseId, course.id);
      assert.ok(!ids.has(line.id), line.id);
      ids.add(line.id);
      const game = new Chess();
      assert.ok(line.steps.length >= 8, line.id);
      for (const step of line.steps) {
        assert.ok(step.note.trim().length > 3, line.id);
        assert.ok(game.move(step.san), `${line.id}: ${step.san}`);
      }
      const sequence = game.history().join(' ');
      assert.ok(!sequences.has(sequence), `duplicate ${line.id}`);
      sequences.add(sequence);
      total++;
    }
    const e = getDepthLines(course, 'essentials'),
      a = getDepthLines(course, 'advanced'),
      f = getDepthLines(course, 'full');
    assert.ok(e.length > 0 && e.length < a.length && a.length < f.length, course.id);
    assert.ok(e.every((v) => a.includes(v)) && a.every((v) => f.includes(v)));
  }
  assert.ok(total >= 110);
  console.log(`Validated ${total} annotated lines across ${OPENING_COURSES.length} courses.`);
});
