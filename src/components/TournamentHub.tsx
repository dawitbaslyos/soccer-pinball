import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  ArrowLeft,
  RotateCcw,
  Play,
  Sparkles,
  Lock,
  CheckCircle2,
  Tv,
  X,
  Award,
} from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { BracketMatch, BracketTeam, TournamentDifficulty, TOURNAMENT_DIFFICULTIES } from '../types';
import { CountryFlag } from './CountryFlag';
import { platformSDK } from '../services/PlatformSDK';
import { soundEffects } from '../audio/SoundEffects';

export const ALTERNATE_OPPONENTS = [
  { name: 'France', badge: '🇫🇷', tactics: 'Les Bleus • Hyper-Paced Wings & Clinical Finishing', colors: { jersey: 0x002654, shorts: 0xffffff } },
  { name: 'Portugal', badge: '🇵🇹', tactics: 'Seleção das Quinas • Technical Precision & Curve Shots', colors: { jersey: 0x990000, shorts: 0x006600 } },
  { name: 'Italy', badge: '🇮🇹', tactics: 'Gli Azzurri • Impenetrable Defense & Set-piece Power', colors: { jersey: 0x0047ab, shorts: 0xffffff } },
  { name: 'Croatia', badge: '🇭🇷', tactics: 'Vatreni • Tireless Workrate & Razor Passing', colors: { jersey: 0xd40000, shorts: 0xffffff } },
  { name: 'Morocco', badge: '🇲🇦', tactics: 'Atlas Lions • High-Energy Counters & Resilient Backline', colors: { jersey: 0xc1272d, shorts: 0x006233 } },
  { name: 'Netherlands', badge: '🇳🇱', tactics: 'Oranje • Total Pinball Dynamic Rotation', colors: { jersey: 0xf36c21, shorts: 0xffffff } },
];

export function sanitizeTournamentTeam(team: BracketTeam, playerCountry: string): BracketTeam {
  if (team.isPlayer) return team;
  if (team.name.toLowerCase() === playerCountry.toLowerCase()) {
    const alt = ALTERNATE_OPPONENTS.find(
      (a) => a.name.toLowerCase() !== playerCountry.toLowerCase()
    ) || ALTERNATE_OPPONENTS[0];
    return {
      ...team,
      name: alt.name,
      badge: alt.badge,
      flag: alt.badge,
      tactics: alt.tactics,
      colors: alt.colors,
    };
  }
  return team;
}

interface TournamentHubProps {
  bracketMatches: BracketMatch[];
  currentRoundNumber: number;
  userRole: 'pinball' | 'team';
  onSelectRole: (role: 'pinball' | 'team') => void;
  onKickoffMatch: (match: BracketMatch, hasBooster?: boolean) => void;
  onResetTournament: () => void;
  onBackToHome: () => void;
  playerName?: string;
  playerCountry?: string;
  difficulty?: TournamentDifficulty;
  onSelectDifficulty?: (difficulty: TournamentDifficulty) => void;
  trophiesWon?: number;
}

