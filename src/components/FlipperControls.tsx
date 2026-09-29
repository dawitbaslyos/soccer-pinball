import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';

interface FlipperControlsProps {
  onLeftFlipperDown: () => void;
  onLeftFlipperUp: () => void;
  onRightFlipperDown: () => void;
  onRightFlipperUp: () => void;
  onActionKick: () => void;
  isPowerKickReady?: boolean;
}

export const FlipperControls: React.FC<FlipperControlsProps> = ({
  onLeftFlipperDown,
  onLeftFlipperUp,
  onRightFlipperDown,
  onRightFlipperUp,
  onActionKick,
  isPowerKickReady = false,
}) => {
  const [leftDismissed, setLeftDismissed] = useState(false);
  const [rightDismissed, setRightDismissed] = useState(false);

  // Sync keyboard visual feedback & dismiss hints
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        setLeftDismissed(true);
        onLeftFlipperDown();
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        setRightDismissed(true);
        onRightFlipperDown();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        onLeftFlipperUp();
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        onRightFlipperUp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onLeftFlipperDown, onLeftFlipperUp, onRightFlipperDown, onRightFlipperUp]);

  const handleLeftDown = () => {
    setLeftDismissed(true);
    onLeftFlipperDown();
  };

  const handleRightDown = () => {
    setRightDismissed(true);
    onRightFlipperDown();
  };

  return (
    <div
      id="flipper-controls-root"
      className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 w-full max-w-[340px] sm:max-w-[420px] px-3 flex items-end justify-between pointer-events-none z-20 select-none font-sans"
    >
      {/* Left Flipper: Clean transparent text touch zone */}
      <div
        id="touch-flipper-left"
        onPointerDown={handleLeftDown}
        onPointerUp={onLeftFlipperUp}
        onPointerLeave={onLeftFlipperUp}
        onPointerOut={onLeftFlipperUp}
        onPointerCancel={onLeftFlipperUp}
        onContextMenu={(e) => e.preventDefault()}
        className="pointer-events-auto flex flex-col items-center justify-center cursor-pointer py-3 px-4 touch-manipulation transition-all duration-150"
      >
        <AnimatePresence>
          {!leftDismissed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center pointer-events-none select-none"
            >
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                TAP HERE
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-black text-white/80 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                A / &larr;
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Center: Minimal Power Kick Button if active */}
      {isPowerKickReady && (
        <div className="flex flex-col items-center pb-1 pointer-events-auto">
          <button
            id="btn-power-kick"
            type="button"
            onClick={onActionKick}
            className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-black shadow-[0_3px_0_#000] cursor-pointer flex items-center space-x-1.5 transition-all select-none touch-manipulation"
            title="Supercharged Power Strike! [SPACE]"
          >
            <Zap size={13} className="fill-black text-black shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase">
              POWER KICK
            </span>
          </button>
        </div>
      )}

      {/* Right Flipper: Clean transparent text touch zone */}
      <div
        id="touch-flipper-right"
        onPointerDown={handleRightDown}
        onPointerUp={onRightFlipperUp}
        onPointerLeave={onRightFlipperUp}
        onPointerOut={onRightFlipperUp}
        onPointerCancel={onRightFlipperUp}
        onContextMenu={(e) => e.preventDefault()}
        className="pointer-events-auto flex flex-col items-center justify-center cursor-pointer py-3 px-4 touch-manipulation transition-all duration-150"
      >
        <AnimatePresence>
          {!rightDismissed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center pointer-events-none select-none"
            >
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                TAP HERE
              </span>
              <span className="text-[11px] sm:text-xs font-mono font-black text-white/80 tracking-wider mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                D / &rarr;
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
