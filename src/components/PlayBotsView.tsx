import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  Flag,
  Lightbulb,
  Plus,
  RotateCcw,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BOTS, pickDialogue } from '../data/bots';
import { BOARD_THEMES, TIME_CONTROLS } from '../data/themes';
import {
  chooseBotMove,
  getCapturedPieces,
  getPositionEvaluation,
  getRankedMoves,
} from '../engine/chessAI';
import {
  ArchivedGame,
  AssistMode,
  BoardArrow,
  BotProfile,
  CustomLineSeed,
  MoveRecord,
  PieceColor,
  PieceType,
  PlaySideChoice,
  SparringSeed,
  TimeControl,
  UserPreferences,
} from '../types/chess';
import { detectOpening } from '../utils/openings';
import { soundEngine } from '../utils/sound';
import { ArchiveView } from './ArchiveView';
import { BotAvatar } from './BotAvatar';
import { ChessBoard } from './ChessBoard';
import { MoveList } from './MoveList';
import { PlayerStrip } from './PlayerStrip';
import { ResultOverlayModal } from './ResultOverlayModal';

interface PlayBotsViewProps {
  preferences: UserPreferences;
  onToggleSound: () => void;
  archivedGames: ArchivedGame[];
  onSaveGame: (game: ArchivedGame) => void;
  onDeleteGame: (id: string) => void;
  onClearAllGames: () => void;
  newGameTrigger: number;
  sparringSeed?: SparringSeed | null;
  onClearSparringSeed?: () => void;
  onDrillRepertoireLine?: (courseId: string, variationId: string) => void;
  onSaveCustomPrep?: (seed: CustomLineSeed) => void;
}

type MatchPhase = 'SETUP' | 'PLAYING' | 'GAME_OVER';
type ArenaSubView = 'arena' | 'archive';

