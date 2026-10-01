import React, { useState, useEffect } from 'react';
import { Trophy, Zap, Swords, ShoppingBag, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { CountryFlag } from './CountryFlag';
import { LeaderboardDropdown } from './LeaderboardDropdown';
import { CountryFlagDropdown } from './CountryFlagDropdown';

interface HomeScreenProps {
  onSelectQuickMode: (mode: 'pinball' | 'team') => void;
  onOpenTournament: () => void;
  onOpenTwoPlayer: () => void;
  onOpenShop: () => void;
  onOpenOnline?: () => void;
  currentStreak?: number;
  playerName?: string;
  playerCountry?: string;
  onUpdatePlayerName?: (name: string) => void;
  onSelectCountry?: (countryName: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectQuickMode,
  onOpenTournament,
  onOpenTwoPlayer,
  onOpenShop,
  onOpenOnline,
  currentStreak = 0,
  playerName = 'Player1',
  playerCountry = 'Brazil',
  onUpdatePlayerName,
  onSelectCountry,
}) => {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isFlagPickerOpen, setIsFlagPickerOpen] = useState(false);
  const [localName, setLocalName] = useState(playerName);

  useEffect(() => {
    setLocalName(playerName);
  }, [playerName]);

  return (
    <div
      id="home-screen-root"
      className="absolute inset-0 w-full h-full z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs select-none px-4 font-sans overflow-hidden"
    >
      {/* Top-Left: Minimal Leaderboard Dropdown */}
      <div className="absolute top-3 sm:top-5 left-3 sm:left-6 z-50">
        <div className="relative">
          <button
            id="btn-home-leaderboard"
            type="button"
            onClick={() => {
              setIsLeaderboardOpen((prev) => !prev);
              setIsFlagPickerOpen(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-yellow-300 hover:bg-yellow-200 active:translate-y-0.5 border-2 sm:border-[2.5px] border-black rounded-xl sm:rounded-2xl shadow-[0_3px_0_#000] sm:shadow-[0_4px_0_#000] text-black font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer select-none transition-all"
            title="Toggle Leaderboard Dropdown"
          >
            <Trophy size={16} className="fill-black" />
            <span>LEADERBOARD</span>
            {currentStreak > 0 && (
              <span className="flex items-center gap-0.5 bg-black text-amber-300 px-1.5 py-0.2 rounded text-[10px] font-black font-mono">
                🔥 {currentStreak}
              </span>
            )}
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isLeaderboardOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Minimal Dropdown */}
          <LeaderboardDropdown
            isOpen={isLeaderboardOpen}
            onClose={() => setIsLeaderboardOpen(false)}
          />
        </div>
      </div>

      {/* Top-Center: Player Identity Capsule & Country Flag Dropdown */}
      <div className="absolute top-3 sm:top-5 left-1/2 -translate-x-1/2 z-50">
        <div className="relative">
          <div className="flex items-center gap-2 bg-neutral-900/90 border-2 sm:border-[2.5px] border-black rounded-full px-3 py-1.5 shadow-[0_3px_0_#000] sm:shadow-[0_4px_0_#000] text-white">
            {/* Clickable Country Flag with dropdown chevron */}
            <button
              id="btn-home-flag-picker"
              type="button"
              onClick={() => {
                setIsFlagPickerOpen((prev) => !prev);
                setIsLeaderboardOpen(false);
              }}
              className="flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              title="Select Country Flag"
            >
              <CountryFlag country={playerCountry} size="xs" rounded="sm" shadow={false} />
              <ChevronDown
                size={12}
                className={`text-white/70 transition-transform duration-200 ${isFlagPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <span className="w-px h-3.5 bg-white/20" />

            {/* Inline Editable Player Name */}
            <input
              id="input-home-player-name"
              type="text"
              value={localName}
              onChange={(e) => {
                const val = e.target.value;
                setLocalName(val);
                if (val.trim().length > 0) {
                  onUpdatePlayerName?.(val.slice(0, 14));
                }
              }}
              onBlur={() => {
                const trimmed = localName.trim();
                const finalName = trimmed.length > 0 ? trimmed.slice(0, 14) : 'Player1';
                setLocalName(finalName);
                onUpdatePlayerName?.(finalName);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Player1"
              maxLength={14}
              className="w-20 sm:w-24 bg-transparent text-xs sm:text-sm font-black text-center text-white focus:text-amber-300 outline-none uppercase font-mono tracking-wider selection:bg-amber-400 selection:text-black cursor-text"
              title="Click to edit your player name"
            />
          </div>

          {/* Minimal Country Flag Dropdown with Search Bar */}
          <CountryFlagDropdown
            isOpen={isFlagPickerOpen}
            selectedCountry={playerCountry}
            onSelectCountry={(country) => {
              onSelectCountry?.(country);
              setIsFlagPickerOpen(false);
            }}
            onClose={() => setIsFlagPickerOpen(false)}
          />
        </div>
      </div>

      {/* Top Header Chrome: Dedicated Shop Button at Top-Right Corner */}
      <div className="absolute top-3 sm:top-5 right-3 sm:right-6 z-50 flex items-center gap-2">
        <button
          id="btn-home-shop"
          type="button"
          onClick={onOpenShop}
          className="group flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 border-2 sm:border-[2.5px] border-black rounded-xl sm:rounded-2xl shadow-[0_3px_0_#000] sm:shadow-[0_4px_0_#000] text-black font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer select-none touch-manipulation transition-all"
        >
          <ShoppingBag size={17} className="fill-black group-hover:scale-110 transition-transform" />
          <span>SHOP</span>
          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-black text-amber-300 rounded border border-black/40">
            NEW
          </span>
        </button>
      </div>
      <div className="flex flex-col items-center justify-center -translate-y-3 sm:-translate-y-5 w-full max-w-md animate-scale-up">
        {/* 1. Emphasized Stylized Diagonal Game Title */}
        <div className="flex flex-col items-center text-center transform -rotate-2 sm:-rotate-3 select-none transition-transform hover:scale-102">
          <h1
            id="home-title"
            className="flex flex-col items-center font-black italic tracking-tighter uppercase leading-[0.84]"
          >
            {/* Top Line: SOCCER */}
            <span className="text-6xl xs:text-7xl sm:text-8xl md:text-9xl font-black text-white drop-shadow-[0_4px_0_#000] drop-shadow-[0_12px_28px_rgba(0,0,0,0.95)]">
              SOCCER
            </span>

            {/* Bottom Line: ⚽ + PINBALL */}
            <span className="flex items-center justify-center gap-2 sm:gap-3 text-4xl xs:text-5xl sm:text-6xl md:text-7xl font-black text-amber-400 drop-shadow-[0_4px_0_#000] drop-shadow-[0_10px_20px_rgba(0,0,0,0.95)] mt-1">
              <span
                id="title-soccer-ball"
                className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl inline-block -rotate-12 drop-shadow-[0_4px_0_#000] drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)] animate-pulse"
                aria-label="Soccer Ball"
              >
                ⚽
              </span>
              <span className="text-amber-400">PINBALL</span>
            </span>
          </h1>
        </div>

        {/* 2. Organized Mode Selection Deck */}
        <div className="mt-6 sm:mt-8 w-full max-w-[310px] sm:max-w-[340px] flex items-center justify-center">
          <div className="flex flex-col items-center w-full space-y-2.5">
            <span
              id="select-mode-label"
              className="text-[10px] sm:text-[11px] font-black tracking-[0.25em] text-white/80 uppercase mb-0.5"
            >
              SELECT GAME MODE
            </span>

            {/* Option 1: Quick Game - Immediately starts Pinball mode */}
            <button
              id="btn-main-quick"
              type="button"
              onClick={() => onSelectQuickMode('pinball')}
              className="w-full group py-2.5 px-3.5 bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 active:shadow-[0_1px_0_#000] border-2 border-black rounded-xl flex items-center justify-between shadow-[0_3.5px_0_#000] transition-all cursor-pointer select-none text-black touch-manipulation"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center shadow-[0_1.5px_0_#000] group-hover:scale-105 transition-transform">
                  <Zap size={18} className="text-black fill-black" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-xs sm:text-sm font-black tracking-wide uppercase">
                    QUICK GAME
                  </span>
                  <span className="text-[9px] font-extrabold text-black/70 mt-1 uppercase">
                    Instant Pinball Match vs AI
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-black/60 group-hover:translate-x-0.5 transition-transform">
                ➔
              </span>
            </button>

            {/* Option 2: Full-Blown Tournament Hub */}
            <button
              id="btn-main-tournament"
              type="button"
              onClick={onOpenTournament}
              className="w-full group py-2.5 px-3.5 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 active:shadow-[0_1px_0_#000] border-2 border-black rounded-xl flex items-center justify-between shadow-[0_3.5px_0_#000] transition-all cursor-pointer select-none text-black touch-manipulation"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center shadow-[0_1.5px_0_#000] group-hover:scale-105 transition-transform">
                  <Trophy size={18} className="text-amber-600 fill-amber-500" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-xs sm:text-sm font-black tracking-wide uppercase flex items-center gap-1.5">
                    TOURNAMENT
                    <span className="px-1.5 py-0.2 bg-black text-amber-300 text-[8px] font-black rounded">
                      TREE
                    </span>
                  </span>
                  <span className="text-[9px] font-extrabold text-black/70 mt-1 uppercase">
                    Full Cup Bracket Page
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-black/60 group-hover:translate-x-0.5 transition-transform">
                ➔
              </span>
            </button>

            {/* Option 3: Full-Blown 2-Player Versus Arena */}
            <button
              id="btn-main-2player"
              type="button"
              onClick={onOpenTwoPlayer}
              className="w-full group py-3 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:translate-y-0.5 active:shadow-[0_1px_0_#000] border-[2.5px] border-black rounded-xl flex items-center justify-between shadow-[0_4px_0_#000] transition-all cursor-pointer select-none text-white touch-manipulation relative"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center shadow-[0_1.5px_0_#000] group-hover:scale-105 transition-transform">
                  <Swords size={18} className="text-black" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-xs sm:text-sm font-black tracking-wide uppercase flex items-center gap-1.5">
                    2-PLAYER ARENA
                    <span className="px-1.5 py-0.5 bg-amber-400 text-black text-[8px] font-black rounded border border-black animate-pulse">
                      🔥 HOT
                    </span>
                  </span>
                  <span className="text-[9px] font-extrabold text-white/90 mt-1 uppercase">
                    Same Keyboard • 1v1 Versus
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-white/80 group-hover:translate-x-1 transition-transform">
                ➔
              </span>
            </button>

            {/* Option 4: Online Multiplayer via Playroom Kit */}
            {onOpenOnline && (
              <button
                id="btn-main-online"
                type="button"
                onClick={onOpenOnline}
                className="w-full group py-2.5 px-3.5 bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 active:shadow-[0_1px_0_#000] border-2 border-black rounded-xl flex items-center justify-between shadow-[0_3.5px_0_#000] transition-all cursor-pointer select-none text-black touch-manipulation"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center shadow-[0_1.5px_0_#000] group-hover:scale-105 transition-transform">
                    <span className="text-lg leading-none">🌐</span>
                  </div>
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-xs sm:text-sm font-black tracking-wide uppercase flex items-center gap-1.5">
                      ONLINE
                      <span className="px-1.5 py-0.2 bg-black text-emerald-300 text-[8px] font-black rounded">
                        NEW
                      </span>
                    </span>
                    <span className="text-[9px] font-extrabold text-black/60 mt-1 uppercase">
                      Global Matchmaking • 1v1
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-black/60 group-hover:translate-x-0.5 transition-transform">
                  ➔
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
