import React from 'react';
import { Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TwoPlayerTacticsOverlayProps {
  p1Locked?: boolean;
  p2Locked?: boolean;
  countdown: number | null; // e.g. 3, 2, 1 or null
  onToggleP1Lock?: () => void;
  onToggleP2Lock?: () => void;
  onP1Preset?: (preset: 'triangle' | 'wall' | 'spread') => void;
  onP2Preset?: (preset: 'triangle' | 'wall' | 'spread') => void;
  onQuickStart: () => void;
  isCpuOpponent?: boolean;
  cpuName?: string;
  cpuBadge?: string;
  tournamentRoundName?: string;
}

export const TwoPlayerTacticsOverlay: React.FC<TwoPlayerTacticsOverlayProps> = ({
  countdown,
  onQuickStart,
  isCpuOpponent,
  cpuName,
}) => {
  return (
    <div
      id="two-player-tactics-overlay"
      className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center p-3 sm:p-5 font-sans select-none overflow-hidden"
    >
      {/* Center Pitch: Prominent Kick Off Match Button or Countdown */}
      <AnimatePresence mode="wait">
        {countdown !== null ? (
          <motion.div
            key={`countdown-${countdown}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="px-8 py-3.5 bg-amber-400 text-black border-[3px] border-black rounded-3xl shadow-[0_6px_0_#000] flex flex-col items-center pointer-events-auto"
          >
            <span className="text-4xl sm:text-6xl font-black italic tracking-tighter uppercase leading-none">
              {countdown > 0 ? countdown : 'KICK OFF!'}
            </span>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center pointer-events-auto"
          >
            <button
              id="btn-two-player-kickoff"
              type="button"
              onClick={onQuickStart}
              className="group px-7 sm:px-9 py-2.5 sm:py-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-black border-[3px] border-black rounded-full font-black text-xs sm:text-sm md:text-base uppercase tracking-wider flex items-center gap-2.5 shadow-[0_4px_0_#000] cursor-pointer transition-all touch-manipulation"
            >
              <Play size={16} className="fill-black group-hover:translate-x-0.5 transition-transform" />
              <span>KICK OFF MATCH</span>
            </button>

            {/* 2-Player Shared Keyboard Controls Guide */}
            {!isCpuOpponent && (
              <div className="mt-3 flex items-center gap-2 sm:gap-4 bg-black/90 backdrop-blur-xs border-2 border-black rounded-2xl px-3.5 py-2 shadow-[0_3px_0_#000]">
                <div className="flex flex-col items-center border-r border-white/20 pr-2.5 sm:pr-3.5">
                  <span className="text-[9px] sm:text-[10px] font-black text-amber-300 uppercase tracking-wider">
                    {cpuName ? `${cpuName.toUpperCase()}` : 'PLAYER 2 (TOP)'}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-white/90 mt-0.5">
                    <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-white/20 text-amber-300">A</kbd> <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-white/20 text-amber-300">D</kbd> Flippers • <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-white/20 text-amber-300">Space</kbd>
                  </span>
                </div>
                <div className="flex flex-col items-center pl-1">
                  <span className="text-[9px] sm:text-[10px] font-black text-sky-400 uppercase tracking-wider">
                    PLAYER 1 (BOTTOM)
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-white/90 mt-0.5">
                    <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-white/20 text-sky-400">&larr;</kbd> <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-white/20 text-sky-400">&rarr;</kbd> Flippers • <kbd className="bg-neutral-800 px-1 py-0.5 rounded border border-white/20 text-sky-400">&darr;</kbd>
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
