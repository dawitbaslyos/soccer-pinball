import React, { useEffect } from 'react';
import { Trophy, RotateCcw, Home, ArrowRight, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameMode, MatchType, TournamentRound, TOURNAMENT_ROUNDS } from '../types';
import { CountryFlag } from './CountryFlag';
import { soundEffects } from '../audio/SoundEffects';
import { leaderboardService } from '../services/LeaderboardService';

interface GameOverViewProps {
  score: number;
  goals: number;
  playerGoals: number;
  winner: 'pinball' | 'players' | null;
  gameMode?: GameMode;
  matchType?: MatchType;
  tournamentRound?: TournamentRound;
  onRestart: () => void;
  onHome: () => void;
  onNextTournamentRound?: () => void;
  onViewBracket?: () => void;
  playerName?: string;
  playerCountry?: string;
  trophiesWon?: number;
}

export const GameOverView: React.FC<GameOverViewProps> = ({
  score,
  goals,
  playerGoals,
  winner,
  gameMode,
  matchType,
  tournamentRound,
  onRestart,
  onHome,
  onNextTournamentRound,
  onViewBracket,
  playerName = 'Player1',
  playerCountry = 'Brazil',
  trophiesWon = 0,
}) => {
  // Determine if human user won the match
  const isTournament = matchType === 'tournament';
  const isTwoPlayer = matchType === 'two_player';

  const isUserWinner =
    (gameMode === 'pinball' && winner === 'pinball') ||
    (gameMode === 'team' && winner === 'players') ||
    (gameMode === 'two_player' && winner === 'pinball');

  const isTournamentChampion =
    isTournament && isUserWinner && tournamentRound?.roundNumber === 3;

  useEffect(() => {
    if (isTournamentChampion) {
      soundEffects.playGoal();
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#fbbf24', '#f59e0b', '#10b981', '#38bdf8', '#ffffff'],
      });
    }
  }, [isTournamentChampion]);

  const canAdvanceTournament =
    isTournament && isUserWinner && (tournamentRound?.roundNumber ?? 1) < 3;

  const streakMult = leaderboardService.getStreakScoreMultiplier();
  const earnedGoalsCoins = Math.round(goals * 5 * streakMult);
  const earnedWinCoins = isUserWinner ? Math.round(25 * streakMult) : Math.round(10 * streakMult);
  const earnedCupCoins = isTournamentChampion ? Math.round(100 * streakMult) : 0;
  const totalEarnedCoins = earnedGoalsCoins + earnedWinCoins + earnedCupCoins;
  const currentCoins = leaderboardService.getCoins();

  let outcomeTitle = 'FULL TIME DRAW!';
  if (isTwoPlayer) {
    if (winner === 'pinball') outcomeTitle = 'PLAYER 1 WINS!';
    else if (winner === 'players') outcomeTitle = 'PLAYER 2 WINS!';
    else outcomeTitle = 'DRAW MATCH!';
  } else if (isTournament) {
    if (isTournamentChampion) outcomeTitle = '🏆 WORLD CUP CHAMPION!';
    else if (isUserWinner) outcomeTitle = 'ROUND WON! ADVANCED';
    else outcomeTitle = 'KNOCKED OUT OF CUP';
  } else {
    if (winner) {
      if (gameMode === 'team') {
        outcomeTitle = winner === 'players' ? 'YOUR TEAM WINS!' : 'PINBALL WINS!';
      } else if (gameMode === 'pinball') {
        outcomeTitle = winner === 'pinball' ? 'YOU WIN!' : 'PLAYERS WIN!';
      } else {
        outcomeTitle = `${winner.toUpperCase()} VICTORY!`;
      }
    }
  }

  const isPlayerWinner = winner === 'players';
  const isPinballWinner = winner === 'pinball';

  return (
    <div
      id="game-over-overlay"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs select-none p-4 font-sans"
    >
      <div className="flex flex-col items-center max-w-xs sm:max-w-sm w-full bg-white border-[2.5px] border-black rounded-2xl p-4 sm:p-5 shadow-[0_8px_0_#000] text-center space-y-3.5 animate-scale-up">
        {/* Outcome Header Pill */}
        <div
          id="game-over-banner"
          className={`inline-flex items-center space-x-2 border-2 border-black rounded-xl px-4 py-2 shadow-[0_3px_0_#000] ${
            isTournamentChampion
              ? 'bg-amber-400 text-black animate-bounce'
              : isTwoPlayer
              ? winner === 'pinball'
                ? 'bg-sky-400 text-black'
                : winner === 'players'
                ? 'bg-purple-400 text-white'
                : 'bg-neutral-200 text-black'
              : isUserWinner
              ? 'bg-emerald-400 text-black'
              : 'bg-red-400 text-black'
          }`}
        >
          {isTournamentChampion ? (
            <Award size={20} className="fill-amber-700 text-black" />
          ) : (
            <Trophy size={18} className="fill-current" />
          )}
          <h2
            id="game-over-title"
            className="text-sm sm:text-base font-black tracking-wider uppercase"
          >
            {outcomeTitle}
          </h2>
        </div>

        {/* World Cup Champion Pedestal Card */}
        {isTournamentChampion && (
          <div
            id="tournament-champion-card"
            className="w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 border-2 border-black rounded-xl p-3 shadow-[0_3px_0_#000] flex items-center justify-between text-black animate-scale-up"
          >
            <div className="flex items-center gap-2.5">
              <CountryFlag country={playerCountry} size="md" rounded="md" />
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm font-black uppercase leading-tight tracking-wide">
                  {playerName}
                </span>
                <span className="text-[9px] font-black uppercase text-black/80">
                  {playerCountry} • WORLD CHAMPION
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 font-mono font-black text-xs sm:text-sm">
                <Trophy size={15} className="fill-black text-black" />
                <span>{trophiesWon || 1}</span>
              </div>
              <span className="text-[8px] font-black uppercase text-black/70">
                CUPS WON
              </span>
            </div>
          </div>
        )}

        {/* Tournament Bracket Progress Card */}
        {!isTournamentChampion && isTournament && tournamentRound && (
          <div className="w-full bg-neutral-900 border-2 border-black rounded-xl p-2.5 shadow-[0_2px_0_#000]">
            <div className="flex items-center justify-between text-[8px] font-black text-white/70 uppercase mb-1.5 px-1">
              <span>CUP BRACKET</span>
              <span className="text-amber-400 font-bold">
                STAGE {tournamentRound.roundNumber} OF 3
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {TOURNAMENT_ROUNDS.map((rd) => {
                const isPassed = rd.roundNumber < tournamentRound.roundNumber;
                const isCurrent = rd.roundNumber === tournamentRound.roundNumber;
                return (
                  <div
                    key={rd.name}
                    className={`py-1 px-1 rounded-md border text-center ${
                      isPassed || (isCurrent && isUserWinner)
                        ? 'bg-emerald-500 border-black text-black font-black'
                        : isCurrent
                        ? isUserWinner
                          ? 'bg-emerald-500 border-black text-black font-black'
                          : 'bg-red-500 border-black text-white font-black'
                        : 'bg-neutral-800 border-white/20 text-white/40 font-bold'
                    }`}
                  >
                    <span className="text-[7px] block tracking-wider uppercase">
                      {isPassed || (isCurrent && isUserWinner) ? 'CLEARED' : `STAGE ${rd.roundNumber}`}
                    </span>
                    <span className="text-[9px] font-black truncate flex items-center justify-center gap-1">
                      <CountryFlag country={rd.opponentName} size="xs" rounded="sm" shadow={false} />
                      <span>{rd.opponentName.toUpperCase()}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dual Goals Summary */}
        <div className="flex items-center justify-between w-full bg-neutral-100 border-2 border-black rounded-xl p-3 shadow-[0_2px_0_#000]">
          {/* Pinball */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-black tracking-wider text-sky-700 uppercase flex items-center space-x-1">
              <span>{isTwoPlayer ? 'P1 PINBALL' : 'PINBALL'}</span>
              {gameMode === 'pinball' && !isTwoPlayer && (
                <span className="text-[7px] bg-sky-400 text-black px-1 rounded-xs font-black">YOU</span>
              )}
            </span>
            <span className="text-3xl font-black text-black">{goals}</span>
          </div>

          {/* VS Pill */}
          <span className="text-xs font-black px-2 py-1 bg-black text-white rounded-lg shadow-xs">
            VS
          </span>

          {/* Players */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-black tracking-wider text-purple-700 uppercase flex items-center space-x-1">
              <span>{isTwoPlayer ? 'P2 TEAM' : 'PLAYERS'}</span>
              {gameMode === 'team' && !isTwoPlayer && (
                <span className="text-[7px] bg-purple-500 text-white px-1 rounded-xs font-black">YOU</span>
              )}
            </span>
            <span className="text-3xl font-black text-black">{playerGoals}</span>
          </div>
        </div>

        {/* Score & Coins Summary Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-100 border border-black/30 rounded-full text-xs font-black text-neutral-800">
            <span>MATCH PTS:</span>
            <span className="text-amber-700 font-mono">{score.toLocaleString()}</span>
          </div>

          <div
            id="game-over-coins-pill"
            className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-400 border-2 border-black rounded-full text-xs font-black text-black shadow-[0_2px_0_#000] animate-pulse"
          >
            <span>+{totalEarnedCoins}</span>
            <span className="text-xs">🪙</span>
            <span className="text-[10px] text-black/70 font-bold">({currentCoins} TOTAL)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col w-full space-y-2">
          {/* Tournament Next Round Button */}
          {canAdvanceTournament && tournamentRound && (
            <button
              id="btn-next-tournament-round"
              type="button"
              onClick={onNextTournamentRound}
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 border-2 border-black rounded-xl text-xs font-black tracking-wider text-black flex items-center justify-center space-x-2 shadow-[0_3px_0_#000] transition-transform cursor-pointer uppercase"
            >
              <span>NEXT ROUND: {TOURNAMENT_ROUNDS[tournamentRound.roundNumber]?.name}</span>
              <ArrowRight size={15} />
            </button>
          )}

          {/* Regular Play Again / Rematch */}
          {!canAdvanceTournament && (
            <button
              id="btn-play-again"
              type="button"
              onClick={onRestart}
              className={`w-full py-3 ${
                isTwoPlayer
                  ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-[0_4px_0_#000]'
                  : 'bg-amber-400 hover:bg-amber-300 text-black shadow-[0_3px_0_#000]'
              } active:translate-y-0.5 border-2 border-black rounded-xl text-xs font-black tracking-wider flex items-center justify-center space-x-2 transition-transform cursor-pointer uppercase`}
            >
              <RotateCcw size={15} />
              <span>{isTwoPlayer ? '⚡ INSTANT REMATCH' : isTournament ? 'RETRY TOURNAMENT' : 'PLAY AGAIN'}</span>
            </button>
          )}

          {/* View Bracket Tree Button */}
          {isTournament && onViewBracket && (
            <button
              id="btn-view-bracket-tree"
              type="button"
              onClick={onViewBracket}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-amber-300 active:translate-y-0.5 border-2 border-black rounded-xl text-xs font-black tracking-wider flex items-center justify-center space-x-2 shadow-[0_3px_0_#000] transition-transform cursor-pointer uppercase"
            >
              <Trophy size={15} className="fill-amber-400" />
              <span>VIEW CUP BRACKET TREE</span>
            </button>
          )}

          <button
            id="btn-game-over-home"
            type="button"
            onClick={onHome}
            className="w-full py-2.5 bg-white hover:bg-neutral-100 active:translate-y-0.5 border-2 border-black rounded-xl text-xs font-black tracking-wider text-neutral-700 flex items-center justify-center space-x-2 shadow-[0_3px_0_#000] transition-transform cursor-pointer uppercase"
          >
            <Home size={15} />
            <span>RETURN HOME</span>
          </button>
        </div>
      </div>
    </div>
  );
};