export const TournamentHub: React.FC<TournamentHubProps> = ({
  bracketMatches,
  onKickoffMatch,
  onResetTournament,
  onBackToHome,
  playerName = 'Player1',
  playerCountry = 'Brazil',
  difficulty = 'standard',
  onSelectDifficulty,
  trophiesWon = 0,
}) => {
  // Find current active user match
  const activeUserMatch =
    bracketMatches.find(
      (m) => m.status === 'active' && (m.teamA.isPlayer || m.teamB.isPlayer)
    ) ||
    bracketMatches.find((m) => m.status === 'active') ||
    bracketMatches[0];

  // Selected match for the merged VS display under the tree
  const [selectedMatchId, setSelectedMatchId] = useState<string>(activeUserMatch.id);
  const [hasBooster, setHasBooster] = useState<boolean>(false);
  const [isWatchingBoosterAd, setIsWatchingBoosterAd] = useState<boolean>(false);
  const [showTrophyShowcase, setShowTrophyShowcase] = useState<boolean>(false);

  const handleWatchBoosterAd = () => {
    if (isWatchingBoosterAd) return;
    setIsWatchingBoosterAd(true);
    platformSDK.requestRewardedAd({
      adFinished: () => setIsWatchingBoosterAd(false),
      adError: () => setIsWatchingBoosterAd(false),
      rewardGranted: () => {
        setIsWatchingBoosterAd(false);
        setHasBooster(true);
      },
    });
  };

  // Dynamic scaling for Bracket Tree
  const horizontalViewportRef = useRef<HTMLDivElement>(null);
  const [horizontalScale, setHorizontalScale] = useState<number>(1);

  // Calculate dynamic scale factor so horizontal bracket always fits available viewport
  useEffect(() => {
    const container = horizontalViewportRef.current;
    if (!container) return;

    const measureAndScale = () => {
      const availW = container.clientWidth;
      const availH = container.clientHeight;

      // Target dimensions for full horizontal bracket tree (width ~820px, height ~390px)
      const baseW = 820;
      const baseH = 390;

      const targetW = Math.max(260, availW - 12);
      const targetH = Math.max(160, availH - 4);

      const scaleW = targetW / baseW;
      const scaleH = targetH / baseH;

      // Scale to fit both dimensions cleanly without overflow
      const idealScale = Math.min(scaleW, scaleH);
      const clamped = Math.max(0.36, Math.min(1.05, idealScale));
      setHorizontalScale(clamped);
    };

    measureAndScale();
    const observer = new ResizeObserver(measureAndScale);
    observer.observe(container);
    window.addEventListener('resize', measureAndScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureAndScale);
    };
  }, []);

  const selectedMatch =
    bracketMatches.find((m) => m.id === selectedMatchId) || activeUserMatch;

  const qfMatches = bracketMatches.filter((m) => m.round === 1);
  const sfMatches = bracketMatches.filter((m) => m.round === 2);
  const finalMatches = bracketMatches.filter((m) => m.round === 3);

  const isTeamBPlayer = selectedMatch.teamB.isPlayer;
  const rawPlayerTeam = isTeamBPlayer ? selectedMatch.teamB : selectedMatch.teamA;
  const rawOpponentTeam = isTeamBPlayer ? selectedMatch.teamA : selectedMatch.teamB;
  const playerTeam = rawPlayerTeam;
  const opponentTeam = sanitizeTournamentTeam(rawOpponentTeam, playerCountry);

  const isSelectedActive = selectedMatch.status === 'active';

  return (
    <div
      id="tournament-hub-page"
      className="absolute inset-0 z-40 flex flex-col bg-neutral-900 text-white select-none overflow-hidden font-sans"
    >
      {/* 1. Sleek, Decluttered Neo-Primitive Header */}
      <header className="w-full border-b-[3px] border-black bg-amber-400 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_0_#000] shrink-0">
        {/* Left: Exit to Lobby */}
        <button
          id="btn-tournament-back"
          type="button"
          onClick={onBackToHome}
          className="group flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-black text-xs uppercase border-2 border-black rounded-xl shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] transition-all cursor-pointer touch-manipulation"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>LOBBY</span>
        </button>

        {/* Center: Title Badge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[0_2px_0_#000]">
            <Trophy size={17} className="text-amber-500 fill-amber-400" />
          </div>
          <div className="flex flex-col text-left">
            <h1 className="text-xs sm:text-sm font-black italic tracking-tight uppercase leading-none text-black">
              WORLD PINBALL CUP
            </h1>
            <span className="text-[9px] text-black/80 font-black uppercase tracking-wider mt-0.5">
              KNOCKOUT CHAMPIONSHIP
            </span>
          </div>
        </div>

        {/* Right Action: Clean Reset */}
        <button
          id="btn-reset-bracket"
          type="button"
          onClick={onResetTournament}
          title="Reset Tournament Ladder"
          className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-white hover:bg-neutral-100 text-black font-black text-xs uppercase border-2 border-black rounded-xl shadow-[0_2.5px_0_#000] active:translate-y-0.5 transition-all cursor-pointer touch-manipulation"
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">RESET</span>
        </button>
      </header>

      {/* 1.5. Tournament Difficulty & World Cups Showcase Bar */}
      <div className="w-full bg-neutral-950 border-b-[2.5px] border-black px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs shrink-0 z-20">
        {/* Left: Difficulty label & pills */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] font-black uppercase text-neutral-400 hidden xs:inline tracking-wider">
            DIFFICULTY:
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {(Object.keys(TOURNAMENT_DIFFICULTIES) as TournamentDifficulty[]).map((diffKey) => {
              const cfg = TOURNAMENT_DIFFICULTIES[diffKey];
              const isSel = difficulty === diffKey;
              return (
                <button
                  key={diffKey}
                  type="button"
                  onClick={() => onSelectDifficulty?.(diffKey)}
                  className={`px-2 sm:px-2.5 py-1 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer select-none border-2 ${
                    isSel
                      ? `${cfg.badgeClass} border-black shadow-[0_2px_0_#000]`
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border-white/10'
                  }`}
                >
                  <span>{cfg.name.replace(' CUP', '')}</span>
                  <span className="ml-1 opacity-80 text-[8px] font-mono">({cfg.badge})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Trophy Showcase Modal Opener */}
        <button
          id="btn-open-trophy-showcase"
          type="button"
          onClick={() => setShowTrophyShowcase(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/15 hover:bg-amber-400/25 border-2 border-amber-400/50 rounded-xl text-[10px] font-black text-amber-300 transition-all cursor-pointer shadow-[0_1.5px_0_#000]"
        >
          <Trophy size={13} className="fill-amber-400 text-amber-400" />
          <span>{trophiesWon || 0} CUPS WON</span>
        </button>
      </div>

      {/* 2. Main Content View: Bracket Tree at Top, VS Cards Below */}
      <main className="flex-1 flex flex-col justify-between w-full max-w-6xl mx-auto overflow-hidden">
        {/* TOP: HORIZONTAL TOURNAMENT BRACKET TREE */}
        <div
          ref={horizontalViewportRef}
          className="w-full flex-1 min-h-[160px] max-h-[50%] flex items-start justify-center px-2 pt-2 sm:pt-3 overflow-hidden relative"
        >
          <div
            style={{
              transform: `scale(${horizontalScale})`,
              transformOrigin: 'top center',
              width: '820px',
              height: '390px',
              marginBottom: `-${Math.max(0, 390 * (1 - horizontalScale))}px`,
              transition: 'transform 0.12s ease-out',
            }}
            className="shrink-0 flex items-start justify-center"
          >
            <section
              id="tournament-bracket-tree"
              aria-label="Tournament Bracket Tree"
              className="bg-neutral-950 border-[3px] border-black rounded-2xl p-4 sm:p-5 shadow-[0_6px_0_#000] w-full flex items-center justify-between gap-2 sm:gap-3 select-none"
            >
              {/* COLUMN 1: QUARTER-FINALS (4 Matches in 2 pairs) */}
              <div className="flex flex-col space-y-2.5 w-48 shrink-0">
                <div className="flex items-center justify-between text-[11px] font-black uppercase text-amber-400 tracking-wider pb-1 border-b-2 border-amber-400/30">
                  <span>QUARTER-FINALS</span>
                  <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded font-black text-[9px]">
                    RD 1
                  </span>
                </div>

                {/* Pair 1 (Feeds to SF 1) */}
                <div className="flex flex-col space-y-2">
                  {qfMatches.slice(0, 2).map((match) => (
                    <MinimalFixtureNode
                      key={match.id}
                      match={match}
                      isActiveUserMatch={match.id === activeUserMatch.id}
                      isSelected={selectedMatch.id === match.id}
                      onSelect={() => setSelectedMatchId(match.id)}
                      playerName={playerName}
                      playerCountry={playerCountry}
                    />
                  ))}
                </div>

                {/* Pair 2 (Feeds to SF 2) */}
                <div className="flex flex-col space-y-2 pt-1">
                  {qfMatches.slice(2, 4).map((match) => (
                    <MinimalFixtureNode
                      key={match.id}
                      match={match}
                      isActiveUserMatch={match.id === activeUserMatch.id}
                      isSelected={selectedMatch.id === match.id}
                      onSelect={() => setSelectedMatchId(match.id)}
                      playerName={playerName}
                      playerCountry={playerCountry}
                    />
                  ))}
                </div>
              </div>

              {/* CONNECTORS 1 (QF to SF SVG Brackets) */}
              <div className="flex flex-col justify-around h-[340px] w-6 shrink-0 text-white/30 pt-4">
                {/* Upper Bracket for Pair 1 */}
                <svg className="w-6 h-[120px]" viewBox="0 0 24 100" preserveAspectRatio="none">
                  <path
                    d="M 0 25 H 12 V 50 H 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 0 75 H 12 V 50 H 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Lower Bracket for Pair 2 */}
                <svg className="w-6 h-[120px]" viewBox="0 0 24 100" preserveAspectRatio="none">
                  <path
                    d="M 0 25 H 12 V 50 H 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 0 75 H 12 V 50 H 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* COLUMN 2: SEMI-FINALS (2 Matches with ? for next phase) */}
              <div className="flex flex-col justify-around h-[360px] w-48 shrink-0">
                <div className="flex items-center justify-between text-[11px] font-black uppercase text-sky-400 tracking-wider pb-1 border-b-2 border-sky-400/30 mb-2">
                  <span>SEMI-FINALS</span>
                  <span className="bg-sky-400 text-black px-1.5 py-0.2 rounded font-black text-[9px]">
                    RD 2
                  </span>
                </div>

                {sfMatches.map((match) => (
                  <MinimalFixtureNode
                    key={match.id}
                    match={match}
                    isActiveUserMatch={match.id === activeUserMatch.id}
                    isSelected={selectedMatch.id === match.id}
                    onSelect={() => setSelectedMatchId(match.id)}
                    playerName={playerName}
                    playerCountry={playerCountry}
                  />
                ))}
              </div>

              {/* CONNECTORS 2 (SF to Grand Final SVG Bracket) */}
              <div className="flex flex-col justify-center h-[340px] w-6 shrink-0 text-white/30 pt-4">
                <svg className="w-6 h-[170px]" viewBox="0 0 24 100" preserveAspectRatio="none">
                  <path
                    d="M 0 25 H 12 V 50 H 24"
                    fill="none"
                    stroke="rgba(250,204,21,0.6)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 0 75 H 12 V 50 H 24"
                    fill="none"
                    stroke="rgba(250,204,21,0.6)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* COLUMN 3: GRAND FINAL (1 Match with ? for next phase) */}
              <div className="flex flex-col justify-center h-[360px] w-48 shrink-0">
                <div className="flex items-center justify-between text-[11px] font-black uppercase text-yellow-400 tracking-wider pb-1 border-b-2 border-yellow-400/40 mb-3">
                  <span className="flex items-center gap-1">
                    <Trophy size={13} className="fill-yellow-400" />
                    GRAND FINAL
                  </span>
                  <span className="bg-yellow-400 text-black px-1.5 py-0.2 rounded font-black text-[9px]">
                    RD 3
                  </span>
                </div>

                {finalMatches.map((match) => (
                  <MinimalFixtureNode
                    key={match.id}
                    match={match}
                    isActiveUserMatch={match.id === activeUserMatch.id}
                    isSelected={selectedMatch.id === match.id}
                    onSelect={() => setSelectedMatchId(match.id)}
                    playerName={playerName}
                    playerCountry={playerCountry}
                  />
                ))}
              </div>

              {/* CONNECTOR 3: Grand Final to Trophy Arrow */}
              <div className="flex items-center justify-center w-6 shrink-0">
                <div className="w-full h-[2.5px] bg-gradient-to-r from-yellow-400 to-amber-300 relative">
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-l-[6px] border-l-amber-300" />
                </div>
              </div>

              {/* COLUMN 4: TROPHY PEDESTAL */}
              <button
                id="btn-trophy-pedestal"
                type="button"
                onClick={() => setShowTrophyShowcase(true)}
                title="View World Cup Trophy Showcase"
                className="flex flex-col items-center justify-center w-36 shrink-0 pl-1 group cursor-pointer focus:outline-none"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-200 border-[3px] border-black flex flex-col items-center justify-center shadow-[0_4px_0_#000] group-hover:shadow-[0_6px_0_#000] group-active:translate-y-0.5 group-active:shadow-[0_2px_0_#000] transition-all relative"
                >
                  <Sparkles size={15} className="text-white absolute top-1 right-1 animate-pulse" />
                  <Trophy size={36} className="text-black fill-black drop-shadow-sm group-hover:scale-110 transition-transform" />
                </motion.div>
                <div className="mt-2 flex flex-col items-center text-center">
                  <span className="text-xs font-black uppercase text-amber-400 tracking-wider group-hover:text-amber-300 transition-colors">
                    CHAMPION CUP
                  </span>
                  <span className="text-[9px] font-bold text-neutral-400 uppercase mt-0.5">
                    Glory & Trophy
                  </span>
                </div>
              </button>
            </section>
          </div>
        </div>

        {/* BOTTOM: OPPONENT VS YOU CARDS & KICK OFF MATCH (As drawn in Image 1) */}
        <div className="w-full max-w-xl mx-auto px-4 py-2 sm:py-3 shrink-0 flex flex-col items-center gap-2 sm:gap-3 z-20">
          {/* Head-to-Head Cards */}
          <div className="w-full flex items-center justify-between gap-2.5 sm:gap-4">
            {/* Left Box: Opponent Card */}
            <div className="flex-1 bg-gradient-to-b from-neutral-900 to-neutral-950 border-2 border-rose-500/80 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center shadow-[0_3.5px_0_#000]">
              <div className="mb-1.5 flex items-center justify-center">
                <CountryFlag country={opponentTeam.name} size="lg" rounded="md" />
              </div>
              <span className="text-xs sm:text-sm font-black uppercase text-rose-300 tracking-wide truncate max-w-full">
                {opponentTeam.name}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase mt-0.5">
                {opponentTeam.isPlayer ? 'Player' : `AI ${opponentTeam.difficulty || 'Normal'}`}
              </span>
            </div>

            {/* Center: Bold VS Badge */}
            <div className="flex flex-col items-center shrink-0">
              <span className="px-2.5 sm:px-3 py-1 bg-amber-400 text-black text-xs sm:text-sm font-black italic rounded-xl border-2 border-black shadow-[0_2px_0_#000]">
                VS
              </span>
            </div>

            {/* Right Box: Player Card */}
            <div className="flex-1 bg-gradient-to-b from-neutral-900 to-neutral-950 border-2 border-sky-400/80 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center text-center shadow-[0_3.5px_0_#000]">
              <div className="mb-1.5 flex items-center justify-center">
                <CountryFlag
                  country={playerTeam.isPlayer ? playerCountry : playerTeam.name}
                  size="lg"
                  rounded="md"
                />
              </div>
              <span className="text-xs sm:text-sm font-black uppercase text-sky-300 tracking-wide truncate max-w-full">
                {playerTeam.isPlayer ? playerName : playerTeam.name}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase mt-0.5">
                PLAYER 1
              </span>
            </div>
          </div>

          {/* Match Round Badge & Target Goals */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-400 text-black text-[9px] sm:text-[10px] font-black uppercase rounded-lg border border-black shadow-[0_1.5px_0_#000]">
              {selectedMatch.label}
            </span>
            <span className="text-[9px] sm:text-[10px] font-black text-neutral-300 uppercase tracking-wide">
              FIRST TO {selectedMatch.targetGoals}
            </span>
          </div>

          {/* Rewarded Pre-Match Booster (Optional Power Kick advantage) */}
          {isSelectedActive && !hasBooster && (
            <button
              id="btn-booster-ad"
              type="button"
              disabled={isWatchingBoosterAd}
              onClick={handleWatchBoosterAd}
              className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 active:scale-98 text-amber-300 border-2 border-black rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-[0_2px_0_#000] cursor-pointer transition-transform"
            >
              <Tv size={14} />
              <span>⚡ START WITH SUPER POWER KICK (WATCH 1 AD)</span>
            </button>
          )}

          {isSelectedActive && hasBooster && (
            <div
              id="booster-active-badge"
              className="w-full py-2 px-3 bg-amber-400 text-black border-2 border-black rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-[0_2px_0_#000]"
            >
              <span>🚀 ROCKET POWER KICK ARMED FOR KICKOFF!</span>
            </div>
          )}

          {/* Large Kick Off Button */}
          <button
            id="btn-kickoff-tournament"
            type="button"
            disabled={!isSelectedActive}
            onClick={() => {
              const sanitizedMatch: BracketMatch = {
                ...selectedMatch,
                teamA: selectedMatch.teamA.isPlayer ? selectedMatch.teamA : sanitizeTournamentTeam(selectedMatch.teamA, playerCountry),
                teamB: selectedMatch.teamB.isPlayer ? selectedMatch.teamB : sanitizeTournamentTeam(selectedMatch.teamB, playerCountry),
              };
              onKickoffMatch(sanitizedMatch, hasBooster);
            }}
            className={`w-full py-2.5 sm:py-3 px-6 rounded-2xl border-[3px] border-black font-black text-xs sm:text-sm md:text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all select-none touch-manipulation cursor-pointer ${
              isSelectedActive
                ? 'bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-black shadow-[0_4px_0_#000]'
                : 'bg-neutral-800 text-white/40 cursor-not-allowed border-neutral-700 shadow-none'
            }`}
          >
            {isSelectedActive ? (
              <>
                <Play size={16} className="fill-black" />
                <span>KICK OFF MATCH</span>
              </>
            ) : selectedMatch.status === 'completed' ? (
              <>
                <CheckCircle2 size={16} />
                <span>COMPLETED ({selectedMatch.teamA.score}:{selectedMatch.teamB.score})</span>
              </>
            ) : (
              <>
                <Lock size={16} />
                <span>ROUND LOCKED</span>
              </>
            )}
          </button>
        </div>
      </main>

      {/* World Cup Trophy Showcase Modal */}
      {showTrophyShowcase && (
        <TrophyShowcaseModal
          playerName={playerName}
          playerCountry={playerCountry}
          trophiesWon={trophiesWon}
          onClose={() => setShowTrophyShowcase(false)}
        />
      )}
    </div>
  );
};

/* =========================================================================
   MINIMAL FIXTURE NODE
   Displays minimal made-up logos and team titles at the bottom center of the logos.
   For the next phases, "?" logos is enough!
   ========================================================================= */
interface MinimalFixtureNodeProps {
  match: BracketMatch;
  isActiveUserMatch: boolean;
  isSelected: boolean;
  onSelect: () => void;
  playerName?: string;
  playerCountry?: string;
}

const MinimalFixtureNode: React.FC<MinimalFixtureNodeProps> = ({
  match,
  isActiveUserMatch,
  isSelected,
  onSelect,
  playerName,
  playerCountry,
}) => {
  const isUnknownA =
    match.teamA.name.startsWith('Winner') ||
    match.teamA.name.startsWith('Finalist') ||
    match.teamA.badge === '❓';

  const isUnknownB =
    match.teamB.name.startsWith('Winner') ||
    match.teamB.name.startsWith('Finalist') ||
    match.teamB.badge === '❓';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full p-2 rounded-2xl border-[2.5px] flex items-center justify-between gap-1 transition-all cursor-pointer select-none touch-manipulation ${
        isActiveUserMatch
          ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400 shadow-[0_3.5px_0_#000]'
          : isSelected
          ? 'border-white bg-neutral-900 shadow-[0_3px_0_#000]'
          : match.status === 'completed'
          ? 'border-black bg-neutral-950 text-neutral-400 shadow-[0_2px_0_#000]'
          : 'border-white/15 bg-neutral-900/70 hover:border-white/35'
      }`}
    >
      {/* Team A: Logo + Title at bottom center of the logo */}
      <TeamMinimalBadge
        team={match.teamA.isPlayer ? match.teamA : sanitizeTournamentTeam(match.teamA, playerCountry || 'Brazil')}
        isUnknown={isUnknownA}
        isWinner={match.winner === 'A'}
        playerName={playerName}
        playerCountry={playerCountry}
      />

      {/* Center Divider: Score or VS */}
      <div className="flex flex-col items-center justify-center px-1 shrink-0">
        {match.status === 'completed' ? (
          <span className="text-xs font-black font-mono text-amber-400 tracking-tight">
            {match.teamA.score} : {match.teamB.score}
          </span>
        ) : (
          <span
            className={`text-[9px] font-black uppercase px-1 py-0.5 rounded ${
              isActiveUserMatch
                ? 'bg-amber-400 text-black'
                : 'text-neutral-500 bg-black/40'
            }`}
          >
            {isActiveUserMatch ? 'PLAY' : 'VS'}
          </span>
        )}
      </div>

      {/* Team B: Logo + Title at bottom center of the logo */}
      <TeamMinimalBadge
        team={match.teamB.isPlayer ? match.teamB : sanitizeTournamentTeam(match.teamB, playerCountry || 'Brazil')}
        isUnknown={isUnknownB}
        isWinner={match.winner === 'B'}
        playerName={playerName}
        playerCountry={playerCountry}
      />
    </button>
  );
};

interface TeamMinimalBadgeProps {
  team: BracketTeam;
  isUnknown: boolean;
  isWinner: boolean;
  playerName?: string;
  playerCountry?: string;
}

const TeamMinimalBadge: React.FC<TeamMinimalBadgeProps> = ({
  team,
  isUnknown,
  isWinner,
  playerName,
  playerCountry,
}) => {
  if (isUnknown) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Minimal ? logo */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-white/20 bg-neutral-900 flex items-center justify-center text-sm font-black text-white/50 shadow-[0_2px_0_#000]">
          ?
        </div>
        {/* Team title at bottom center of logo */}
        <span className="text-[9px] sm:text-[10px] font-black uppercase text-white/40 tracking-tight mt-1 truncate max-w-[60px] sm:max-w-[70px] text-center leading-tight">
          ?
        </span>
      </div>
    );
  }

  const isPlayer = team.isPlayer;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      {/* Authentic Country Flag */}
      <div className="relative">
        <CountryFlag
          country={isPlayer && playerCountry ? playerCountry : team.name}
          size="sm"
          rounded="sm"
          className="shadow-[0_2px_0_#000]"
        />
        {isWinner && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-400 border border-black rounded-full flex items-center justify-center text-[8px] font-black text-black shadow-xs">
            ✓
          </span>
        )}
      </div>

      {/* Team Title at the bottom center of the flag */}
      <span
        className={`text-[9px] sm:text-[10px] font-black uppercase tracking-tight mt-1 truncate max-w-[64px] sm:max-w-[74px] text-center leading-tight ${
          isPlayer ? 'text-sky-300 font-black' : isWinner ? 'text-amber-300' : 'text-neutral-200'
        }`}
      >
        {isPlayer && playerName ? playerName : team.name}
      </span>
    </div>
  );
};

/* =========================================================================
   WORLD CUP TROPHY SHOWCASE MODAL
   Celebrates user achievements, trophies won, and triggers glorious confetti.
   ========================================================================= */
interface TrophyShowcaseModalProps {
  playerName: string;
  playerCountry: string;
  trophiesWon: number;
  onClose: () => void;
}

export const TrophyShowcaseModal: React.FC<TrophyShowcaseModalProps> = ({
  playerName,
  playerCountry,
  trophiesWon,
  onClose,
}) => {
  const [hasCelebrated, setHasCelebrated] = useState(false);

  const handleCelebrate = () => {
    setHasCelebrated(true);
    soundEffects.playGoal();
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#f59e0b', '#10b981', '#38bdf8', '#ffffff'],
    });
    setTimeout(() => setHasCelebrated(false), 2000);
  };

  return (
    <div
      id="trophy-showcase-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm bg-neutral-950 border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[0_8px_0_#000] text-center flex flex-col items-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl bg-neutral-900 border-2 border-white/20 text-white/70 hover:text-white hover:border-white/40 flex items-center justify-center transition-all cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-black font-black text-[10px] sm:text-xs rounded-xl border-2 border-black shadow-[0_2px_0_#000] uppercase tracking-wider mb-4">
          <Award size={14} className="fill-black" />
          <span>TROPHY SHOWCASE</span>
        </div>

        {/* Big Golden Trophy Pedestal */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 1.5, -1.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-200 border-[3px] border-black flex items-center justify-center shadow-[0_6px_0_#000] mb-3"
        >
          <Sparkles size={22} className="text-white absolute top-2 right-2 animate-pulse" />
          <Trophy size={60} className="text-black fill-black drop-shadow-md" />
        </motion.div>

        {/* Player Identity Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-2 border-white/15 rounded-2xl shadow-[0_2px_0_#000] mb-3">
          <CountryFlag country={playerCountry} size="sm" rounded="sm" shadow={false} />
          <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
            {playerName}
          </span>
          <span className="text-[10px] text-white/50 font-bold uppercase">
            ({playerCountry})
          </span>
        </div>

        {/* Trophies Counter */}
        <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight leading-none mb-1">
          {trophiesWon}
        </div>
        <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-400 tracking-widest mb-3">
          WORLD CUPS WON
        </span>

        {/* Cabinet Description */}
        <p className="text-[11px] text-neutral-300 leading-relaxed max-w-xs mb-4">
          {trophiesWon > 0
            ? 'Honored Champion! Your nation’s victories are preserved here. Keep conquering knockout cups to build your dynasty!'
            : 'No trophies in your cabinet yet! Defeat 3 knockout rounds in the World Cup tournament to lift your first gold trophy.'}
        </p>

        {/* Interactive Lift The Cup / Celebrate Button */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCelebrate}
            className={`w-full py-2.5 sm:py-3 px-4 rounded-2xl border-[3px] border-black font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] ${
              hasCelebrated
                ? 'bg-emerald-400 text-black'
                : 'bg-amber-400 hover:bg-amber-300 text-black'
            }`}
          >
            <Sparkles size={16} />
            <span>{hasCelebrated ? 'GLORY UNLEASHED! 🎉' : 'LIFT THE CUP!'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white/80 font-black text-xs uppercase border-2 border-white/20 rounded-xl transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

