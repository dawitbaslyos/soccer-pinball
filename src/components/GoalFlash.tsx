import React from 'react';
import { GameMode } from '../types';

interface GoalFlashProps {
  show: boolean;
  scorer: 'pinball' | 'players';
  gameMode?: GameMode;
}

export const GoalFlash: React.FC<GoalFlashProps> = ({ show, scorer, gameMode }) => {
  if (!show) return null;

  const isPinball = scorer === 'pinball';
  let subtitle = isPinball ? 'PINBALL SCORES!' : 'PLAYERS SCORE!';

  if (gameMode === 'pinball') {
    subtitle = isPinball ? 'YOU SCORED!' : 'PLAYERS SCORED!';
  } else if (gameMode === 'team') {
    subtitle = isPinball ? 'PINBALL SCORED!' : 'YOUR TEAM SCORED!';
  }

  return (
    <div
      id="goal-flash-overlay"
      className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-center select-none font-sans"
    >
      <div className="flex flex-col items-center animate-bounce space-y-2">
        <div
          className={`px-6 py-3 border-[3px] border-black rounded-3xl shadow-[0_8px_0_#000] text-5xl md:text-7xl font-black tracking-widest uppercase ${
            isPinball ? 'bg-sky-400 text-black' : 'bg-amber-400 text-black'
          }`}
        >
          GOAL!
        </div>
        <div className="bg-white border-2 border-black rounded-xl px-4 py-1.5 shadow-[0_3px_0_#000] text-xs md:text-sm font-black tracking-wider text-black uppercase">
          {subtitle}
        </div>
      </div>
    </div>
  );
};
