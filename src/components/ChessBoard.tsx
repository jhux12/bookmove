import { Modal } from './ui/Modal';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  AnimationSpeed,
  BoardArrow,
  BoardTheme,
  CoordinateStyle,
  PieceColor,
  PieceSetId,
  PieceType,
} from '../types/chess';
import { ChessPieceSvg } from './ChessPieceSvg';

interface ChessBoardProps {
  fen: string;
  orientation?: PieceColor;
  boardTheme: BoardTheme;
  pieceSet: PieceSetId;
  coordinates: CoordinateStyle;
  showLegalMoves: boolean;
  animationSpeed?: AnimationSpeed;
  interactive?: boolean;
  allowedColor?: PieceColor | 'both';
  lastMove?: { from: string; to: string } | null;
  extraArrows?: BoardArrow[];
  showEvalBar?: boolean;
  evalDisplay?: string;
  whiteAdvantagePct?: number;
  allowPremove?: boolean;
  queuedPremove?: { from: string; to: string } | null;
  onQueuePremove?: (move: { from: string; to: string } | null) => void;
  moveBadge?: {
    square: string;
    type: 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  } | null;
  onMove: (from: string, to: string, promotion?: PieceType) => boolean;
}

interface TrackedPiece {
  id: string;
  square: string;
  type: PieceType;
  color: PieceColor;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function squareToCoords(sq: string, orientation: PieceColor): { col: number; row: number } {
  const fileIdx = FILES.indexOf(sq[0]);
  const rankIdx = RANKS.indexOf(sq[1]);
  if (orientation === 'w') {
    return { col: fileIdx, row: rankIdx };
  }
  return { col: 7 - fileIdx, row: 7 - rankIdx };
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation = 'w',
  boardTheme,
  pieceSet,
  coordinates,
  showLegalMoves,
  animationSpeed = 'snappy',
  interactive = true,
  allowedColor = 'both',
  lastMove = null,
  extraArrows = [],
  showEvalBar = false,
  evalDisplay = '0.0',
  whiteAdvantagePct = 50,
  allowPremove = false,
  queuedPremove = null,
  onQueuePremove,
  moveBadge = null,
  onMove,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [focusedSquare, setFocusedSquare] = useState('e2');
  const [keyboardMessage, setKeyboardMessage] = useState('');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: PieceColor;
  } | null>(null);

  const [highlightedSquares, setHighlightedSquares] = useState<Record<string, string>>({});
  const [userArrows, setUserArrows] = useState<BoardArrow[]>([]);
  const rightDragStartRef = useRef<string | null>(null);

  const [dragState, setDragState] = useState<{
    from: string;
    piece: { type: PieceType; color: PieceColor };
    x: number;
    y: number;
    squareSize: number;
  } | null>(null);

  const pointerDownInfo = useRef<{
    square: string;
    startX: number;
    startY: number;
    piece: { type: PieceType; color: PieceColor } | null;
  } | null>(null);

  const dragFromRef = useRef<{ from: string } | null>(null);
  const justDroppedToRef = useRef<string | null>(null);

  // Stable piece IDs for smooth GPU glide transitions across moves
  const prevSquareMapRef = useRef<Map<string, TrackedPiece>>(new Map());
  const pieceCounterRef = useRef<number>(1);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const boardMatrix = useMemo(() => chess.board(), [chess]);

  const trackedPieces = useMemo(() => {
    const prevMap = prevSquareMapRef.current;
    const nextMap = new Map<string, TrackedPiece>();
    const claimedIds = new Set<string>();

    // Helper to read board piece at algebraic square
    const newSquares = new Map<string, { type: PieceType; color: PieceColor }>();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = boardMatrix[r][c];
        if (cell) {
          newSquares.set(`${FILES[c]}${RANKS[r]}`, {
            type: cell.type as PieceType,
            color: cell.color as PieceColor,
          });
        }
      }
    }

