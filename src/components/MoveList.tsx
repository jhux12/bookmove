import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { MoveRecord } from '../types/chess';

interface MoveListProps {
  moves: MoveRecord[];
  viewPly: number;
  onSelectPly: (ply: number) => void;
  maxHeightClass?: string;
}

export const MoveList: React.FC<MoveListProps> = ({
  moves,
  viewPly,
  onSelectPly,
  maxHeightClass = 'h-56',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && viewPly === moves.length) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [moves.length, viewPly]);

  const pairs: { moveNumber: number; white?: MoveRecord; whitePly: number; black?: MoveRecord; blackPly?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      whitePly: i + 1,
      black: moves[i + 1],
      blackPly: moves[i + 1] ? i + 2 : undefined,
    });
  }

  return (
    <div className="flex flex-col border border-slate-400/12 rounded-xl bg-[#0F151E] overflow-hidden">
      <div
        ref={scrollRef}
        className={`${maxHeightClass} overflow-y-auto px-2 py-1.5 text-sm font-mono tabular-nums`}
      >
        {pairs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-sans text-slate-400/60 py-8">
            No moves played yet
          </div>
        ) : (
          <div className="space-y-0.5">
            {pairs.map((row) => (
              <div
                key={row.moveNumber}
                className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 text-[13px]"
              >
                <span className="text-slate-500 pl-1.5 select-none">{row.moveNumber}.</span>
                {row.white && (
                  <button
                    type="button"
                    onClick={() => onSelectPly(row.whitePly)}
                    className={`text-left px-2 py-1 rounded-md transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      viewPly === row.whitePly
                        ? 'bg-[#E5A93C]/22 text-[#F7D08A] font-semibold'
                        : 'text-slate-200 hover:bg-white/6'
                    }`}
                  >
                    {row.white.san}
                  </button>
                )}
                {row.black ? (
                  <button
                    type="button"
                    onClick={() => onSelectPly(row.blackPly!)}
                    className={`text-left px-2 py-1 rounded-md transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      viewPly === row.blackPly
                        ? 'bg-[#E5A93C]/22 text-[#F7D08A] font-semibold'
                        : 'text-slate-200 hover:bg-white/6'
                    }`}
                  >
                    {row.black.san}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VCR Navigation Bar */}
      <div className="grid grid-cols-4 border-t border-slate-400/12 bg-[#141C27]">
        <button
          type="button"
          onClick={() => onSelectPly(0)}
          disabled={viewPly <= 0}
          className="flex items-center justify-center py-2 text-slate-300 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          aria-label="First position"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onSelectPly(Math.max(0, viewPly - 1))}
          disabled={viewPly <= 0}
          className="flex items-center justify-center py-2 text-slate-300 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          aria-label="Previous move"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onSelectPly(Math.min(moves.length, viewPly + 1))}
          disabled={viewPly >= moves.length}
          className="flex items-center justify-center py-2 text-slate-300 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          aria-label="Next move"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onSelectPly(moves.length)}
          disabled={viewPly >= moves.length}
          className="flex items-center justify-center py-2 text-slate-300 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          aria-label="Latest position"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
