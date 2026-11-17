import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Crown, Handshake, ShieldAlert, X } from 'lucide-react';
import { BotProfile } from '../types/chess';
import { BotAvatar } from './BotAvatar';

export interface ResultOverlayProps {
  open: boolean;
  variant: 'win' | 'loss' | 'draw' | 'puzzle';
  title: string;
  subtitle: string;
  details?: string;
  bot?: BotProfile;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose: () => void;
}

const CELEBRATION_MOTES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 2 === 0 ? 0.08 : -0.08);
  const distance = 68 + (i % 3) * 26;
  return {
    id: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    size: i % 3 === 0 ? 7 : 5,
    color: i % 2 === 0 ? '#E5A93C' : '#2EB88A',
    delay: (i % 4) * 0.035,
  };
});

export const ResultOverlayModal: React.FC<ResultOverlayProps> = ({
  open,
  variant,
  title,
  subtitle,
  details,
  bot,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
}) => {
  const celebrate = variant === 'win' || variant === 'puzzle';

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const accentText =
    variant === 'win' || variant === 'puzzle'
      ? 'text-[#2EB88A]'
      : variant === 'loss'
      ? 'text-[#EB6150]'
      : 'text-[#E5A93C]';

  const crestBg =
    variant === 'win' || variant === 'puzzle'
      ? 'bg-[#2EB88A]/14 border-[#2EB88A]/35 text-[#2EB88A]'
      : variant === 'loss'
      ? 'bg-[#EB6150]/14 border-[#EB6150]/35 text-[#EB6150]'
      : 'bg-[#E5A93C]/14 border-[#E5A93C]/35 text-[#E5A93C]';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E131B]/68 backdrop-blur-[3px]"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[380px] rounded-2xl bg-[#161E29] border border-slate-400/18 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)] text-center overflow-visible"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
              aria-label="Close popup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Crest & Subtle Celebration Burst */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center mb-4">
              {celebrate && (
                <>
                  <motion.div
                    initial={{ scale: 0.65, opacity: 0.65 }}
                    animate={{ scale: 1.85, opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 rounded-full border-2 border-[#2EB88A]/50 pointer-events-none"
                  />
                  <motion.div
                    initial={{ scale: 0.75, opacity: 0.55 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 rounded-full border border-[#E5A93C]/50 pointer-events-none"
                  />
                  {CELEBRATION_MOTES.map((mote) => (
                    <motion.span
                      key={mote.id}
                      initial={{ x: 0, y: 0, scale: 0, opacity: 0.95 }}
                      animate={{
                        x: mote.x,
                        y: mote.y,
                        scale: [0, 1.15, 0.4],
                        opacity: [0.95, 0.9, 0],
                      }}
                      transition={{
                        duration: 1.05,
                        delay: mote.delay,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="pointer-events-none absolute rounded-xs"
                      style={{
                        width: mote.size,
                        height: mote.size,
                        backgroundColor: mote.color,
                        transform: 'rotate(45deg)',
                      }}
                    />
                  ))}
                </>
              )}

              <motion.div
                initial={{ scale: 0.75 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={`relative z-10 w-14 h-14 rounded-2xl border flex items-center justify-center ${crestBg}`}
              >
                {variant === 'win' && <Crown className="w-7 h-7" />}
                {variant === 'puzzle' && <CheckCircle2 className="w-7 h-7" />}
                {variant === 'draw' && <Handshake className="w-7 h-7" />}
                {variant === 'loss' && <ShieldAlert className="w-7 h-7" />}
              </motion.div>
            </div>

            {/* Title & Match / Puzzle Metadata */}
            <h2 className={`font-display text-2xl font-extrabold tracking-tight ${accentText}`}>
              {title}
            </h2>
            <p className="text-sm font-medium text-slate-200 mt-1">{subtitle}</p>
            {details && (
              <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">{details}</p>
            )}

            {/* Optional Bot Summary Strip */}
            {bot && (
              <div className="mt-4 flex items-center justify-center gap-2.5 py-2 px-3 rounded-xl bg-[#0F151E] border border-slate-400/12">
                <BotAvatar bot={bot} sizeClass="w-8 h-8" />
                <div className="text-left min-w-0">
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    vs {bot.name} ({bot.elo})
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{bot.playstyle}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 space-y-2">
              <div className={`grid gap-2 ${secondaryLabel && onSecondary ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  type="button"
                  onClick={onPrimary}
                  className="py-2.5 px-4 rounded-xl bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] font-display font-bold text-xs tracking-tight transition-colors cursor-pointer whitespace-nowrap"
                >
                  {primaryLabel}
                </button>
                {secondaryLabel && onSecondary && (
                  <button
                    type="button"
                    onClick={onSecondary}
                    className="py-2.5 px-4 rounded-xl bg-[#222C3A] hover:bg-[#2D3A4C] text-slate-100 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {secondaryLabel}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Inspect Board
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