    // 1. Transfer identity along lastMove (and castling rook)
    if (lastMove && prevMap.has(lastMove.from) && newSquares.has(lastMove.to)) {
      const prevPiece = prevMap.get(lastMove.from)!;
      const newPiece = newSquares.get(lastMove.to)!;
      if (prevPiece.color === newPiece.color) {
        nextMap.set(lastMove.to, {
          id: prevPiece.id,
          square: lastMove.to,
          type: newPiece.type,
          color: newPiece.color,
        });
        claimedIds.add(prevPiece.id);

        // Castling rook transfer
        if (prevPiece.type === 'k') {
          const castleRookMap: Record<string, [string, string]> = {
            'e1-g1': ['h1', 'f1'],
            'e1-c1': ['a1', 'd1'],
            'e8-g8': ['h8', 'f8'],
            'e8-c8': ['a8', 'd8'],
          };
          const rookMove = castleRookMap[`${lastMove.from}-${lastMove.to}`];
          if (rookMove) {
            const [rFrom, rTo] = rookMove;
            const prevRook = prevMap.get(rFrom);
            const newRook = newSquares.get(rTo);
            if (prevRook && newRook && prevRook.type === 'r' && prevRook.color === newRook.color) {
              nextMap.set(rTo, {
                id: prevRook.id,
                square: rTo,
                type: 'r',
                color: newRook.color,
              });
              claimedIds.add(prevRook.id);
            }
          }
        }
      }
    }

    // 2. Keep stationary pieces at the exact same square
    for (const [sq, np] of newSquares.entries()) {
      if (nextMap.has(sq)) continue;
      const prev = prevMap.get(sq);
      if (prev && !claimedIds.has(prev.id) && prev.type === np.type && prev.color === np.color) {
        nextMap.set(sq, { ...prev, square: sq });
        claimedIds.add(prev.id);
      }
    }

