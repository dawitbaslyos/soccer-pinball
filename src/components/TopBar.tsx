import React from 'react';
import { Pause, Play } from 'lucide-react';
import { BracketMatch, GameMode, MatchType, TournamentRound } from '../types';
import { CountryFlag } from './CountryFlag';

interface TopBarProps {
  score: number;
  goals: number;
  playerGoals: number;
  matchTime: number;
  isPaused: boolean;
  gameMode?: GameMode;
  matchType?: MatchType;
  tournamentRound?: TournamentRound;
  activeTournamentMatch?: BracketMatch | null;
  playerName?: string;
  playerCountry?: string;
  onTogglePause: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  goals,
  playerGoals,
  matchTime,
  isPaused,
  matchType,
  activeTournamentMatch,
  playerName = 'Player1',
  playerCountry = 'Brazil',
  onTogglePause,
}) => {
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(Math.max(0, totalSeconds) / 60);
    const s = Math.floor(Math.max(0, totalSeconds) % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const opponentTeam = activeTournamentMatch
    ? activeTournamentMatch.teamA.isPlayer
      ? activeTournamentMatch.teamB
      : activeTournamentMatch.teamA
    : null;

  return (
    <header
      id="soccer-pinball-topbar"
      className="absolute top-0 left-0 w-full px-3 md:px-6 py-2 md:py-3 flex items-start justify-between pointer-events-none z-30 select-none font-sans"
    >
      {/* Left: Zero in-game clutter */}
      <div className="flex items-center space-x-2 pointer-events-auto" />

      {/* Center: Match Scoreboard [ Player 0 - 0 Opponent ] & Match Clock */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 md:top-2.5 flex flex-col items-center pointer-events-auto">
        <div
          id="match-score-pill"
          className="bg-white border-2 border-black rounded-xl px-3 md:px-4 py-1 flex items-center space-x-2.5 sm:space-x-3 shadow-[0_3px_0_#000]"
        >
          {/* Player 1 Side: Custom Country Flag & Name */}
          <div className="flex items-center space-x-1.5">
            <CountryFlag country={playerCountry} size="xs" rounded="sm" shadow={false} />
            <span className="text-xs font-black text-neutral-800 tracking-wide uppercase">
              {playerName || (matchType === 'two_player' ? 'P1' : 'YOU')}
            </span>
            <span id="score-pinball-val" className="text-sm md:text-base font-black text-sky-600 min-w-[12px] text-center">
              {goals}
            </span>
          </div>

          {/* VS Divider */}
          <span className="text-[10px] md:text-xs font-black px-1.5 py-0.5 bg-black text-white rounded-md">
            VS
          </span>

          {/* Player 2 / Opponent Side */}
          <div className="flex items-center space-x-1.5">
            <span id="score-players-val" className="text-sm md:text-base font-black text-rose-500 min-w-[12px] text-center">
              {playerGoals}
            </span>
            <span className="text-xs font-black text-neutral-800 uppercase">
              {opponentTeam ? opponentTeam.name : matchType === 'two_player' ? 'P2' : 'CPU'}
            </span>
            <CountryFlag
              country={opponentTeam ? opponentTeam.name : matchType === 'two_player' ? 'de' : 'jp'}
              size="xs"
              rounded="sm"
              shadow={false}
            />
          </div>
        </div>

        {/* Match Clock directly underneath */}
        <div
          id="match-clock-pill"
          className={`mt-1 px-2.5 py-0.5 rounded-lg border-2 border-black text-[11px] md:text-xs font-black tracking-wider flex items-center space-x-1 shadow-[0_2px_0_#000] ${
            matchTime <= 30
              ? 'bg-red-400 text-black animate-pulse'
              : 'bg-amber-300 text-black'
          }`}
        >
          <span>⏱</span>
          <span>{formatTime(matchTime)}</span>
        </div>
      </div>

      {/* Right: Clean Pause Button */}
      <div className="flex items-center space-x-2 pointer-events-auto">
        <button
          id="btn-toggle-pause"
          type="button"
          onClick={onTogglePause}
          className="w-9 h-9 md:w-10 md:h-10 bg-white hover:bg-neutral-100 active:translate-y-0.5 active:shadow-none border-2 border-black rounded-xl flex items-center justify-center text-black shadow-[0_3px_0_#000] transition-transform cursor-pointer"
          aria-label={isPaused ? 'Resume Game' : 'Pause Game'}
        >
          {isPaused ? <Play size={18} className="fill-black" /> : <Pause size={18} className="fill-black" />}
        </button>
      </div>
    </header>
  );
};
