import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Flame, Zap, X } from 'lucide-react';
import { leaderboardService } from '../services/LeaderboardService';

interface LeaderboardDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardDropdown: React.FC<LeaderboardDropdownProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'goals' | 'scores' | 'streaks'>('goals');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const stats = leaderboardService.getStats();
  const entries = leaderboardService.getLeaderboard(activeTab);
  const boostPercent = stats.streakBoostPercent;

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  return (
    <div
      ref={dropdownRef}
      id="leaderboard-dropdown"
      className="absolute top-full mt-2 left-0 z-50 w-72 sm:w-80 bg-neutral-900/95 border-2 border-black rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.85)] p-3 text-white flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
    >
      {/* 1. Header with Close Button */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <Trophy size={16} className="text-amber-400 fill-amber-400" />
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
            LEADERBOARD
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/50 hover:text-white p-0.5 rounded cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* 2. Streak & Daily Score Boost Banner (Streaks integrated directly inside) */}
      <div className="my-2.5 p-2 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-neutral-800/60 border border-amber-400/30 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 border border-black flex items-center justify-center shrink-0 shadow-[0_1.5px_0_#000]">
            <Flame size={18} className="text-black fill-black" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1">
              <span>{stats.currentStreak} MATCH STREAK</span>
            </span>
            <span className="text-[10px] text-white/70 font-semibold">
              {stats.bestStreak > 0 ? `Best streak: ${stats.bestStreak}` : 'Win matches daily!'}
            </span>
          </div>
        </div>

        {/* Score Multiplier Badge */}
        <div className="flex items-center gap-1 px-2 py-1 bg-black/60 border border-amber-400/40 rounded-lg">
          <Zap size={11} className="text-amber-300 fill-amber-300" />
          <span className="text-[10px] font-black text-amber-300 font-mono tracking-tight">
            +{boostPercent}% BOOST
          </span>
        </div>
      </div>

      {/* 3. Minimal Segmented Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-xl mb-2 border border-white/10 text-[10px] font-black uppercase">
        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
            activeTab === 'goals'
              ? 'bg-amber-400 text-black shadow-[0_1px_0_#000]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          GOALS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scores')}
          className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
            activeTab === 'scores'
              ? 'bg-amber-400 text-black shadow-[0_1px_0_#000]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          SCORES
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('streaks')}
          className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
            activeTab === 'streaks'
              ? 'bg-amber-400 text-black shadow-[0_1px_0_#000]'
              : 'text-white/60 hover:text-white'
          }`}
        >
          STREAKS
        </button>
      </div>

      {/* 4. Top 10 Minimal List */}
      <div className="max-h-48 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
        {entries.map((entry) => (
          <div
            key={`${activeTab}_${entry.rank}_${entry.name}`}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
              entry.isCurrentPlayer
                ? 'bg-amber-400/20 border border-amber-400/50 font-black text-white'
                : 'bg-white/5 hover:bg-white/10 font-bold text-white/80'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 text-center text-xs font-black shrink-0 font-mono">
                {getRankBadge(entry.rank)}
              </span>
              <span className="text-sm shrink-0">{entry.flag}</span>
              <span className="truncate max-w-[100px] text-white">
                {entry.name}
              </span>
              {entry.isCurrentPlayer && (
                <span className="text-[8px] font-black bg-amber-400 text-black px-1 rounded-xs uppercase">
                  YOU
                </span>
              )}
            </div>

            <span className="font-mono font-black text-xs shrink-0 text-amber-300">
              {entry.score.toLocaleString()}
              {activeTab === 'goals' ? 'G' : activeTab === 'streaks' ? '🔥' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