export const PlayBotsView: React.FC<PlayBotsViewProps> = ({
  preferences,
  onToggleSound,
  archivedGames,
  onSaveGame,
  onDeleteGame,
  onClearAllGames,
  newGameTrigger,
  sparringSeed = null,
  onClearSparringSeed,
  onDrillRepertoireLine,
  onSaveCustomPrep,
}) => {
  const [subView, setSubView] = useState<ArenaSubView>('arena');
  const [reviewTarget, setReviewTarget] = useState<ArchivedGame | null>(null);
  const [isReviewingGame, setIsReviewingGame] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotProfile>(BOTS[1]);
  const [sideChoice, setSideChoice] = useState<PlaySideChoice>('w');
  const [assistMode, setAssistMode] = useState<AssistMode>('friendly');
  const [timeControl, setTimeControl] = useState<TimeControl>(TIME_CONTROLS[0]);

  const [phase, setPhase] = useState<MatchPhase>('SETUP');
  const [playerColor, setPlayerColor] = useState<PieceColor>('w');
  const [orientation, setOrientation] = useState<PieceColor>('w');

  const chessRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(chessRef.current.fen());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [viewPly, setViewPly] = useState<number>(0);

  const [botThinking, setBotThinking] = useState(false);
  const [botDialogue, setBotDialogue] = useState<string>(pickDialogue(BOTS[1].dialogues.greeting));
  const [hintArrows, setHintArrows] = useState<BoardArrow[]>([]);
  const [coachBanner, setCoachBanner] = useState<string | null>(null);
  const [queuedPremove, setQueuedPremove] = useState<{ from: string; to: string } | null>(null);
  const queuedPremoveRef = useRef<{ from: string; to: string } | null>(null);
  const [sparringGoal, setSparringGoal] = useState<{
    name: string;
    summary?: string;
    seedPlies: number;
    baselineCpForPlayer: number;
  } | null>(null);

  const [whiteClock, setWhiteClock] = useState<number | null>(null);
  const [blackClock, setBlackClock] = useState<number | null>(null);

  const [gameOutcome, setGameOutcome] = useState<{
    result: 'win' | 'loss' | 'draw';
    headline: string;
    termination: string;
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const lastSavedGameRef = useRef<ArchivedGame | null>(null);
  const botTimerRef = useRef<number | null>(null);
  const modalTimerRef = useRef<number | null>(null);
  const matchIdRef = useRef<string>('');

  const boardTheme = BOARD_THEMES[preferences.boardTheme];

  const updateQueuedPremove = useCallback(
    (next: { from: string; to: string } | null) => {
      queuedPremoveRef.current = next;
      setQueuedPremove(next);
    },
    []
  );

  useEffect(() => {
    if (sparringSeed) {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      if (modalTimerRef.current) {
        window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
      setSubView('arena');
      setSideChoice(sparringSeed.playerColor);
      setBotThinking(false);
      setShowResultModal(false);
      setPhase('SETUP');
      setHintArrows([]);
      setCoachBanner(null);
    }
  }, [sparringSeed]);

  useEffect(() => {
    if (newGameTrigger > 0) {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      if (modalTimerRef.current) {
        window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
      setSubView('arena');
      setBotThinking(false);
      setShowResultModal(false);
      setPhase('SETUP');
      setHintArrows([]);
      setCoachBanner(null);
    }
  }, [newGameTrigger]);

  const setupSeedPreview = useMemo(() => {
    const g = new Chess();
    if (!sparringSeed || sparringSeed.moves.length === 0) {
      return { fen: g.fen(), lastMove: null as { from: string; to: string } | null };
    }
    let last: { from: string; to: string } | null = null;
    for (const san of sparringSeed.moves) {
      const m = g.move(san);
      if (!m) break;
      last = { from: m.from, to: m.to };
    }
    return { fen: g.fen(), lastMove: last };
  }, [sparringSeed]);

  const botStats = useMemo(() => {
    const map: Record<string, { w: number; l: number; d: number }> = {};
    for (const g of archivedGames) {
      if (!map[g.botId]) map[g.botId] = { w: 0, l: 0, d: 0 };
      if (g.result === 'win') map[g.botId].w++;
      else if (g.result === 'loss') map[g.botId].l++;
      else map[g.botId].d++;
    }
    return map;
  }, [archivedGames]);

  const displayedFen = useMemo(() => {
    if (viewPly === 0) return new Chess().fen();
    if (viewPly >= moves.length) return fen;
    return moves[viewPly - 1].fen;
  }, [fen, moves, viewPly]);

  const displayedLastMove = useMemo(() => {
    if (viewPly === 0 || moves.length === 0) return null;
    const m = moves[Math.min(viewPly - 1, moves.length - 1)];
    return { from: m.from, to: m.to };
  }, [moves, viewPly]);

  const openingName = useMemo(
    () => detectOpening(moves.map((m) => m.san)),
    [moves]
  );

  const capturedInfo = useMemo(() => getCapturedPieces(displayedFen), [displayedFen]);

  const evalInfo = useMemo(() => {
    const showEval =
      preferences.showEvalBar && (assistMode !== 'challenge' || phase === 'GAME_OVER');
    if (!showEval) {
      return { show: false, display: '0.0', pct: 50 };
    }
    const res = getPositionEvaluation(displayedFen, 2);
    return { show: true, display: res.display, pct: res.whiteAdvantagePct };
  }, [displayedFen, preferences.showEvalBar, assistMode, phase]);

  const finalizeGame = useCallback(
    (result: 'win' | 'loss' | 'draw', headline: string, termination: string, finalMoves: MoveRecord[]) => {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
      setBotThinking(false);
      updateQueuedPremove(null);
      setPhase('GAME_OVER');
      setGameOutcome({ result, headline, termination });
      soundEngine.playGameEnd(result);

      if (result === 'win') {
        setBotDialogue(pickDialogue(selectedBot.dialogues.lose));
      } else if (result === 'loss') {
        setBotDialogue(pickDialogue(selectedBot.dialogues.win));
      } else {
        setBotDialogue(pickDialogue(selectedBot.dialogues.draw));
      }

      const archived: ArchivedGame = {
        id: matchIdRef.current || `game-${Date.now()}`,
        playedAt: new Date().toISOString(),
        botId: selectedBot.id,
        botName: selectedBot.name,
        botElo: selectedBot.elo,
        playerColor,
        result,
        termination,
        openingName: detectOpening(finalMoves.map((m) => m.san)),
        moveCount: Math.ceil(finalMoves.length / 2),
        moves: finalMoves,
        pgn: chessRef.current.pgn(),
        assistMode,
        timeControlLabel: timeControl.label,
      };
      lastSavedGameRef.current = archived;
      onSaveGame(archived);

      if (modalTimerRef.current) window.clearTimeout(modalTimerRef.current);
      modalTimerRef.current = window.setTimeout(() => {
        setShowResultModal(true);
      }, 280);
    },
    [selectedBot, playerColor, assistMode, timeControl.label, onSaveGame]
  );

  const checkAndHandleGameOver = useCallback(
    (currentMoves: MoveRecord[]) => {
      const c = chessRef.current;
      if (!c.isGameOver()) return false;

      if (c.isCheckmate()) {
        const winnerColor = c.turn() === 'w' ? 'b' : 'w';
        const playerWon = winnerColor === playerColor;
        finalizeGame(
          playerWon ? 'win' : 'loss',
          playerWon ? 'You Won!' : `${selectedBot.name} Won`,
          'Checkmate',
          currentMoves
        );
      } else if (c.isStalemate()) {
        finalizeGame('draw', 'Draw', 'Stalemate', currentMoves);
      } else if (c.isThreefoldRepetition()) {
        finalizeGame('draw', 'Draw', 'Threefold Repetition', currentMoves);
      } else if (c.isInsufficientMaterial()) {
        finalizeGame('draw', 'Draw', 'Insufficient Material', currentMoves);
      } else {
        finalizeGame('draw', 'Draw', '50-Move Rule', currentMoves);
      }
      return true;
    },
    [finalizeGame, playerColor, selectedBot.name]
  );

  const playSoundForMove = (san: string, captured: boolean, promotion?: string) => {
    if (promotion) {
      soundEngine.playPromote();
    } else if (san.includes('+')) {
      soundEngine.playCheck();
    } else if (san === 'O-O' || san === 'O-O-O') {
      soundEngine.playCastle();
    } else if (captured) {
      soundEngine.playCapture();
    } else {
      soundEngine.playMove();
    }
  };

  const triggerBotTurn = useCallback(
    (currentMoves: MoveRecord[]) => {
      const c = chessRef.current;
      if (c.isGameOver()) return;
      const botColor: PieceColor = playerColor === 'w' ? 'b' : 'w';
      if (c.turn() !== botColor) return;

      setBotThinking(true);
      const [minMs, maxMs] = selectedBot.thinkTimeMs;
      const delay = minMs + Math.random() * (maxMs - minMs);

      botTimerRef.current = window.setTimeout(() => {
        const move = chooseBotMove(c.fen(), selectedBot);
        if (!move) {
          setBotThinking(false);
          return;
        }
        const executed = c.move(move);
        if (!executed) {
          setBotThinking(false);
          return;
        }

        if (timeControl.incrementSeconds > 0) {
          if (botColor === 'w') {
            setWhiteClock((prev) => (prev !== null ? prev + timeControl.incrementSeconds : null));
          } else {
            setBlackClock((prev) => (prev !== null ? prev + timeControl.incrementSeconds : null));
          }
        }

        const nextFen = c.fen();
        const rec: MoveRecord = {
          san: executed.san,
          from: executed.from,
          to: executed.to,
          fen: nextFen,
          color: executed.color,
          captured: executed.captured as PieceType | undefined,
          promotion: executed.promotion as PieceType | undefined,
        };
        const updatedMoves = [...currentMoves, rec];

        setFen(nextFen);
        setMoves(updatedMoves);
        setViewPly(updatedMoves.length);
        setBotThinking(false);

        playSoundForMove(executed.san, Boolean(executed.captured), executed.promotion);

        if (!checkAndHandleGameOver(updatedMoves)) {
          if (executed.san.includes('+')) {
            setBotDialogue(pickDialogue(selectedBot.dialogues.check));
          } else if (executed.captured) {
            setBotDialogue(pickDialogue(selectedBot.dialogues.capture));
          }

          // Execute queued premove immediately if still legal
          const premove = queuedPremoveRef.current;
          if (premove) {
            updateQueuedPremove(null);
            window.setTimeout(() => {
              const cur = chessRef.current;
              if (cur.isGameOver() || cur.turn() !== playerColor) return;
              try {
                const pm = cur.move({
                  from: premove.from as Square,
                  to: premove.to as Square,
                  promotion: 'q',
                });
                if (pm) {
                  if (timeControl.incrementSeconds > 0) {
                    if (playerColor === 'w') {
                      setWhiteClock((p) => (p !== null ? p + timeControl.incrementSeconds : null));
                    } else {
                      setBlackClock((p) => (p !== null ? p + timeControl.incrementSeconds : null));
                    }
                  }
                  const pmFen = cur.fen();
                  const pmRec: MoveRecord = {
                    san: pm.san,
                    from: pm.from,
                    to: pm.to,
                    fen: pmFen,
                    color: pm.color,
                    captured: pm.captured as PieceType | undefined,
                    promotion: pm.promotion as PieceType | undefined,
                  };
                  const afterPremoveMoves = [...updatedMoves, pmRec];
                  setFen(pmFen);
                  setMoves(afterPremoveMoves);
                  setViewPly(afterPremoveMoves.length);
                  setHintArrows([]);
                  playSoundForMove(pm.san, Boolean(pm.captured), pm.promotion);
                  if (!checkAndHandleGameOver(afterPremoveMoves)) {
                    triggerBotTurn(afterPremoveMoves);
                  }
                }
              } catch {
                // Premove became illegal; cleanly discarded
              }
            }, 90);
          }
        }
      }, delay);
    },
    [
      playerColor,
      selectedBot,
      timeControl.incrementSeconds,
      checkAndHandleGameOver,
      updateQueuedPremove,
    ]
  );

  const startMatch = useCallback(
    (botToPlay: BotProfile = selectedBot) => {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }

      const resolvedColor: PieceColor = sparringSeed
        ? sparringSeed.playerColor
        : sideChoice === 'random'
        ? Math.random() < 0.5
          ? 'w'
          : 'b'
        : sideChoice;

      const fresh = new Chess();
      const seedRecords: MoveRecord[] = [];
      if (sparringSeed && sparringSeed.moves.length > 0) {
        for (const san of sparringSeed.moves) {
          const exec = fresh.move(san);
          if (!exec) break;
          seedRecords.push({
            san: exec.san,
            from: exec.from,
            to: exec.to,
            fen: fresh.fen(),
            color: exec.color,
            captured: exec.captured as PieceType | undefined,
            promotion: exec.promotion as PieceType | undefined,
          });
        }
      }

      chessRef.current = fresh;
      matchIdRef.current = `game-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      lastSavedGameRef.current = null;

      setSelectedBot(botToPlay);
      setPlayerColor(resolvedColor);
      setOrientation(resolvedColor);
      setFen(fresh.fen());
      setMoves(seedRecords);
      setViewPly(seedRecords.length);
      setHintArrows([]);
      updateQueuedPremove(null);
      if (sparringSeed && seedRecords.length > 0) {
        const baseEval = getPositionEvaluation(fresh.fen(), 2).cp;
        const playerPerspectiveCp = resolvedColor === 'w' ? baseEval : -baseEval;
        setSparringGoal({
          name: sparringSeed.name,
          summary: sparringSeed.summary,
          seedPlies: seedRecords.length,
          baselineCpForPlayer: playerPerspectiveCp,
        });
      } else {
        setSparringGoal(null);
      }
      setCoachBanner(
        sparringSeed
          ? `Sparring from ${sparringSeed.name}. Play the next 5 moves to hold the advantage against ${botToPlay.name}!`
          : null
      );
      setGameOutcome(null);
      setShowResultModal(false);
      setBotThinking(false);
      if (modalTimerRef.current) {
        window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = null;
      }
      setBotDialogue(pickDialogue(botToPlay.dialogues.greeting));

      if (timeControl.initialSeconds > 0) {
        setWhiteClock(timeControl.initialSeconds);
        setBlackClock(timeControl.initialSeconds);
      } else {
        setWhiteClock(null);
        setBlackClock(null);
      }

      setPhase('PLAYING');

      if (!fresh.isGameOver() && fresh.turn() !== resolvedColor) {
        setBotThinking(true);
        botTimerRef.current = window.setTimeout(() => {
          const move = chooseBotMove(fresh.fen(), botToPlay);
          if (move) {
            const executed = fresh.move(move);
            if (executed) {
              const rec: MoveRecord = {
                san: executed.san,
                from: executed.from,
                to: executed.to,
                fen: fresh.fen(),
                color: executed.color,
                captured: executed.captured as PieceType | undefined,
                promotion: executed.promotion as PieceType | undefined,
              };
              const nextMoves = [...seedRecords, rec];
              setFen(fresh.fen());
              setMoves(nextMoves);
              setViewPly(nextMoves.length);
              playSoundForMove(executed.san, Boolean(executed.captured), executed.promotion);
            }
          }
          setBotThinking(false);
        }, 420);
      }
    },
    [selectedBot, sideChoice, sparringSeed, timeControl.initialSeconds]
  );

  useEffect(() => {
    if (phase !== 'PLAYING' || timeControl.initialSeconds === 0) return;

    const interval = window.setInterval(() => {
      const turn = chessRef.current.turn();
      if (turn === 'w') {
        setWhiteClock((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            const playerTimedOut = playerColor === 'w';
            finalizeGame(
              playerTimedOut ? 'loss' : 'win',
              playerTimedOut ? `${selectedBot.name} Won` : 'You Won!',
              'Time Out',
              moves
            );
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackClock((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            const playerTimedOut = playerColor === 'b';
            finalizeGame(
              playerTimedOut ? 'loss' : 'win',
              playerTimedOut ? `${selectedBot.name} Won` : 'You Won!',
              'Time Out',
              moves
            );
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, timeControl.initialSeconds, playerColor, selectedBot.name, finalizeGame, moves]);

  useEffect(() => {
    return () => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
      if (modalTimerRef.current) window.clearTimeout(modalTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === 'SETUP') return;
      if (e.key === 'ArrowLeft') {
        setViewPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        setViewPly((p) => Math.min(moves.length, p + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, moves.length]);

  const handlePlayerMove = useCallback(
    (from: string, to: string, promotion?: PieceType): boolean => {
      if (phase !== 'PLAYING' || botThinking) return false;
      if (viewPly < moves.length) {
        setViewPly(moves.length);
        return false;
      }

      const c = chessRef.current;
      if (c.turn() !== playerColor) return false;

      const prevEval =
        assistMode === 'coach' ? getPositionEvaluation(c.fen(), 1).cp : 0;

      try {
        const executed = c.move({
          from: from as Square,
          to: to as Square,
          promotion: promotion || 'q',
        });
        if (!executed) return false;

        if (timeControl.incrementSeconds > 0) {
          if (playerColor === 'w') {
            setWhiteClock((prev) => (prev !== null ? prev + timeControl.incrementSeconds : null));
          } else {
            setBlackClock((prev) => (prev !== null ? prev + timeControl.incrementSeconds : null));
          }
        }

        const nextFen = c.fen();
        const rec: MoveRecord = {
          san: executed.san,
          from: executed.from,
          to: executed.to,
          fen: nextFen,
          color: executed.color,
          captured: executed.captured as PieceType | undefined,
          promotion: executed.promotion as PieceType | undefined,
        };
        const updatedMoves = [...moves, rec];

        setFen(nextFen);
        setMoves(updatedMoves);
        setViewPly(updatedMoves.length);
        setHintArrows([]);
        setCoachBanner(null);

        playSoundForMove(executed.san, Boolean(executed.captured), executed.promotion);

        if (assistMode === 'coach' && !c.isGameOver()) {
          const newEval = getPositionEvaluation(nextFen, 1).cp;
          const deltaForPlayer =
            playerColor === 'w' ? newEval - prevEval : prevEval - newEval;
          if (deltaForPlayer < -220) {
            setCoachBanner(`Coach: ${executed.san} dropped material or tempo. Takeback is available.`);
            setBotDialogue(pickDialogue(selectedBot.dialogues.capture));
          } else if (deltaForPlayer > 140) {
            setBotDialogue(pickDialogue(selectedBot.dialogues.goodMove));
          }
        }

        if (!checkAndHandleGameOver(updatedMoves)) {
          triggerBotTurn(updatedMoves);
        }
        return true;
      } catch {
        return false;
      }
    },
    [
      phase,
      botThinking,
      viewPly,
      moves,
      playerColor,
      assistMode,
      timeControl.incrementSeconds,
      selectedBot.dialogues,
      checkAndHandleGameOver,
      triggerBotTurn,
    ]
  );

  const handleHint = () => {
    if (phase !== 'PLAYING' || botThinking || assistMode === 'challenge') return;
    if (chessRef.current.turn() !== playerColor) return;
    const ranked = getRankedMoves(chessRef.current.fen(), 3, 350);
    if (ranked.length > 0) {
      const best = ranked[0].move;
      setHintArrows([{ from: best.from, to: best.to, color: '#2EB88A' }]);
      setCoachBanner(`Suggested move: ${best.san}`);
    }
  };

  const handleUndo = () => {
    if (phase !== 'PLAYING' || botThinking || assistMode === 'challenge') return;
    if (moves.length === 0) return;

    const c = chessRef.current;
    if (c.turn() === playerColor && moves.length >= 2) {
      c.undo();
      c.undo();
      const sliced = moves.slice(0, -2);
      setMoves(sliced);
      setFen(c.fen());
      setViewPly(sliced.length);
    } else if (moves.length === 1 && playerColor === 'w') {
      c.undo();
      setMoves([]);
      setFen(c.fen());
      setViewPly(0);
    }
    setHintArrows([]);
    setCoachBanner(null);
  };

  const handleResign = () => {
    if (phase !== 'PLAYING') return;
    finalizeGame('loss', `${selectedBot.name} Won`, 'Resignation', moves);
  };

  const botColor: PieceColor = playerColor === 'w' ? 'b' : 'w';
  const topColor: PieceColor = orientation === 'w' ? 'b' : 'w';
  const bottomColor: PieceColor = orientation;

  const isBotTop = topColor === botColor;

  const whiteCap = capturedInfo.capturedByWhite;
  const blackCap = capturedInfo.capturedByBlack;
  const whiteAdv = capturedInfo.whiteMaterialDiff > 0 ? capturedInfo.whiteMaterialDiff : 0;
  const blackAdv = capturedInfo.whiteMaterialDiff < 0 ? Math.abs(capturedInfo.whiteMaterialDiff) : 0;

  const currentTurn = useMemo(() => {
    try {
      return new Chess(displayedFen).turn() as PieceColor;
    } catch {
      return 'w' as PieceColor;
    }
  }, [displayedFen]);

  const sparringCheckStatus = useMemo(() => {
    if (!sparringGoal || phase === 'SETUP') return null;
    const pliesAfterSeed = Math.max(0, moves.length - sparringGoal.seedPlies);
    const playerMovesSinceSeed = Math.floor((pliesAfterSeed + (playerColor === 'w' ? 1 : 0)) / 2);
    const liveEval = getPositionEvaluation(fen, 2).cp;
    const playerLiveCp = playerColor === 'w' ? liveEval : -liveEval;
    const deltaPawns = (playerLiveCp - sparringGoal.baselineCpForPlayer) / 100;
    return {
      playerMovesSinceSeed,
      targetMoves: 5,
      deltaPawns,
      completed: playerMovesSinceSeed >= 5,
      heldAdvantage: playerLiveCp >= sparringGoal.baselineCpForPlayer - 45,
      playerLivePawns: playerLiveCp / 100,
    };
  }, [sparringGoal, phase, moves.length, playerColor, fen]);

  if (subView === 'archive') {
    return (
      <div className="space-y-2">
        {!isReviewingGame && (
          <div className="max-w-[1040px] mx-auto px-4 sm:px-6 pt-5 flex items-center justify-between">
            <div className="inline-flex items-center gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setReviewTarget(null);
                  setIsReviewingGame(false);
                  setSubView('arena');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                Bot Arena
              </button>
              <button
                type="button"
                onClick={() => setSubView('archive')}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#222C3A] text-[#F7D08A] cursor-pointer"
              >
                Match Archive ({archivedGames.length})
              </button>
            </div>
          </div>
        )}
        <ArchiveView
          preferences={preferences}
          games={archivedGames}
          initialReviewGame={reviewTarget}
          onClearInitialReview={() => {
            setReviewTarget(null);
            setIsReviewingGame(false);
          }}
          onDeleteGame={onDeleteGame}
          onClearAll={onClearAllGames}
          onPlayBots={() => {
            setReviewTarget(null);
            setIsReviewingGame(false);
            setSubView('arena');
          }}
          onDrillRepertoireLine={onDrillRepertoireLine}
          onSaveCustomPrep={onSaveCustomPrep}
          onReviewModeChange={setIsReviewingGame}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-[#161E29] border border-slate-400/12 rounded-xl">
          <button
            type="button"
            onClick={() => setSubView('arena')}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#222C3A] text-[#F7D08A] cursor-pointer"
          >
            Bot Arena
          </button>
          <button
            type="button"
            onClick={() => setSubView('archive')}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            Match Archive ({archivedGames.length})
          </button>
        </div>

        {sparringSeed && (
          <div className="flex items-center gap-2 text-xs bg-[#161E29] border border-[#E5A93C]/40 px-3 py-1.5 rounded-xl">
            <span className="text-slate-300">
              Sparring Line: <strong className="text-[#F7D08A]">{sparringSeed.name}</strong>
            </span>
            {onClearSparringSeed && (
              <button
                type="button"
                onClick={onClearSparringSeed}
                className="text-slate-400 hover:text-white underline cursor-pointer ml-1"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-7 items-start">
        {/* Left/Center Column: Board Stage */}
        <div className="flex flex-col items-center w-full">
          <div className="w-full max-w-[630px] flex flex-col gap-2">
            {isBotTop ? (
              <PlayerStrip
                name={selectedBot.name}
                elo={selectedBot.elo}
                bot={selectedBot}
                pieceColor={botColor}
                capturedPieces={botColor === 'w' ? whiteCap : blackCap}
                materialAdvantage={botColor === 'w' ? whiteAdv : blackAdv}
                pieceSet={preferences.pieceSet}
                isActiveTurn={phase === 'PLAYING' && currentTurn === botColor}
                clockSeconds={botColor === 'w' ? whiteClock : blackClock}
                dialogue={phase !== 'SETUP' ? (botThinking ? 'Calculating move...' : botDialogue) : selectedBot.tagline}
              />
            ) : (
              <PlayerStrip
                name="You"
                pieceColor={playerColor}
                capturedPieces={playerColor === 'w' ? whiteCap : blackCap}
                materialAdvantage={playerColor === 'w' ? whiteAdv : blackAdv}
                pieceSet={preferences.pieceSet}
                isActiveTurn={phase === 'PLAYING' && currentTurn === playerColor}
                clockSeconds={playerColor === 'w' ? whiteClock : blackClock}
              />
            )}

            <ChessBoard
              fen={phase === 'SETUP' ? setupSeedPreview.fen : displayedFen}
              orientation={
                phase === 'SETUP'
                  ? sparringSeed
                    ? sparringSeed.playerColor
                    : sideChoice === 'b'
                    ? 'b'
                    : 'w'
                  : orientation
              }
              boardTheme={boardTheme}
              pieceSet={preferences.pieceSet}
              coordinates={preferences.coordinates}
              showLegalMoves={preferences.showLegalMoves}
              animationSpeed={preferences.animationSpeed}
              interactive={phase === 'PLAYING' && viewPly === moves.length}
              allowedColor={playerColor}
              allowPremove={phase === 'PLAYING' && viewPly === moves.length}
              queuedPremove={queuedPremove}
              onQueuePremove={updateQueuedPremove}
              lastMove={phase === 'SETUP' ? setupSeedPreview.lastMove : displayedLastMove}
              extraArrows={hintArrows}
              showEvalBar={phase !== 'SETUP' && evalInfo.show}
              evalDisplay={evalInfo.display}
              whiteAdvantagePct={evalInfo.pct}
              onMove={handlePlayerMove}
            />

            {!isBotTop ? (
              <PlayerStrip
                name={selectedBot.name}
                elo={selectedBot.elo}
                bot={selectedBot}
                pieceColor={botColor}
                capturedPieces={botColor === 'w' ? whiteCap : blackCap}
                materialAdvantage={botColor === 'w' ? whiteAdv : blackAdv}
                pieceSet={preferences.pieceSet}
                isActiveTurn={phase === 'PLAYING' && currentTurn === botColor}
                clockSeconds={botColor === 'w' ? whiteClock : blackClock}
                dialogue={phase !== 'SETUP' ? (botThinking ? 'Calculating move...' : botDialogue) : undefined}
              />
            ) : (
              <PlayerStrip
                name="You"
                pieceColor={bottomColor}
                capturedPieces={bottomColor === 'w' ? whiteCap : blackCap}
                materialAdvantage={bottomColor === 'w' ? whiteAdv : blackAdv}
                pieceSet={preferences.pieceSet}
                isActiveTurn={phase === 'PLAYING' && currentTurn === playerColor}
                clockSeconds={playerColor === 'w' ? whiteClock : blackClock}
              />
            )}
          </div>
        </div>

        {/* Right Column: Setup OR Match Control Panel */}
        <aside className="w-full bg-[#161E29] border border-slate-400/12 rounded-2xl p-5 shadow-[0_14px_38px_rgba(0,0,0,0.3)] overflow-hidden">
          <AnimatePresence mode="wait">
            {phase === 'SETUP' ? (
              <motion.div
                key="setup-panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-100 tracking-tight">
                    Play Chess Bots
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Choose an AI opponent, pick your color, and set your match assistance.
                  </p>
                </div>

                {/* Bot Roster */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {BOTS.map((bot) => {
                    const active = selectedBot.id === bot.id;
                    const record = botStats[bot.id];
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => {
                          setSelectedBot(bot);
                          setBotDialogue(pickDialogue(bot.dialogues.greeting));
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center gap-3 ${
                          active
                            ? 'bg-[#202B3A] border-[#E5A93C]'
                            : 'bg-[#0F151E] border-slate-400/10 hover:border-slate-400/25'
                        }`}
                      >
                        <BotAvatar bot={bot} sizeClass="w-11 h-11" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-semibold text-sm text-slate-100 truncate">
                              {bot.name}
                            </span>
                            <span className="font-mono text-xs font-semibold text-[#E5A93C] tabular-nums shrink-0">
                              {bot.elo}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate">
                            <span>{bot.tier}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{bot.playstyle}</span>
                            {record && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums text-slate-200">
                                  {record.w}W-{record.l}L
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Match Options */}
                <div className="space-y-3.5 pt-3 border-t border-slate-400/12">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-300">Play as</span>
                    {sparringSeed ? (
                      <span className="text-xs font-semibold text-[#F7D08A]">
                        {sparringSeed.playerColor === 'w' ? 'White' : 'Black'} (Opening Line)
                      </span>
                    ) : (
                      <div className="grid grid-cols-3 gap-1 p-1 bg-[#0F151E] border border-slate-400/10 rounded-lg">
                        {(
                          [
                            { id: 'w', label: 'White' },
                            { id: 'random', label: 'Random' },
                            { id: 'b', label: 'Black' },
                          ] as { id: PlaySideChoice; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSideChoice(opt.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                              sideChoice === opt.id
                                ? 'bg-[#222C3A] text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-300 block">Assistance Mode</span>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-[#0F151E] border border-slate-400/10 rounded-lg">
                      {(
                        [
                          { id: 'challenge', label: 'Challenge' },
                          { id: 'friendly', label: 'Friendly' },
                          { id: 'coach', label: 'Coach' },
                        ] as { id: AssistMode; label: string }[]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setAssistMode(m.id)}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                            assistMode === m.id
                              ? 'bg-[#222C3A] text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400/80">
                      {assistMode === 'challenge' && 'No hints, no takebacks, no live eval bar.'}
                      {assistMode === 'friendly' && 'Hints, takebacks, and evaluation bar enabled.'}
                      {assistMode === 'coach' && 'Hints, takebacks, eval bar, and blunder alerts.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="time-control-select" className="text-xs font-medium text-slate-300">
                      Time Control
                    </label>
                    <select
                      id="time-control-select"
                      value={timeControl.id}
                      onChange={(e) => {
                        const found = TIME_CONTROLS.find((t) => t.id === e.target.value);
                        if (found) setTimeControl(found);
                      }}
                      className="bg-[#0F151E] border border-slate-400/15 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-[#E5A93C]"
                    >
                      {TIME_CONTROLS.map((tc) => (
                        <option key={tc.id} value={tc.id}>
                          {tc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.985 }}
                  type="button"
                  onClick={() => startMatch(selectedBot)}
                  className="w-full py-3 px-4 rounded-xl bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] font-display font-bold text-sm tracking-tight transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(229,169,60,0.22)]"
                >
                  <Swords className="w-4 h-4" />
                  <span>Play {selectedBot.name}</span>
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="active-panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-400/12">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>vs {selectedBot.name} ({selectedBot.elo})</span>
                      <span aria-hidden="true">·</span>
                      <span>{timeControl.label}</span>
                    </div>
                    <h2 className="font-display text-base font-semibold text-slate-100 truncate mt-0.5">
                      {openingName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhase('SETUP')}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] border border-slate-400/12 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New</span>
                  </button>
                </div>

                <AnimatePresence>
                  {phase === 'GAME_OVER' && gameOutcome && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="p-4 rounded-xl bg-[#0F151E] border border-slate-400/18 space-y-3"
                    >
                      <div>
                        <p
                          className={`font-display text-lg font-bold ${
                            gameOutcome.result === 'win'
                              ? 'text-[#2EB88A]'
                              : gameOutcome.result === 'loss'
                              ? 'text-[#EB6150]'
                              : 'text-[#E5A93C]'
                          }`}
                        >
                          {gameOutcome.headline}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {gameOutcome.termination} · {Math.ceil(moves.length / 2)} moves
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startMatch(selectedBot)}
                          className="py-2 px-3 rounded-lg bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Rematch
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (lastSavedGameRef.current) {
                              setReviewTarget(lastSavedGameRef.current);
                              setSubView('archive');
                            }
                          }}
                          className="py-2 px-3 rounded-lg bg-[#222C3A] hover:bg-[#2D3A4C] text-slate-100 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Analyze Game
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {sparringGoal && sparringCheckStatus && (
                  <div className="p-3 rounded-xl bg-[#0F151E] border border-slate-400/12 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-[#F7D08A] font-semibold">
                        Hold the Opening ({Math.min(5, sparringCheckStatus.playerMovesSinceSeed)}/5 moves)
                      </span>
                      <span
                        className={
                          sparringCheckStatus.heldAdvantage
                            ? 'text-[#2EB88A]'
                            : 'text-[#EB6150]'
                        }
                      >
                        {sparringCheckStatus.playerLivePawns >= 0 ? '+' : ''}
                        {sparringCheckStatus.playerLivePawns.toFixed(1)}
                      </span>
                    </div>
                    {sparringGoal.summary && (
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {sparringGoal.summary}
                      </p>
                    )}
                    {sparringCheckStatus.completed && (
                      <p
                        className={`text-xs font-semibold pt-1 border-t border-slate-400/10 ${
                          sparringCheckStatus.heldAdvantage
                            ? 'text-[#2EB88A]'
                            : 'text-[#EB6150]'
                        }`}
                      >
                        {sparringCheckStatus.heldAdvantage
                          ? 'Opening Goal Held! Smooth transition into the middlegame.'
                          : 'Initiative slipped out of book—review the deviation after the match.'}
                      </p>
                    )}
                  </div>
                )}

                <AnimatePresence>
                  {coachBanner && phase === 'PLAYING' && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      className="px-3 py-2 rounded-lg bg-[#2EB88A]/12 border border-[#2EB88A]/35 text-xs text-[#A7F3D0]"
                    >
                      {coachBanner}
                    </motion.div>
                  )}
                </AnimatePresence>

                <MoveList
                  moves={moves}
                  viewPly={viewPly}
                  onSelectPly={setViewPly}
                  maxHeightClass="h-64"
                />

                {viewPly < moves.length && (
                  <button
                    type="button"
                    onClick={() => setViewPly(moves.length)}
                    className="text-xs font-medium text-[#E5A93C] hover:underline self-center cursor-pointer"
                  >
                    Jump back to live position
                  </button>
                )}

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-400/12">
                  <button
                    type="button"
                    onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
                    className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Flip</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHint}
                    disabled={
                      phase !== 'PLAYING' ||
                      assistMode === 'challenge' ||
                      botThinking ||
                      chessRef.current.turn() !== playerColor
                    }
                    className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] disabled:opacity-35 disabled:pointer-events-none text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Lightbulb className="w-4 h-4" />
                    <span>Hint</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={
                      phase !== 'PLAYING' ||
                      assistMode === 'challenge' ||
                      botThinking ||
                      moves.length === 0
                    }
                    className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] disabled:opacity-35 disabled:pointer-events-none text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Takeback</span>
                  </button>

                  {phase === 'PLAYING' ? (
                    <button
                      type="button"
                      onClick={handleResign}
                      className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#0F151E] hover:bg-red-950/55 text-slate-300 hover:text-red-300 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <Flag className="w-4 h-4" />
                      <span>Resign</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onToggleSound}
                      className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#0F151E] hover:bg-[#222C3A] text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      {preferences.soundEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                      <span>{preferences.soundEnabled ? 'Sound On' : 'Muted'}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>

      {/* Centered Celebration / Match Result Overlay */}
      <ResultOverlayModal
        open={phase === 'GAME_OVER' && showResultModal && Boolean(gameOutcome)}
        variant={gameOutcome ? gameOutcome.result : 'draw'}
        title={gameOutcome?.headline ?? ''}
        subtitle={gameOutcome?.termination ?? ''}
        details={`${openingName} · ${Math.ceil(moves.length / 2)} moves`}
        bot={selectedBot}
        primaryLabel="Rematch"
        onPrimary={() => {
          setShowResultModal(false);
          startMatch(selectedBot);
        }}
        secondaryLabel="Analyze Game"
        onSecondary={() => {
          setShowResultModal(false);
          if (lastSavedGameRef.current) {
            setReviewTarget(lastSavedGameRef.current);
            setSubView('archive');
          }
        }}
        onClose={() => setShowResultModal(false)}
      />
    </div>
  );
};