    // 3. Match remaining pieces by type/color (handles Undo, Takeback, and VCR backward stepping smoothly)
    const unclaimedPrev = Array.from(prevMap.values()).filter((p) => !claimedIds.has(p.id));
    for (const [sq, np] of newSquares.entries()) {
      if (nextMap.has(sq)) continue;
      // Only match 1-to-1 if counts match reasonably; pick closest Manhattan square
      let bestIdx = -1;
      let bestDist = Infinity;
      const targetCoords = squareToCoords(sq, 'w');
      for (let i = 0; i < unclaimedPrev.length; i++) {
        const cand = unclaimedPrev[i];
        if (cand.type === np.type && cand.color === np.color) {
          const cCoords = squareToCoords(cand.square, 'w');
          const d = Math.abs(cCoords.col - targetCoords.col) + Math.abs(cCoords.row - targetCoords.row);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
      }
      if (bestIdx >= 0) {
        const matched = unclaimedPrev.splice(bestIdx, 1)[0];
        nextMap.set(sq, {
          id: matched.id,
          square: sq,
          type: np.type,
          color: np.color,
        });
        claimedIds.add(matched.id);
      } else {
        const freshId = `piece-${pieceCounterRef.current++}`;
        nextMap.set(sq, {
          id: freshId,
          square: sq,
          type: np.type,
          color: np.color,
        });
      }
    }

    prevSquareMapRef.current = nextMap;
    return Array.from(nextMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [boardMatrix, lastMove]);

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
    setUserArrows([]);
    setHighlightedSquares({});
    const timer = window.setTimeout(() => {
      justDroppedToRef.current = null;
    }, 60);
    return () => window.clearTimeout(timer);
  }, [fen]);

  const isPremoveTurn = useMemo(() => {
    if (!allowPremove || !interactive || chess.isGameOver()) return false;
    if (allowedColor === 'both') return false;
    return chess.turn() !== allowedColor;
  }, [allowPremove, interactive, chess, allowedColor]);

  const isColorInteractive = useCallback(
    (color: PieceColor) => {
      if (!interactive) return false;
      if (chess.isGameOver()) return false;
      if (allowedColor === 'both') return chess.turn() === color;
      if (allowPremove && allowedColor === color && chess.turn() !== color) return true;
      return allowedColor === color && chess.turn() === color;
    },
    [interactive, chess, allowedColor, allowPremove]
  );

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Map<string, boolean>();
    if (isPremoveTurn) {
      // In premove mode, any other square is a candidate destination
      const map = new Map<string, boolean>();
      for (const r of RANKS) {
        for (const f of FILES) {
          const sq = `${f}${r}`;
          if (sq !== selectedSquare) map.set(sq, false);
        }
      }
      return map;
    }
    const moves = chess.moves({ square: selectedSquare as Square, verbose: true });
    const map = new Map<string, boolean>();
    for (const m of moves) {
      map.set(m.to, Boolean(m.captured));
    }
    return map;
  }, [chess, selectedSquare, isPremoveTurn]);

  const kingInCheckSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = boardMatrix[r][c];
        if (cell && cell.type === 'k' && cell.color === turn) {
          return `${FILES[c]}${RANKS[r]}`;
        }
      }
    }
    return null;
  }, [chess, boardMatrix]);

  const tryExecuteMove = useCallback(
    (from: string, to: string, wasDrag = false) => {
      if (from === to) return false;

      if (isPremoveTurn && onQueuePremove) {
        onQueuePremove({ from, to });
        setSelectedSquare(null);
        return true;
      }

      const legal = chess.moves({ square: from as Square, verbose: true });
      const matching = legal.filter((m) => m.to === to);
      if (matching.length === 0) return false;

      if (matching.some((m) => m.promotion)) {
        const piece = chess.get(from as Square);
        if (piece) {
          setPendingPromotion({ from, to, color: piece.color });
          return true;
        }
      }

      if (wasDrag) {
        justDroppedToRef.current = to;
      }
      const moved = onMove(from, to);
      if (moved) {
        setSelectedSquare(null);
      } else {
        justDroppedToRef.current = null;
      }
      return moved;
    },
    [chess, onMove, isPremoveTurn, onQueuePremove]
  );

  const getSquareFromPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = boardRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
      const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
      if (col < 0 || col > 7 || row < 0 || row > 7) return null;
      const file = orientation === 'w' ? FILES[col] : FILES[7 - col];
      const rank = orientation === 'w' ? RANKS[row] : RANKS[7 - row];
      return `${file}${rank}`;
    },
    [orientation]
  );

  const handlePointerDown = (
    e: React.PointerEvent,
    sq: string,
    piece: { type: PieceType; color: PieceColor } | null
  ) => {
    if (pendingPromotion) return;

    if (e.button === 2) {
      e.preventDefault();
      if (queuedPremove && onQueuePremove) {
        onQueuePremove(null);
      }
      rightDragStartRef.current = sq;
      return;
    }

    if (e.button !== 0) return;

    if (userArrows.length > 0 || Object.keys(highlightedSquares).length > 0) {
      setUserArrows([]);
      setHighlightedSquares({});
    }

    if (selectedSquare && legalTargets.has(sq)) {
      if (isPremoveTurn && piece && piece.color === allowedColor) {
        // Clicking another friendly piece while premoving switches selection instead
        pointerDownInfo.current = {
          square: sq,
          startX: e.clientX,
          startY: e.clientY,
          piece,
        };
        return;
      }
      tryExecuteMove(selectedSquare, sq, false);
      pointerDownInfo.current = null;
      return;
    }

    if (piece && isColorInteractive(piece.color)) {
      pointerDownInfo.current = {
        square: sq,
        startX: e.clientX,
        startY: e.clientY,
        piece,
      };
    } else {
      setSelectedSquare(null);
      pointerDownInfo.current = null;
    }
  };

  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      const info = pointerDownInfo.current;
      if (!info || !info.piece) return;

      const dist = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
      if (dist > 5) {
        const rect = boardRef.current?.getBoundingClientRect();
        const sqSize = rect ? rect.width / 8 : 64;
        setSelectedSquare(info.square);
        dragFromRef.current = { from: info.square };
        setDragState({
          from: info.square,
          piece: info.piece,
          x: e.clientX,
          y: e.clientY,
          squareSize: sqSize,
        });
      }
    };

    const handleGlobalUp = (e: PointerEvent) => {
      if (e.button === 2 && rightDragStartRef.current) {
        const endSq = getSquareFromPoint(e.clientX, e.clientY);
        const startSq = rightDragStartRef.current;
        rightDragStartRef.current = null;
        if (!endSq) return;

        const color = e.shiftKey ? '#59A6E8' : e.altKey ? '#2EB88A' : '#EB6150';

        if (endSq === startSq) {
          setHighlightedSquares((prev) => {
            const next = { ...prev };
            if (next[startSq] === color) {
              delete next[startSq];
            } else {
              next[startSq] = color;
            }
            return next;
          });
        } else {
          setUserArrows((prev) => {
            const exists = prev.findIndex((a) => a.from === startSq && a.to === endSq);
            if (exists >= 0) {
              return prev.filter((_, i) => i !== exists);
            }
            return [...prev, { from: startSq, to: endSq, color }];
          });
        }
        return;
      }

      const info = pointerDownInfo.current;
      if (!info) return;

      const dropSq = getSquareFromPoint(e.clientX, e.clientY);
      const activeDrag = dragFromRef.current;
      if (activeDrag) {
        if (dropSq && dropSq !== activeDrag.from) {
          tryExecuteMove(activeDrag.from, dropSq, true);
        }
        dragFromRef.current = null;
        setDragState(null);
      } else if (info.piece) {
        setSelectedSquare((prev) => (prev === info.square ? null : info.square));
      }
      pointerDownInfo.current = null;
    };

    const cancelPointer = () => { pointerDownInfo.current = null; dragFromRef.current = null; rightDragStartRef.current = null; setDragState(null); };
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    return () => {
      window.removeEventListener('pointercancel', cancelPointer);
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
    };
  }, [getSquareFromPoint, tryExecuteMove]);

  const orderedRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();
  const orderedFiles = orientation === 'w' ? FILES : [...FILES].reverse();

  const allArrows = useMemo(() => [...extraArrows, ...userArrows], [extraArrows, userArrows]);

  const baseDurationMs =
    animationSpeed === 'instant' ? 0 : animationSpeed === 'smooth' ? 260 : 170;

  const clampedPct = Math.max(4, Math.min(96, whiteAdvantagePct));
  const whiteLeading = clampedPct >= 50;

  return (
    <div className="flex items-stretch gap-3 w-full select-none">
      <span className="sr-only" aria-live="polite">{keyboardMessage}</span>
      {/* Evaluation Bar */}
      {showEvalBar && (
        <div
          className="relative w-6 sm:w-7 shrink-0 rounded-lg overflow-hidden bg-[#11161E] ring-1 ring-slate-400/15 flex flex-col justify-between"
          aria-label={`Position evaluation ${evalDisplay}`}
        >
          <div className="relative w-full h-full bg-[#253040]">
            <div
              className="absolute left-0 right-0 bg-[#F1F5F9] transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                height: `${clampedPct}%`,
                bottom: orientation === 'w' ? 0 : undefined,
                top: orientation === 'b' ? 0 : undefined,
              }}
            />
          </div>
          <span
            className={`absolute left-0 right-0 text-center font-mono text-[10px] font-bold tabular-nums px-0.5 pointer-events-none ${
              (orientation === 'w' && whiteLeading) || (orientation === 'b' && !whiteLeading)
                ? orientation === 'w'
                  ? 'bottom-1.5 text-[#0E131B]'
                  : 'bottom-1.5 text-[#F1F5F9]'
                : orientation === 'w'
                ? 'top-1.5 text-[#F1F5F9]'
                : 'top-1.5 text-[#0E131B]'
            }`}
          >
            {evalDisplay}
          </span>
        </div>
      )}

      {/* Main Board Frame */}
      <div
        className={`relative flex-1 aspect-square rounded-xl overflow-hidden ring-1 ring-slate-300/12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
          coordinates === 'outside' ? 'p-5 sm:p-6' : 'p-1.5'
        }`}
        style={{ backgroundColor: boardTheme.frameColor }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Outside coordinates */}
        {coordinates === 'outside' && (
          <>
            <div className="pointer-events-none absolute inset-x-6 bottom-1 flex justify-around text-[11px] font-mono font-semibold text-slate-300/60">
              {orderedFiles.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-6 left-1.5 flex flex-col justify-around text-[11px] font-mono font-semibold text-slate-300/60">
              {orderedRanks.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>
          </>
        )}

        {/* 8x8 Square Grid */}
        <div
          ref={boardRef}
          role="group"
          aria-label={interactive ? 'Chessboard. Use arrow keys to focus a square, Enter or Space to select and move, and Escape to clear selection.' : 'Chessboard position'}
          className="relative w-full h-full grid grid-cols-8 grid-rows-8 rounded-lg overflow-hidden touch-none"
        >
          {orderedRanks.map((rank, visualRow) =>
            orderedFiles.map((file, visualCol) => {
              const sq = `${file}${rank}`;
              const fileIdx = FILES.indexOf(file);
              const rankIdx = RANKS.indexOf(rank);
              const isLight = (fileIdx + rankIdx) % 2 === 0;
              const piece = boardMatrix[rankIdx][fileIdx];

              const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const isSelected = selectedSquare === sq;
              const isLegal = !isPremoveTurn && legalTargets.has(sq);
              const isCaptureTarget = !isPremoveTurn && legalTargets.get(sq) === true;
              const isPremoveSq =
                queuedPremove && (queuedPremove.from === sq || queuedPremove.to === sq);
              const isCheck = kingInCheckSquare === sq;
              const userHighlight = highlightedSquares[sq];

              let bgColor = isLight ? boardTheme.lightSquare : boardTheme.darkSquare;
              if (isLastMove || isSelected) {
                bgColor = isLight ? boardTheme.highlightLight : boardTheme.highlightDark;
              }

              const coordColor = isLight ? boardTheme.coordOnLight : boardTheme.coordOnDark;
              const showRankCoord = coordinates === 'inside' && visualCol === 0;
              const showFileCoord = coordinates === 'inside' && visualRow === 7;

              return (
                <div
                  key={sq}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive && focusedSquare === sq ? 0 : -1}
                  aria-label={`${sq}${piece ? `, ${piece.color === 'w' ? 'White' : 'Black'} ${{p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}[piece.type]}` : ', empty'}${isSelected ? ', selected' : ''}${isLegal ? ', legal destination' : ''}${isCheck ? ', in check' : ''}`}
                  aria-pressed={interactive ? isSelected : undefined}
                  onFocus={() => setFocusedSquare(sq)}
                  onKeyDown={(e) => {
                    if (!interactive) return;
                    const directions: Record<string, [number, number]> = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
                    if (directions[e.key]) {
                      e.preventDefault();
                      const [dx,dy] = directions[e.key];
                      const target = `${orderedFiles[Math.max(0, Math.min(7, visualCol + dx))]}${orderedRanks[Math.max(0, Math.min(7, visualRow + dy))]}`;
                      setFocusedSquare(target);
                      boardRef.current?.querySelector<HTMLElement>(`[data-square="${target}"]`)?.focus({preventScroll:true});
                    } else if (e.key === 'Escape') {
                      setSelectedSquare(null); setKeyboardMessage('Selection cleared.');
                    } else if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (selectedSquare && legalTargets.has(sq)) {
                        const from = selectedSquare;
                        if (tryExecuteMove(from, sq, false)) setKeyboardMessage(`Moved from ${from} to ${sq}.`);
                      } else if (piece && isColorInteractive(piece.color)) {
                        setSelectedSquare(isSelected ? null : sq);
                        setKeyboardMessage(isSelected ? 'Selection cleared.' : `${sq} selected. Use arrow keys to choose a destination and Enter to move.`);
                      } else setKeyboardMessage('Choose one of your pieces or a legal destination.');
                    }
                  }}
                  onPointerDown={(e) =>
                    handlePointerDown(
                      e,
                      sq,
                      piece ? { type: piece.type as PieceType, color: piece.color as PieceColor } : null
                    )
                  }
                  className="relative flex items-center justify-center cursor-pointer transition-colors duration-150"
                  style={{ backgroundColor: bgColor }}
                  data-square={sq}
                >
                  {isPremoveSq && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: 'rgba(235, 97, 80, 0.42)' }}
                    />
                  )}

                  {userHighlight && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-65"
                      style={{ backgroundColor: userHighlight }}
                    />
                  )}

                  {isCheck && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(220,38,38,0.88) 0%, rgba(220,38,38,0.45) 55%, rgba(220,38,38,0) 78%)',
                      }}
                    />
                  )}

                  {showRankCoord && (
                    <span
                      className="pointer-events-none absolute top-0.5 left-1 text-[10px] sm:text-[11px] font-mono font-bold leading-none"
                      style={{ color: coordColor }}
                    >
                      {rank}
                    </span>
                  )}

                  {showFileCoord && (
                    <span
                      className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] sm:text-[11px] font-mono font-bold leading-none"
                      style={{ color: coordColor }}
                    >
                      {file}
                    </span>
                  )}

                  {/* Legal Move Indicator */}
                  {showLegalMoves && isLegal && !isCaptureTarget && (
                    <div className="pointer-events-none absolute z-20 w-[26%] h-[26%] rounded-full bg-[#0E131B]/25 transition-transform duration-150 scale-100" />
                  )}
                  {showLegalMoves && isLegal && isCaptureTarget && (
                    <div className="pointer-events-none absolute z-20 inset-[6%] rounded-full border-[4px] sm:border-[5px] border-[#0E131B]/25" />
                  )}
                </div>
              );
            })
          )}

          {/* Smooth GPU-Composited Gliding Piece Layer */}
          <div className="pointer-events-none absolute inset-0 z-10">
            {trackedPieces.map((tp) => {
              const { col, row } = squareToCoords(tp.square, orientation);
              const isDraggingThis = dragState?.from === tp.square;
              const skipTransition = justDroppedToRef.current === tp.square;
              const durationMs = skipTransition ? 0 : baseDurationMs;

              return (
                <div
                  key={tp.id}
                  className="chess-piece-glide absolute top-0 left-0 w-[12.5%] h-[12.5%] flex items-center justify-center"
                  style={{
                    transform: `translate3d(${col * 100}%, ${row * 100}%, 0)`,
                    transitionDuration: `${durationMs}ms`,
                    opacity: isDraggingThis ? 0.2 : 1,
                  }}
                >
                  <div className="w-[86%] h-[86%]">
                    <ChessPieceSvg type={tp.type} color={tp.color} pieceSet={pieceSet} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* On-Board Move Classification Badge */}
          {moveBadge && (() => {
            const { col, row } = squareToCoords(moveBadge.square, orientation);
            const badgeStyleMap: Record<
              NonNullable<ChessBoardProps['moveBadge']>['type'],
              { bg: string; label: string }
            > = {
              book: { bg: '#A88865', label: 'Book' },
              best: { bg: '#81B64C', label: '★' },
              excellent: { bg: '#96BC4B', label: '!' },
              good: { bg: '#96BC4B', label: '✓' },
              inaccuracy: { bg: '#F7C631', label: '?!' },
              mistake: { bg: '#E6912C', label: '?' },
              blunder: { bg: '#CA3431', label: '??' },
            };
            const meta = badgeStyleMap[moveBadge.type];
            return (
              <div
                className="pointer-events-none absolute top-0 left-0 w-[12.5%] h-[12.5%] z-20"
                style={{ transform: `translate3d(${col * 100}%, ${row * 100}%, 0)` }}
              >
                <div
                  className="absolute -top-1 -right-1 w-[38%] h-[38%] min-w-[18px] min-h-[18px] rounded-full border-2 border-[#161E29] shadow-md flex items-center justify-center text-white font-display font-extrabold text-[10px] leading-none"
                  style={{ backgroundColor: meta.bg }}
                >
                  {moveBadge.type === 'book' ? (
                    <svg viewBox="0 0 24 24" className="w-[62%] h-[62%]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  ) : (
                    <span>{meta.label}</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SVG Arrow Overlay */}
          {allArrows.length > 0 && (
            <svg
              viewBox="0 0 800 800"
              className="pointer-events-none absolute inset-0 w-full h-full z-20"
            >
              <defs>
                {allArrows.map((arrow, idx) => (
                  <marker
                    key={`marker-${idx}`}
                    id={`arrowhead-${idx}`}
                    markerWidth="4"
                    markerHeight="4"
                    refX="2.5"
                    refY="2"
                    orient="auto"
                  >
                    <polygon points="0 0, 3.6 2, 0 4" fill={arrow.color} />
                  </marker>
                ))}
              </defs>
              {allArrows.map((arrow, idx) => {
                const start = squareToCoords(arrow.from, orientation);
                const end = squareToCoords(arrow.to, orientation);
                const x1 = start.col * 100 + 50;
                const y1 = start.row * 100 + 50;
                const x2 = end.col * 100 + 50;
                const y2 = end.row * 100 + 50;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy) || 1;
                const shorten = 22;
                const ex = x2 - (dx / len) * shorten;
                const ey = y2 - (dy / len) * shorten;

                return (
                  <line
                    key={`${arrow.from}-${arrow.to}-${idx}`}
                    x1={x1}
                    y1={y1}
                    x2={ex}
                    y2={ey}
                    stroke={arrow.color}
                    strokeWidth="14"
                    strokeLinecap="round"
                    opacity="0.85"
                    markerEnd={`url(#arrowhead-${idx})`}
                  />
                );
              })}
            </svg>
          )}

          {/* Pawn Promotion Picker Overlay */}
          <AnimatePresence>
            {pendingPromotion && (
              <Modal label="Choose promotion piece" onClose={() => setPendingPromotion(null)} className="max-w-xs">
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.94, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-[#161E29] border border-slate-400/20 rounded-xl p-3 shadow-2xl flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(['q', 'r', 'b', 'n'] as const).map((promo) => (
                    <button
                      key={promo}
                      type="button"
                      onClick={() => {
                        onMove(pendingPromotion.from, pendingPromotion.to, promo);
                        setPendingPromotion(null);
                        setSelectedSquare(null);
                      }}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-[#222C3A] hover:bg-[#E5A93C]/25 border border-slate-400/15 hover:border-[#E5A93C] p-1.5 transition-colors cursor-pointer"
                      aria-label={`Promote to ${{q:'queen',r:'rook',b:'bishop',n:'knight'}[promo]}`}
                    >
                      <ChessPieceSvg
                        type={promo}
                        color={pendingPromotion.color}
                        pieceSet={pieceSet}
                      />
                    </button>
                  ))}
                </motion.div>
              </Modal>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Dragged Piece */}
      {dragState && (
        <div
          className="fixed pointer-events-none z-50 drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)]"
          style={{
            left: dragState.x - dragState.squareSize * 0.5,
            top: dragState.y - dragState.squareSize * 0.5,
            width: dragState.squareSize,
            height: dragState.squareSize,
          }}
        >
          <ChessPieceSvg
            type={dragState.piece.type}
            color={dragState.piece.color}
            pieceSet={pieceSet}
          />
        </div>
      )}
    </div>
  );
};
