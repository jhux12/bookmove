import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
import { DEFAULT_PREFERENCES } from '../data/themes';
import {
  ArchivedGame,
  BillingCycle,
  CustomOpeningLine,
  LineProgress,
  MoveRecord,
  PieceColor,
  PieceType,
  SubscriptionStatus,
  SubscriptionTier,
  UserAccountProfile,
  UserPreferences,
} from '../types/chess';
import { parseWeakPlies, serializeWeakPlies } from '../utils/repertoire';

const LOCAL_PROGRESS_KEY = 'checkmate_line_progress_v1';
const LOCAL_CUSTOM_LINES_KEY = 'checkmate_custom_lines_v1';
const LOCAL_PROFILE_KEY = 'checkmate_local_tier_v1';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  profile: UserAccountProfile;
  effectiveTier: SubscriptionTier;
  lineProgress: Record<string, LineProgress>;
  customLines: CustomOpeningLine[];
  cloudGames: ArchivedGame[] | null;
  remotePreferences: UserPreferences | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateSubscription: (
    tier: SubscriptionTier,
    billingCycle: BillingCycle,
    status?: SubscriptionStatus
  ) => Promise<void>;
  syncPreferences: (prefs: UserPreferences) => Promise<void>;
  recordLinePractice: (
    courseId: string,
    lineId: string,
    mistakesThisRun: number,
    missedPlies?: number[]
  ) => Promise<LineProgress>;
  createCustomLine: (input: {
    name: string;
    playerColor: PieceColor;
    moves: string[];
    notes: string;
  }) => Promise<CustomOpeningLine>;
  deleteCustomLine: (lineId: string) => Promise<void>;
  saveArchivedGameCloud: (game: ArchivedGame) => Promise<void>;
  deleteArchivedGameCloud: (gameId: string) => Promise<void>;
  clearAuthError: () => void;
}

const DEFAULT_GUEST_PROFILE: UserAccountProfile = {
  uid: 'guest',
  displayName: 'Guest Player',
  email: '',
  subscriptionTier: 'free',
  billingCycle: 'annual',
  subscriptionStatus: 'active',
};

