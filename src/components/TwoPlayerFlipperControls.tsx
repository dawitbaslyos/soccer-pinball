import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TwoPlayerFlipperControlsProps {
  onP1LeftDown: () => void;
  onP1LeftUp: () => void;
  onP1RightDown: () => void;
  onP1RightUp: () => void;
  onP2LeftDown: () => void;
  onP2LeftUp: () => void;
  onP2RightDown: () => void;
  onP2RightUp: () => void;
  isCpuOpponent?: boolean;
}

export const TwoPlayerFlipperControls: React.FC<TwoPlayerFlipperControlsProps> = ({
  onP1LeftDown,
  onP1LeftUp,
  onP1RightDown,
  onP1RightUp,
  onP2LeftDown,
  onP2LeftUp,
  onP2RightDown,
  onP2RightUp,
  isCpuOpponent = false,
}) => {
  const [p1LeftDismissed, setP1LeftDismissed] = useState(false);
  const [p1RightDismissed, setP1RightDismissed] = useState(false);
  const [p2LeftDismissed, setP2LeftDismissed] = useState(false);
  const [p2RightDismissed, setP2RightDismissed] = useState(false);

  // Sync keyboard visual feedback & flipper actuation (A/D, Left/Right arrows, Touch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // P1 controls (used in Tournament CPU matches and 2-Player matches)
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        setP1LeftDismissed(true);
        if (isCpuOpponent) {
          onP1LeftDown();
        } else if (e.code === 'ArrowLeft') {
          onP1LeftDown();
        } else if (e.code === 'KeyA') {
          onP2LeftDown();
        }
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        setP1RightDismissed(true);
        if (isCpuOpponent) {
          onP1RightDown();
        } else if (e.code === 'ArrowRight') {
          onP1RightDown();
        } else if (e.code === 'KeyD') {
          onP2RightDown();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (isCpuOpponent) {
          onP1LeftUp();
        } else if (e.code === 'ArrowLeft') {
          onP1LeftUp();
        } else if (e.code === 'KeyA') {
          onP2LeftUp();
        }
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (isCpuOpponent) {
          onP1RightUp();
        } else if (e.code === 'ArrowRight') {
          onP1RightUp();
        } else if (e.code === 'KeyD') {
          onP2RightUp();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCpuOpponent, onP1LeftDown, onP1LeftUp, onP1RightDown, onP1RightUp, onP2LeftDown, onP2LeftUp, onP2RightDown, onP2RightUp]);

  // When playing against CPU (e.g. Tournament mode): Full-screen dual touch zones
  if (isCpuOpponent) {
    return (
      <div
        id="tournament-flipper-controls"
        className="absolute inset-0 pointer-events-none z-20 flex justify-between select-none touch-none"
      >
        {/* Full-Height Left Half Touch Zone */}
        <div
          id="touch-tournament-flipper-left"
          onPointerDown={() => {
            setP1LeftDismissed(true);
            onP1LeftDown();
          }}
          onPointerUp={onP1LeftUp}
          onPointerLeave={onP1LeftUp}
          onPointerCancel={onP1LeftUp}
          className="w-1/2 h-full pointer-events-auto flex items-end pb-8 sm:pb-12 pl-6 sm:pl-12 cursor-pointer touch-none"
        >
          <AnimatePresence>
            {!p1LeftDismissed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.65 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-start justify-center pointer-events-none select-none"
              >
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                  LEFT FLIPPER
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-black text-amber-300 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  TAP • A • &larr;
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Full-Height Right Half Touch Zone */}
        <div
          id="touch-tournament-flipper-right"
          onPointerDown={() => {
            setP1RightDismissed(true);
            onP1RightDown();
          }}
          onPointerUp={onP1RightUp}
          onPointerLeave={onP1RightUp}
          onPointerCancel={onP1RightUp}
          className="w-1/2 h-full pointer-events-auto flex items-end justify-end pb-8 sm:pb-12 pr-6 sm:pr-12 cursor-pointer touch-none"
        >
          <AnimatePresence>
            {!p1RightDismissed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.65 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-end justify-center pointer-events-none select-none"
              >
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                  RIGHT FLIPPER
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-black text-amber-300 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  TAP • D • &rarr;
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div
      id="two-player-flipper-controls"
      className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between select-none touch-none"
    >
      {/* =========================================================
          PLAYER 2 TOP HALF (LEFT & RIGHT QUADRANTS) - ONLY FOR HUMAN P2
         ========================================================= */}
      <div className="w-full h-1/2 pt-14 pb-2 px-2 flex">
        {/* P2 Left Touch Area */}
        <div
          id="touch-p2-flipper-left"
          onPointerDown={() => {
            setP2LeftDismissed(true);
            onP2LeftDown();
          }}
          onPointerUp={onP2LeftUp}
          onPointerLeave={onP2LeftUp}
          onPointerCancel={onP2LeftUp}
          className="w-1/2 h-full pointer-events-auto flex items-center justify-start pl-6 sm:pl-12 cursor-pointer touch-none"
        >
          <AnimatePresence>
            {!p2LeftDismissed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
              >
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                  P2 LEFT
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-black text-amber-300 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  TAP / [A]
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* P2 Right Touch Area */}
        <div
          id="touch-p2-flipper-right"
          onPointerDown={() => {
            setP2RightDismissed(true);
            onP2RightDown();
          }}
          onPointerUp={onP2RightUp}
          onPointerLeave={onP2RightUp}
          onPointerCancel={onP2RightUp}
          className="w-1/2 h-full pointer-events-auto flex items-center justify-end pr-6 sm:pr-12 cursor-pointer touch-none"
        >
          <AnimatePresence>
            {!p2RightDismissed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
              >
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                  P2 RIGHT
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-black text-amber-300 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  TAP / [D]
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* =========================================================
          PLAYER 1 BOTTOM HALF (LEFT & RIGHT QUADRANTS)
         ========================================================= */}
      <div className="w-full h-1/2 pb-8 pt-2 px-2 flex">
        {/* P1 Left Touch Area */}
        <div
          id="touch-p1-flipper-left"
          onPointerDown={() => {
            setP1LeftDismissed(true);
            onP1LeftDown();
          }}
          onPointerUp={onP1LeftUp}
          onPointerLeave={onP1LeftUp}
          onPointerCancel={onP1LeftUp}
          className="w-1/2 h-full pointer-events-auto flex items-center justify-start pl-6 sm:pl-12 cursor-pointer touch-none"
        >
          <AnimatePresence>
            {!p1LeftDismissed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
              >
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                  P1 LEFT
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-black text-sky-300 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  TAP / [&larr;]
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* P1 Right Touch Area */}
        <div
          id="touch-p1-flipper-right"
          onPointerDown={() => {
            setP1RightDismissed(true);
            onP1RightDown();
          }}
          onPointerUp={onP1RightUp}
          onPointerLeave={onP1RightUp}
          onPointerCancel={onP1RightUp}
          className="w-1/2 h-full pointer-events-auto flex items-center justify-end pr-6 sm:pr-12 cursor-pointer touch-none"
        >
          <AnimatePresence>
            {!p1RightDismissed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.55 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
              >
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                  P1 RIGHT
                </span>
                <span className="text-[11px] sm:text-xs font-mono font-black text-sky-300 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                  TAP / [&rarr;]
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

