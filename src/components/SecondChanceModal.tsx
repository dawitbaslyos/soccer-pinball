import React, { useEffect, useState } from 'react';
import { Tv, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SecondChanceModalProps {
  show: boolean;
  onWatchAd: () => void;
  onDecline: () => void;
  isTournament?: boolean;
}

export const SecondChanceModal: React.FC<SecondChanceModalProps> = ({
  show,
  onWatchAd,
  onDecline,
  isTournament = false,
}) => {
  const [timeLeft, setTimeLeft] = useState(6);

  useEffect(() => {
    if (!show) {
      setTimeLeft(6);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [show, onDecline]);

  return (
    <AnimatePresence>
      {show && (
        <div
          id="second-chance-overlay"
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none font-sans"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="flex flex-col items-center max-w-xs sm:max-w-sm w-full bg-neutral-900 border-[3px] border-black rounded-2xl p-5 shadow-[0_8px_0_#000] text-center relative overflow-hidden"
          >
            {/* Top Glowing Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            {/* Close / Skip button */}
            <button
              type="button"
              onClick={onDecline}
              className="absolute top-3 right-3 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Skip"
            >
              <X size={18} />
            </button>

            {/* Countdown Badge */}
            <div className="w-12 h-12 rounded-full border-2 border-amber-400 bg-amber-400/20 text-amber-300 font-black text-xl flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(251,191,36,0.3)] animate-pulse">
              {timeLeft}s
            </div>

            {/* Title */}
            <div className="inline-flex items-center gap-1.5 bg-amber-400 text-black px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-2 shadow-[0_2px_0_#000]">
              <Sparkles size={14} className="fill-black" />
              <span>SECOND CHANCE!</span>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {isTournament ? "DON'T GET KNOCKED OUT!" : 'STAY IN THE MATCH!'}
            </h3>

            <p className="text-xs text-neutral-300 mt-1.5 mb-4 max-w-[260px] leading-relaxed">
              Watch a quick sponsor video to get <strong className="text-amber-400">+1 Golden Extra Ball</strong> and keep your streak alive!
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col w-full gap-2.5">
              <button
                id="btn-second-chance-watch"
                type="button"
                onClick={onWatchAd}
                className="w-full py-3 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 border-2 border-black rounded-xl text-xs sm:text-sm font-black tracking-wider text-black flex items-center justify-center gap-2 shadow-[0_4px_0_#000] transition-all cursor-pointer uppercase"
              >
                <Tv size={18} />
                <span>WATCH AD FOR EXTRA BALL</span>
              </button>

              <button
                id="btn-second-chance-decline"
                type="button"
                onClick={onDecline}
                className="w-full py-2 text-white/50 hover:text-white text-xs font-bold transition-colors cursor-pointer uppercase"
              >
                Give Up & View Results
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