function loadLocalProgress(): Record<string, LineProgress> {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadLocalCustomLines(): CustomOpeningLine[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_LINES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalTier(): {
  subscriptionTier: SubscriptionTier;
  billingCycle: BillingCycle;
  subscriptionStatus: SubscriptionStatus;
} {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) {
      return {
        subscriptionTier: 'free',
        billingCycle: 'annual',
        subscriptionStatus: 'active',
      };
    }
    const parsed = JSON.parse(raw);
    return {
      subscriptionTier:
        parsed.subscriptionTier === 'pro' || parsed.subscriptionTier === 'master'
          ? 'pro'
          : 'free',
      billingCycle: parsed.billingCycle === 'monthly' ? 'monthly' : 'annual',
      subscriptionStatus: parsed.subscriptionStatus === 'canceled' ? 'canceled' : 'active',
    };
  } catch {
    return {
      subscriptionTier: 'free',
      billingCycle: 'annual',
      subscriptionStatus: 'active',
    };
  }
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function reconstructMovesFromPgn(pgn: string): MoveRecord[] {
  try {
    const parser = new Chess();
    parser.loadPgn(pgn);
    const verbose = parser.history({ verbose: true });
    const replay = new Chess();
    const out: MoveRecord[] = [];
    for (const m of verbose) {
      const exec = replay.move(m.san);
      if (!exec) break;
      out.push({
        san: exec.san,
        from: exec.from,
        to: exec.to,
        fen: replay.fen(),
        color: exec.color,
        captured: exec.captured as PieceType | undefined,
        promotion: exec.promotion as PieceType | undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function computeNextProgress(
  prev: LineProgress | undefined,
  userId: string,
  courseId: string,
  lineId: string,
  mistakesThisRun: number,
  missedPlies: number[] = []
): LineProgress {
  const prevAttempts = prev?.attempts ?? 0;
  const prevMistakes = prev?.mistakes ?? 0;
  const prevStreak = prev?.streak ?? 0;
  const prevMastery = prev?.masteryPct ?? 0;

  const cleanRun = mistakesThisRun === 0;
  const nextAttempts = Math.min(100000, prevAttempts + 1);
  const nextMistakes = Math.min(100000, prevMistakes + Math.max(0, Math.round(mistakesThisRun)));
  const nextStreak = cleanRun ? Math.min(10000, prevStreak + 1) : 0;

  let nextMastery: number;
  if (cleanRun) {
    // Flawless recall immediately marks the line as perfected (100%)
    nextMastery = 100;
  } else if (prevMastery >= 80) {
    // Previously perfected line slipped during random practice: keep in learned pool (85%) but schedule prompt review
    nextMastery = 85;
  } else {
    // Unperfected line with mistakes never crosses 75% until passed flawlessly
    const base = prevMastery > 0 ? prevMastery : 35;
    nextMastery = Math.max(20, Math.min(75, Math.round(base + 15 - mistakesThisRun * 12)));
  }

  const nextWeakPlies: Record<number, number> = { ...(prev?.weakPlies ?? {}) };
  for (const ply of missedPlies) {
    if (Number.isInteger(ply) && ply >= 0) {
      nextWeakPlies[ply] = (nextWeakPlies[ply] ?? 0) + 1;
    }
  }

  const intervalHours = cleanRun
    ? nextStreak === 1
      ? 4
      : nextStreak === 2
      ? 24
      : nextStreak === 3
      ? 72
      : 168
    : 0.15;

  const nextReviewMs = Math.round(Date.now() + intervalHours * 60 * 60 * 1000);

  return {
    userId,
    courseId,
    lineId,
    attempts: nextAttempts,
    mistakes: nextMistakes,
    streak: nextStreak,
    masteryPct: nextMastery,
    nextReviewMs,
    lastPracticedAt: new Date().toISOString(),
    weakPlies: nextWeakPlies,
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [localTier, setLocalTier] = useState(loadLocalTier);
  const [profile, setProfile] = useState<UserAccountProfile>(() => ({
    ...DEFAULT_GUEST_PROFILE,
    ...loadLocalTier(),
  }));
  const [remotePreferences, setRemotePreferences] = useState<UserPreferences | null>(null);
  const [lineProgress, setLineProgress] = useState<Record<string, LineProgress>>(loadLocalProgress);
  const [customLines, setCustomLines] = useState<CustomOpeningLine[]>(loadLocalCustomLines);
  const [cloudGames, setCloudGames] = useState<ArchivedGame[] | null>(null);

  // Save guest local fallback state
  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(lineProgress));
    } catch {
      // Ignore storage errors
    }
  }, [lineProgress, user]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(LOCAL_CUSTOM_LINES_KEY, JSON.stringify(customLines));
    } catch {
      // Ignore storage errors
    }
  }, [customLines, user]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localTier));
    } catch {
      // Ignore storage errors
    }
  }, [localTier, user]);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubProgress: (() => void) | undefined;
    let unsubCustom: (() => void) | undefined;
    let unsubGames: (() => void) | undefined;
    let cancelled = false;

    const cleanupSubs = () => {
      unsubProfile?.();
      unsubProgress?.();
      unsubCustom?.();
      unsubGames?.();
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      cleanupSubs();
      setUser(nextUser);

      if (!nextUser) {
        const tierState = loadLocalTier();
        setLocalTier(tierState);
        setProfile({ ...DEFAULT_GUEST_PROFILE, ...tierState });
        setRemotePreferences(null);
        setLineProgress(loadLocalProgress());
        setCustomLines(loadLocalCustomLines());
        setCloudGames(null);
        setAuthReady(true);
        return;
      }

      const uid = nextUser.uid;
      const userRef = doc(db, 'users', uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const safeName = (
            nextUser.displayName ||
            nextUser.email?.split('@')[0] ||
            'Chess Player'
          )
            .trim()
            .slice(0, 80);
          const safeEmail = (nextUser.email || 'player@checkmate.local').trim().slice(0, 160);
          await setDoc(userRef, {
            uid,
            displayName: safeName || 'Chess Player',
            email: safeEmail,
            subscriptionTier: 'free',
            billingCycle: 'annual',
            subscriptionStatus: 'active',
            boardTheme: DEFAULT_PREFERENCES.boardTheme,
            pieceSet: DEFAULT_PREFERENCES.pieceSet,
            coordinates: DEFAULT_PREFERENCES.coordinates,
            showLegalMoves: DEFAULT_PREFERENCES.showLegalMoves,
            soundEnabled: DEFAULT_PREFERENCES.soundEnabled,
            animationSpeed: DEFAULT_PREFERENCES.animationSpeed,
            showEvalBar: DEFAULT_PREFERENCES.showEvalBar,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError('Unable to initialize user profile in cloud.');
          setAuthReady(true);
        }
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        return;
      }

      if (cancelled) return;

      unsubProfile = onSnapshot(
        userRef,
        (docSnap) => {
          if (!docSnap.exists()) return;
          const d = docSnap.data();
          setProfile({
            uid: d.uid || uid,
            displayName: d.displayName || 'Chess Player',
            email: d.email || nextUser.email || '',
            subscriptionTier:
              d.subscriptionTier === 'pro' || d.subscriptionTier === 'master'
                ? 'pro'
                : 'free',
            billingCycle: d.billingCycle === 'monthly' ? 'monthly' : 'annual',
            subscriptionStatus: d.subscriptionStatus === 'canceled' ? 'canceled' : 'active',
          });
          if (d.boardTheme && d.pieceSet) {
            setRemotePreferences({
              boardTheme: d.boardTheme,
              pieceSet: d.pieceSet,
              coordinates: d.coordinates ?? DEFAULT_PREFERENCES.coordinates,
              showLegalMoves:
                typeof d.showLegalMoves === 'boolean'
                  ? d.showLegalMoves
                  : DEFAULT_PREFERENCES.showLegalMoves,
              soundEnabled:
                typeof d.soundEnabled === 'boolean'
                  ? d.soundEnabled
                  : DEFAULT_PREFERENCES.soundEnabled,
              animationSpeed: d.animationSpeed ?? DEFAULT_PREFERENCES.animationSpeed,
              showEvalBar:
                typeof d.showEvalBar === 'boolean'
                  ? d.showEvalBar
                  : DEFAULT_PREFERENCES.showEvalBar,
            });
          }
          setAuthReady(true);
        },
        (err) => {
          console.error('Profile listener error:', err);
          setAuthReady(true);
        }
      );

      const progressQuery = query(
        collection(db, 'users', uid, 'lineProgress'),
        where('userId', '==', uid)
      );
      unsubProgress = onSnapshot(
        progressQuery,
        (qs) => {
          const nextMap: Record<string, LineProgress> = {};
          qs.forEach((docSnap) => {
            const d = docSnap.data();
            nextMap[docSnap.id] = {
              userId: d.userId,
              courseId: d.courseId,
              lineId: d.lineId,
              attempts: Number(d.attempts) || 0,
              mistakes: Number(d.mistakes) || 0,
              streak: Number(d.streak) || 0,
              masteryPct: Number(d.masteryPct) || 0,
              nextReviewMs: Number(d.nextReviewMs) || 0,
              lastPracticedAt: timestampToIso(d.lastPracticedAt),
              weakPlies: parseWeakPlies(d.weakPlies),
            };
          });
          setLineProgress(nextMap);
        },
        (err) => {
          console.error('Line progress listener error:', err);
        }
      );

      const customQuery = query(
        collection(db, 'users', uid, 'customLines'),
        where('userId', '==', uid)
      );
      unsubCustom = onSnapshot(
        customQuery,
        (qs) => {
          const items: CustomOpeningLine[] = [];
          qs.forEach((docSnap) => {
            const d = docSnap.data();
            items.push({
              id: docSnap.id,
              userId: d.userId,
              name: d.name,
              playerColor: d.playerColor === 'b' ? 'b' : 'w',
              moves: Array.isArray(d.moves) ? d.moves : [],
              notes: typeof d.notes === 'string' ? d.notes : '',
              createdAt: timestampToIso(d.createdAt),
            });
          });
          items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setCustomLines(items);
        },
        (err) => {
          console.error('Custom lines listener error:', err);
        }
      );

      const gamesQuery = query(
        collection(db, 'users', uid, 'games'),
        where('userId', '==', uid)
      );
      unsubGames = onSnapshot(
        gamesQuery,
        (qs) => {
          const list: ArchivedGame[] = [];
          qs.forEach((docSnap) => {
            const d = docSnap.data();
            const pgn = typeof d.pgn === 'string' ? d.pgn : '';
            list.push({
              id: docSnap.id,
              playedAt: timestampToIso(d.playedAt),
              botId: d.botId,
              botName: d.botName,
              botElo: Number(d.botElo) || 800,
              playerColor: d.playerColor === 'b' ? 'b' : 'w',
              result: d.result === 'win' || d.result === 'loss' ? d.result : 'draw',
              termination: d.termination || 'Completed',
              openingName: d.openingName || 'Starting Position',
              moveCount: Number(d.moveCount) || 0,
              pgn,
              moves: reconstructMovesFromPgn(pgn),
              assistMode:
                d.assistMode === 'challenge' || d.assistMode === 'coach'
                  ? d.assistMode
                  : 'friendly',
              timeControlLabel: d.timeControlLabel || 'Untimed',
            });
          });
          list.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
          setCloudGames(list);
        },
        (err) => {
          console.error('Games listener error:', err);
        }
      );
    });

    return () => {
      cancelled = true;
      cleanupSubs();
      unsubscribeAuth();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in was canceled.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Could not complete Google sign-in. Please allow popups and try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const updateSubscription = useCallback(
    async (
      tier: SubscriptionTier,
      billingCycle: BillingCycle,
      status: SubscriptionStatus = 'active'
    ) => {
      if (!user) {
        const next = {
          subscriptionTier: tier,
          billingCycle,
          subscriptionStatus: status,
        };
        setLocalTier(next);
        setProfile((prev) => ({ ...prev, ...next }));
        return;
      }

      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          subscriptionTier: tier,
          billingCycle,
          subscriptionStatus: status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const syncPreferences = useCallback(
    async (prefs: UserPreferences) => {
      if (!user) return;
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          boardTheme: prefs.boardTheme,
          pieceSet: prefs.pieceSet,
          coordinates: prefs.coordinates,
          showLegalMoves: Boolean(prefs.showLegalMoves),
          soundEnabled: Boolean(prefs.soundEnabled),
          animationSpeed: prefs.animationSpeed,
          showEvalBar: Boolean(prefs.showEvalBar),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const recordLinePractice = useCallback(
    async (
      courseId: string,
      lineId: string,
      mistakesThisRun: number,
      missedPlies: number[] = []
    ): Promise<LineProgress> => {
      const uid = user?.uid ?? 'guest';
      const next = computeNextProgress(
        lineProgress[lineId],
        uid,
        courseId,
        lineId,
        mistakesThisRun,
        missedPlies
      );

      if (!user) {
        setLineProgress((prev) => ({ ...prev, [lineId]: next }));
        return next;
      }

      const serializedWeak = serializeWeakPlies(next.weakPlies ?? {});
      const path = `users/${user.uid}/lineProgress/${lineId}`;
      const ref = doc(db, 'users', user.uid, 'lineProgress', lineId);
      try {
        const existingSnap = await getDoc(ref);
        if (existingSnap.exists()) {
          await updateDoc(ref, {
            attempts: next.attempts,
            mistakes: next.mistakes,
            streak: next.streak,
            masteryPct: next.masteryPct,
            nextReviewMs: next.nextReviewMs,
            weakPlies: serializedWeak,
            lastPracticedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            courseId,
            lineId,
            attempts: next.attempts,
            mistakes: next.mistakes,
            streak: next.streak,
            masteryPct: next.masteryPct,
            nextReviewMs: next.nextReviewMs,
            weakPlies: serializedWeak,
            lastPracticedAt: serverTimestamp(),
          });
        }
        return next;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [user, lineProgress]
  );

  const createCustomLine = useCallback(
    async (input: {
      name: string;
      playerColor: PieceColor;
      moves: string[];
      notes: string;
    }): Promise<CustomOpeningLine> => {
      const cleanId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanName = input.name.trim().slice(0, 80) || 'Custom Repertoire Line';
      const cleanMoves = input.moves.slice(0, 40);
      const cleanNotes = input.notes.trim().slice(0, 300);

      const created: CustomOpeningLine = {
        id: cleanId,
        userId: user?.uid ?? 'guest',
        name: cleanName,
        playerColor: input.playerColor,
        moves: cleanMoves,
        notes: cleanNotes,
        createdAt: new Date().toISOString(),
      };

      if (!user) {
        setCustomLines((prev) => [created, ...prev]);
        return created;
      }

      const path = `users/${user.uid}/customLines/${cleanId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'customLines', cleanId), {
          userId: user.uid,
          name: cleanName,
          playerColor: input.playerColor,
          moves: cleanMoves,
          notes: cleanNotes,
          createdAt: serverTimestamp(),
        });
        return created;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user]
  );

  const deleteCustomLine = useCallback(
    async (lineId: string) => {
      if (!user) {
        setCustomLines((prev) => prev.filter((l) => l.id !== lineId));
        return;
      }
      const path = `users/${user.uid}/customLines/${lineId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'customLines', lineId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const saveArchivedGameCloud = useCallback(
    async (game: ArchivedGame) => {
      if (!user) return;
      const safeId = game.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 64);
      const path = `users/${user.uid}/games/${safeId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'games', safeId), {
          userId: user.uid,
          botId: game.botId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 40),
          botName: game.botName.slice(0, 60) || 'Chess Bot',
          botElo: Math.max(100, Math.min(3500, Math.round(game.botElo))),
          playerColor: game.playerColor,
          result: game.result,
          termination: game.termination.slice(0, 60) || 'Game Over',
          openingName: game.openingName.slice(0, 120) || 'Starting Position',
          moveCount: Math.max(0, Math.min(500, Math.round(game.moveCount))),
          pgn: game.pgn.slice(0, 8000),
          assistMode: game.assistMode,
          timeControlLabel: game.timeControlLabel.slice(0, 40) || 'Untimed',
          playedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user]
  );

  const deleteArchivedGameCloud = useCallback(
    async (gameId: string) => {
      if (!user) return;
      const path = `users/${user.uid}/games/${gameId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'games', gameId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const effectiveTier: SubscriptionTier =
    profile.subscriptionStatus === 'canceled' ? 'free' : profile.subscriptionTier;

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        authError,
        profile,
        effectiveTier,
        lineProgress,
        customLines,
        cloudGames,
        remotePreferences,
        signInWithGoogle,
        signOutUser,
        updateSubscription,
        syncPreferences,
        recordLinePractice,
        createCustomLine,
        deleteCustomLine,
        saveArchivedGameCloud,
        deleteArchivedGameCloud,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
