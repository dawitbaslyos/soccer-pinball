import React from 'react';
import { Play, RotateCcw, Home } from 'lucide-react';
import { GameMode } from '../types';

interface PauseMenuProps {
  currentMode?: GameMode;
  onResume: () => void;
  onRestart: () => void;
  onSwitchMode?: (mode: GameMode) => void;
  onGoHome: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onGoHome,
}) => {
  return (
    <div
      id="pause-menu-overlay"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4 font-sans"
    >
      <div className="flex flex-col items-center max-w-xs sm:max-w-sm w-full bg-white border-[2.5px] border-black rounded-2xl p-4 sm:p-6 shadow-[0_8px_0_#000] text-center space-y-4 sm:space-y-5 animate-scale-up">
        {/* Header Pill */}
        <div className="inline-flex items-center space-x-2 bg-amber-300 border-2 border-black rounded-xl px-4 py-1.5 shadow-[0_2px_0_#000]">
          <span className="text-sm">⏸</span>
          <h2
            id="pause-title"
            className="text-base font-black tracking-widest text-black uppercase"
          >
            GAME PAUSED
          </h2>
        </div>

        {/* Buttons List */}
        <div className="flex flex-col w-full space-y-2.5">
          {/* Resume */}
          <button
            id="btn-pause-resume"
            type="button"
            onClick={onResume}
            className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 active:shadow-none border-2 border-black rounded-xl text-xs font-black tracking-wider text-black flex items-center justify-center space-x-2 shadow-[0_3px_0_#000] transition-transform cursor-pointer uppercase"
          >
            <Play size={15} className="fill-black" />
            <span>RESUME MATCH</span>
          </button>

          {/* Restart */}
          <button
            id="btn-pause-restart"
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 bg-white hover:bg-neutral-100 active:translate-y-0.5 active:shadow-none border-2 border-black rounded-xl text-xs font-black tracking-wider text-black flex items-center justify-center space-x-2 shadow-[0_3px_0_#000] transition-transform cursor-pointer uppercase"
          >
            <RotateCcw size={15} />
            <span>RESTART</span>
          </button>

          {/* Home */}
          <button
            id="btn-pause-home"
            type="button"
            onClick={onGoHome}
            className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 active:translate-y-0.5 active:shadow-none border-2 border-black rounded-xl text-xs font-black tracking-wider text-neutral-700 flex items-center justify-center space-x-2 shadow-[0_3px_0_#000] transition-transform cursor-pointer uppercase"
          >
            <Home size={15} />
            <span>EXIT TO MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
