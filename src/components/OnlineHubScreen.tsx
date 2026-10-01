/**
 * OnlineHubScreen.tsx
 * Pre-match online lobby/matchmaking screen for Soccer Pinball online mode.
 * Shown before Playroom Kit lobby UI appears, and while searching for an opponent.
 */

import React from 'react';
import { Globe, ArrowLeft, Wifi } from 'lucide-react';
import { CountryFlag } from './CountryFlag';

interface OnlineHubScreenProps {
  playerName: string;
  playerCountry: string;
  playerFlag: string;
  isSearching: boolean;
  onFindMatch: () => void;
  onBack: () => void;
}

export const OnlineHubScreen: React.FC<OnlineHubScreenProps> = ({
  playerName,
  playerCountry,
  playerFlag,
  isSearching,
  onFindMatch,
  onBack,
}) => {
  return (
    <div
      id="online-hub-root"
      className="absolute inset-0 w-full h-full z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm select-none px-4 font-sans overflow-hidden"
    >
      {/* Back button — top left */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50">
        <button
          type="button"
          onClick={onBack}
          disabled={isSearching}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-100 active:translate-y-0.5 border-2 border-black rounded-xl shadow-[0_3px_0_#000] text-black font-black text-xs uppercase tracking-wider cursor-pointer select-none transition-all disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
        >
          <ArrowLeft size={15} />
          BACK
        </button>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Title block */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <Globe size={32} className="text-emerald-400 drop-shadow-[0_2px_0_#000]" />
            <h1 className="text-3xl sm:text-4xl font-black text-white italic uppercase tracking-tight drop-shadow-[0_3px_0_#000]">
              ONLINE MATCH
            </h1>
          </div>
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
            Powered by Playroom · Free Global Matchmaking
          </p>
        </div>

        {/* Player identity card */}
        <div className="w-full bg-neutral-900 border-2 border-black rounded-2xl shadow-[0_4px_0_#000] p-4 flex items-center gap-4">
          <div className="flex-shrink-0">
            <CountryFlag country={playerCountry} size="md" rounded="lg" shadow={true} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
              YOU ARE
            </span>
            <span className="text-lg font-black text-white uppercase tracking-wide leading-none mt-0.5">
              {playerName}
            </span>
            <span className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <span>{playerFlag}</span>
              <span>{playerCountry}</span>
            </span>
          </div>
          <div className="ml-auto">
            <div className="w-10 h-10 rounded-xl bg-emerald-400 border-2 border-black shadow-[0_2px_0_#000] flex items-center justify-center">
              <Wifi size={20} className="text-black" />
            </div>
          </div>
        </div>

        {/* Match details info */}
        <div className="w-full bg-amber-400/10 border-2 border-amber-400/40 rounded-xl p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-white/60 uppercase tracking-wider">Mode</span>
            <span className="font-black text-amber-400 uppercase">1v1 Online</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-white/60 uppercase tracking-wider">Players</span>
            <span className="font-black text-white uppercase">2 per room</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-white/60 uppercase tracking-wider">Region</span>
            <span className="font-black text-emerald-400 uppercase">Auto-matched</span>
          </div>
        </div>

        {/* Find Match / Searching button */}
        {isSearching ? (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="w-full py-4 bg-neutral-700 border-2 border-black rounded-2xl shadow-[0_4px_0_#000] flex items-center justify-center gap-3">
              {/* Pulsing dots */}
              <span className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="text-base font-black text-white uppercase tracking-widest animate-pulse">
                FINDING OPPONENT...
              </span>
            </div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">
              Playroom lobby is loading · Please wait
            </p>
          </div>
        ) : (
          <button
            id="btn-online-find-match"
            type="button"
            onClick={onFindMatch}
            className="w-full group py-4 px-6 bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 active:shadow-[0_1px_0_#000] border-2 border-black rounded-2xl flex items-center justify-between shadow-[0_4px_0_#000] transition-all cursor-pointer select-none text-black touch-manipulation"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-black border-2 border-black flex items-center justify-center group-hover:scale-105 transition-transform">
                <Globe size={20} className="text-emerald-400" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-sm font-black tracking-wide uppercase">FIND MATCH</span>
                <span className="text-[9px] font-extrabold text-black/60 mt-1 uppercase">
                  Global matchmaking · 1v1
                </span>
              </div>
            </div>
            <span className="text-sm font-black text-black/60 group-hover:translate-x-0.5 transition-transform">
              ➔
            </span>
          </button>
        )}

        {/* Footer note */}
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest text-center px-4">
          🌐 Playroom Kit · Free multiplayer · No account required
        </p>
      </div>
    </div>
  );
};
