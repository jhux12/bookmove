import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { readGameSession, recordsFromGame, GAME_SESSION_KEY } from '../src/utils/gameSession';
import { TIME_CONTROLS } from '../src/data/themes';

test('saved games restore full legal history, including castling rights and en passant', () => {
  const chess = new Chess();
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6']) chess.move(san);
  let raw = JSON.stringify({
    version: 1,
    id: 'session-test',
    pgn: chess.pgn(),
    botId: 'clara',
    playerColor: 'w',
    orientation: 'w',
    assistMode: 'friendly',
    timeControl: TIME_CONTROLS[0],
    whiteClock: null,
    blackClock: null,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => (key === GAME_SESSION_KEY ? raw : null) },
  });
  const saved = readGameSession();
  assert.ok(saved);
  const restored = new Chess();
  restored.loadPgn(saved.pgn);
  assert.equal(restored.fen(), chess.fen());
  assert.equal(recordsFromGame(restored).length, 6);
  raw = raw.replace('1. e4', '1. e9');
  assert.equal(readGameSession(), null);
  raw = 'not json';
  assert.equal(readGameSession(), null);
});
