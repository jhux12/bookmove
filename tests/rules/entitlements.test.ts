import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, Firestore } from 'firebase/firestore';
import { migrateGuestWork } from '../../src/utils/guestMigration';
let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bookmove',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => {
  await env?.cleanup();
});
const profile = (uid: string) => ({
  uid,
  displayName: 'Player',
  email: 'player@example.com',
  subscriptionTier: 'free',
  subscriptionStatus: 'active',
  billingCycle: 'annual',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
test('owners can create free profiles but cannot grant paid entitlements', async () => {
  const db = env.authenticatedContext('owner').firestore();
  const ref = doc(db, 'users', 'owner');
  await assertSucceeds(setDoc(ref, profile('owner')));
  await assertFails(updateDoc(ref, { subscriptionTier: 'pro', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { displayName: 'New name', updatedAt: serverTimestamp() }));
  const other = env.authenticatedContext('other').firestore();
  await assertFails(
    setDoc(doc(other, 'users', 'other'), { ...profile('other'), subscriptionTier: 'pro' })
  );
  await assertFails(
    updateDoc(doc(other, 'users', 'owner'), {
      subscriptionTier: 'pro',
      updatedAt: serverTimestamp(),
    })
  );
});
test('guest migration imports dated progress, lines and games idempotently', async () => {
  const db = env.authenticatedContext('migrator').firestore();
  await setDoc(doc(db, 'users', 'migrator'), profile('migrator'));
  const progress = {
    userId: 'guest',
    courseId: 'course-italian',
    lineId: 'italian-giuoco-main',
    attempts: 1,
    mistakes: 0,
    streak: 1,
    masteryPct: 100,
    nextReviewMs: 100,
    lastPracticedAt: '2026-01-01T00:00:00.000Z',
    weakPlies: {},
  };
  const custom = {
    id: 'custom-migration',
    userId: 'guest',
    name: 'My line',
    playerColor: 'w' as const,
    moves: ['e4', 'e5'],
    notes: 'Center play',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const game = {
    id: 'game-migration',
    playedAt: '2026-01-01T00:00:00.000Z',
    botId: 'clara',
    botName: 'Clara',
    botElo: 800,
    playerColor: 'w' as const,
    result: 'loss' as const,
    termination: 'Resignation',
    openingName: 'King Pawn',
    moveCount: 1,
    moves: [],
    pgn: '1. e4 e5',
    assistMode: 'friendly' as const,
    timeControlLabel: 'Unlimited',
  };
  await assertSucceeds(
    migrateGuestWork(
      db as unknown as Firestore,
      'migrator',
      { [progress.lineId]: progress },
      [custom],
      [game]
    )
  );
  await assertSucceeds(
    migrateGuestWork(
      db as unknown as Firestore,
      'migrator',
      { [progress.lineId]: progress },
      [custom],
      [game]
    )
  );
  const imported = await getDoc(doc(db, 'users', 'migrator', 'lineProgress', progress.lineId));
  if (imported.data()?.attempts !== 1) throw new Error('Import duplicated attempts');
});
