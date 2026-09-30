import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Tv,
  Sparkles,
  Flame,
  Zap,
  ShoppingBag,
  ShieldCheck,
  Coins,
  Plus,
  Users,
  Award,
  ChevronRight,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ballSkinManager, BallSkin } from '../services/BallSkinManager';
import { rosterManager, RosterPlayer } from '../services/RosterManager';
import { leaderboardService } from '../services/LeaderboardService';
import { platformSDK } from '../services/PlatformSDK';
import { soundEffects } from '../audio/SoundEffects';
import { CountryFlag } from './CountryFlag';

interface ShopScreenProps {
  onBackToHome: () => void;
  onSelectSkin: (skinId: string) => void;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({
  onBackToHome,
  onSelectSkin,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'players' | 'accessories'>('players');
  const [, setVersion] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'legendary' | 'rare' | 'common'>('all');
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adFeedback, setAdFeedback] = useState<string | null>(null);
  const [selectedPedestalSlot, setSelectedPedestalSlot] = useState<0 | 1 | 2 | null>(null);
  const [assigningPlayerId, setAssigningPlayerId] = useState<string | null>(null);
  const [coins, setCoins] = useState(() => leaderboardService.getCoins());

  useEffect(() => {
    const unsubBall = ballSkinManager.subscribe(() => setVersion((v) => v + 1));
    const unsubRoster = rosterManager.subscribe(() => setVersion((v) => v + 1));
    const unsubLeaderboard = leaderboardService.subscribe(() => {
      setCoins(leaderboardService.getCoins());
      setVersion((v) => v + 1);
    });
    return () => {
      unsubBall();
      unsubRoster();
      unsubLeaderboard();
    };
  }, []);

  const skins = ballSkinManager.getAvailableSkins();
  const activeSkin = ballSkinManager.getActiveSkin();
  const allPlayers = rosterManager.getAllPlayers();
  const activeSquad = rosterManager.getActiveSquad();

  // Ball Tab Actions
  const handleEquipBall = (skinId: string) => {
    soundEffects.playKick();
    ballSkinManager.setActiveSkin(skinId);
    onSelectSkin(skinId);
  };

  const handleUnlockBallWithAd = (skin: BallSkin) => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    setAdFeedback(`Watching sponsor ad for ${skin.name}...`);

    platformSDK.requestRewardedAd({
      onStarted: () => setAdFeedback(`Watching ad...`),
      onFinished: () => {
        setIsWatchingAd(false);
        setAdFeedback(null);
      },
      onError: () => {
        setIsWatchingAd(false);
        setAdFeedback('Ad was not completed. Please try again!');
        setTimeout(() => setAdFeedback(null), 3000);
      },
      rewardGranted: () => {
        setIsWatchingAd(false);
        setAdFeedback(null);
        ballSkinManager.unlockSkin(skin.id);
        ballSkinManager.setActiveSkin(skin.id);
        onSelectSkin(skin.id);
        soundEffects.playWhistle();
      },
    });
  };

  // Player Tab Actions
  const handleAssignToSlot = (playerId: string, slotIndex: 0 | 1 | 2) => {
    const success = rosterManager.assignPlayerToSlot(playerId, slotIndex);
    if (success) {
      soundEffects.playPlayerPlace();
      setAssigningPlayerId(null);
      setSelectedPedestalSlot(null);
    }
  };

  const handleBuyPlayer = (player: RosterPlayer) => {
    if (coins < player.cost) {
      setAdFeedback(`Need ${player.cost - coins} more coins! Watch a sponsor ad below.`);
      setTimeout(() => setAdFeedback(null), 3000);
      return;
    }
    const success = rosterManager.unlockPlayer(player.id);
    if (success) {
      soundEffects.playWhistle();
      setCoins(leaderboardService.getCoins());
    }
  };

  const handleUnlockPlayerWithAd = (player: RosterPlayer) => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    setAdFeedback(`Scouting ${player.name} with sponsor ad...`);

    platformSDK.requestRewardedAd({
      onStarted: () => setAdFeedback(`Watching sponsor ad...`),
      onFinished: () => {
        setIsWatchingAd(false);
        setAdFeedback(null);
      },
      onError: () => {
        setIsWatchingAd(false);
        setAdFeedback('Ad was interrupted. Try again!');
        setTimeout(() => setAdFeedback(null), 3000);
      },
      rewardGranted: () => {
        setIsWatchingAd(false);
        setAdFeedback(null);
        rosterManager.unlockPlayer(player.id, true);
        soundEffects.playGoal();
      },
    });
  };

  const handleWatchAdForCoins = () => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    setAdFeedback('Watching sponsor ad for +100 bonus coins...');

    platformSDK.requestRewardedAd({
      onStarted: () => setAdFeedback('Watching ad for +100 Coins...'),
      onFinished: () => {
        setIsWatchingAd(false);
        setAdFeedback(null);
      },
      onError: () => {
        setIsWatchingAd(false);
        setAdFeedback('Ad interrupted. Coins not credited.');
        setTimeout(() => setAdFeedback(null), 3000);
      },
      rewardGranted: () => {
        setIsWatchingAd(false);
        setAdFeedback(null);
        leaderboardService.addCoins(100);
        soundEffects.playGoal();
      },
    });
  };

  const getRarityBadge = (rarity: 'common' | 'rare' | 'legendary') => {
    switch (rarity) {
      case 'legendary':
        return (
          <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-black border border-black shadow-[0_1.5px_0_#000] flex items-center gap-1">
            <Sparkles size={10} className="fill-black" />
            <span>LEGEND</span>
          </span>
        );
      case 'rare':
        return (
          <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500 text-white border border-black shadow-[0_1.5px_0_#000] flex items-center gap-1">
            <Zap size={10} />
            <span>RARE</span>
          </span>
        );
      default:
        return (
          <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-neutral-700 text-white/90 border border-black shadow-[0_1.5px_0_#000] flex items-center gap-1">
            <ShieldCheck size={10} />
            <span>STANDARD</span>
          </span>
        );
    }
  };

  const renderBallVisual = (skin: BallSkin) => {
    if (skin.previewImage) {
      return (
        <img
          src={skin.previewImage}
          alt={skin.name}
          className="w-full h-full object-contain p-2 drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-105"
        />
      );
    }

    switch (skin.id) {
      case 'gold':
        return (
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-yellow-100 via-amber-400 to-yellow-700 shadow-[0_0_35px_rgba(245,158,11,0.5),inset_0_4px_8px_rgba(255,255,255,0.8),inset_0_-8px_12px_rgba(113,63,18,0.9)] flex items-center justify-center border-[3px] border-amber-300 transform group-hover:scale-110 transition-transform duration-300">
            <div className="absolute inset-2 rounded-full border border-yellow-200/40 border-dashed" />
            <Sparkles size={36} className="fill-yellow-100 text-yellow-900 animate-pulse drop-shadow-md" />
            <div className="absolute top-2 left-4 w-6 h-3 bg-white/70 rounded-full blur-[2px] transform -rotate-30" />
          </div>
        );
      case 'fire':
        return (
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-yellow-300 via-orange-500 to-red-700 shadow-[0_0_35px_rgba(239,68,68,0.6),inset_0_4px_8px_rgba(255,255,255,0.7),inset_0_-8px_12px_rgba(69,10,10,0.9)] flex items-center justify-center border-[3px] border-orange-400 transform group-hover:scale-110 transition-transform duration-300">
            <div className="absolute inset-1 rounded-full bg-gradient-to-t from-red-600/30 to-yellow-400/40 animate-pulse" />
            <Flame size={36} className="fill-orange-400 text-yellow-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
            <div className="absolute top-2 left-4 w-6 h-3 bg-white/60 rounded-full blur-[2px] transform -rotate-30" />
          </div>
        );
      case 'cyber':
        return (
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-cyan-300 via-sky-600 to-indigo-950 shadow-[0_0_35px_rgba(6,182,212,0.6),inset_0_4px_8px_rgba(255,255,255,0.7),inset_0_-8px_12px_rgba(8,47,73,0.9)] flex items-center justify-center border-[3px] border-cyan-400 transform group-hover:scale-110 transition-transform duration-300">
            <div className="absolute inset-2 rounded-full border border-cyan-300/50 border-dotted" />
            <Zap size={36} className="fill-cyan-300 text-cyan-950 drop-shadow-[0_0_12px_rgba(6,182,212,0.9)]" />
            <div className="absolute top-2 left-4 w-6 h-3 bg-white/70 rounded-full blur-[2px] transform -rotate-30" />
          </div>
        );
      default:
        return (
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-white via-neutral-100 to-neutral-400 shadow-[0_8px_25px_rgba(0,0,0,0.8),inset_0_4px_8px_rgba(255,255,255,0.9),inset_0_-8px_12px_rgba(0,0,0,0.5)] flex items-center justify-center border-[3px] border-black transform group-hover:scale-110 transition-transform duration-300">
            <span className="text-5xl select-none filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]">
              ⚽
            </span>
            <div className="absolute top-2 left-4 w-6 h-3 bg-white/80 rounded-full blur-[2px] transform -rotate-30" />
          </div>
        );
    }
  };

  return (
    <div
      id="shop-screen-page"
      className="absolute inset-0 z-40 flex flex-col bg-neutral-950 text-white font-sans select-none overflow-hidden"
    >
      {/* 1. Header Toolbar matching sketch: Back | SHOP | + 80 Coins */}
      <header className="w-full border-b-[3px] border-black bg-amber-400 px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_0_#000] shrink-0">
        {/* Left: Back button */}
        <button
          id="btn-shop-back"
          type="button"
          onClick={onBackToHome}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs uppercase border-2 border-black rounded-xl shadow-[0_2.5px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] transition-all cursor-pointer touch-manipulation"
        >
          <ArrowLeft size={15} />
          <span>LOBBY</span>
        </button>

        {/* Center: Title */}
        <div className="flex items-center gap-2">
          <ShoppingBag size={20} className="text-black" />
          <h1 className="text-base sm:text-lg font-black text-black tracking-wider uppercase leading-none">
            SHOP
          </h1>
        </div>

        {/* Right: Coins balance with '+' button for rewarded ad sponsor */}
        <div className="flex items-center gap-1.5">
          <div className="px-3 py-1 bg-neutral-900 border-2 border-black rounded-xl text-amber-300 font-mono font-black text-xs sm:text-sm uppercase shadow-[0_2px_0_#000] flex items-center gap-1.5">
            <Coins size={14} className="text-amber-400 fill-amber-400" />
            <span>{coins}</span>
          </div>
          <button
            id="btn-add-coins"
            type="button"
            onClick={handleWatchAdForCoins}
            disabled={isWatchingAd}
            title="Watch Sponsor Ad for +100 Coins"
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 text-black border-2 border-black rounded-xl shadow-[0_2px_0_#000] transition-transform cursor-pointer font-black"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* 2. Top Tab Row directly matching sketch: [ PLAYERS ] | [ ACCS... ] */}
      <nav className="w-full bg-neutral-900 border-b-2 border-black px-3 sm:px-6 py-2 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('players')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer ${
              activeTab === 'players'
                ? 'bg-amber-400 text-black shadow-[0_2.5px_0_#000]'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>PLAYERS (SET)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accessories')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer ${
              activeTab === 'accessories'
                ? 'bg-amber-400 text-black shadow-[0_2.5px_0_#000]'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            <span>BALL SKINS</span>
          </button>
        </div>

        {activeTab === 'players' && (
          <span className="text-[10px] font-bold text-neutral-400 uppercase hidden sm:inline">
            Drag or tap to assign into active tournament trio
          </span>
        )}
      </nav>

      {/* Toast Feedback for Ads / Purchases */}
      <AnimatePresence>
        {adFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full bg-amber-400 border-b-2 border-black py-1.5 px-4 text-center text-xs font-black text-black uppercase tracking-wide flex items-center justify-center gap-2 z-20"
          >
            <Tv size={14} />
            <span>{adFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. TAB CONTENT */}
      {activeTab === 'players' ? (
        <main className="flex-1 flex flex-col justify-between overflow-hidden p-2 sm:p-4 max-w-6xl mx-auto w-full">
          {/* =========================================================
              UPPER SECTION: THE 3 ACTIVE DEPLOYMENT PEDESTALS
              Matches sketch with 3 distinct characters on circular podiums
              ========================================================= */}
          <section
            id="squad-pedestals-stage"
            aria-label="Active 3-Player Squad Stage"
            className="w-full flex-1 max-h-[48%] bg-neutral-900 border-[3px] border-black rounded-3xl p-3 sm:p-4 shadow-[0_6px_0_#000] flex flex-col justify-between overflow-hidden"
          >
            {/* Header label */}
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-amber-400 text-black font-black text-[9px] uppercase rounded-md border border-black shadow-[0_1px_0_#000]">
                  ACTIVE SET
                </span>
                <span className="text-[10px] sm:text-xs font-black text-amber-300 uppercase tracking-wide">
                  TOURNAMENT DEPLOYMENT TRIO
                </span>
              </div>
              <span className="text-[9px] text-neutral-400 font-bold uppercase hidden xs:inline">
                {selectedPedestalSlot !== null ? `SELECT PLAYER BELOW FOR SLOT ${selectedPedestalSlot + 1}` : 'DRAG OR TAP TO SWAP'}
              </span>
            </div>

            {/* The 3 Pedestals Row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 my-auto">
              {activeSquad.map((player, slotIdx) => {
                const isSelected = selectedPedestalSlot === slotIdx;
                const slotLabel = slotIdx === 0 ? 'SLOT 1 • STRIKER' : slotIdx === 1 ? 'SLOT 2 • MIDFIELD' : 'SLOT 3 • DEFENSE';

                return (
                  <div
                    key={`pedestal-slot-${slotIdx}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedPlayerId = e.dataTransfer.getData('text/plain');
                      if (droppedPlayerId) {
                        handleAssignToSlot(droppedPlayerId, slotIdx as 0 | 1 | 2);
                      }
                    }}
                    onClick={() => {
                      if (assigningPlayerId) {
                        handleAssignToSlot(assigningPlayerId, slotIdx as 0 | 1 | 2);
                      } else {
                        setSelectedPedestalSlot(isSelected ? null : (slotIdx as 0 | 1 | 2));
                      }
                    }}
                    className={`group relative flex flex-col items-center justify-between p-2 sm:p-3 rounded-2xl border-[2.5px] transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/15 shadow-[0_4px_0_#000] ring-2 ring-amber-400'
                        : 'border-white/20 bg-neutral-950/70 hover:border-white/50 shadow-[0_3px_0_#000]'
                    }`}
                  >
                    {/* Slot Header Pill */}
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[8px] sm:text-[9px] font-black uppercase text-amber-300/90 tracking-wider">
                        {slotLabel}
                      </span>
                      {getRarityBadge(player.rarity)}
                    </div>

                    {/* Circular Turf Pedestal with Animated Mascot */}
                    <div className="relative my-1 flex flex-col items-center justify-center">
                      <motion.div
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2.2 + slotIdx * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl border-2 border-black flex items-center justify-center shadow-[0_3px_0_#000] relative overflow-hidden"
                        style={{ backgroundColor: player.colors.accent + '25', borderColor: player.colors.accent }}
                      >
                        <span className="text-2xl sm:text-3xl filter drop-shadow-md select-none">
                          {player.avatarEmoji}
                        </span>
                        {/* Corner Country Flag */}
                        <div className="absolute top-1 left-1">
                          <CountryFlag country={player.country} size="xs" rounded="xs" shadow={false} />
                        </div>
                      </motion.div>

                      {/* 3D Circular Pedestal Pod matching sketch */}
                      <div
                        className="w-16 sm:w-22 h-3.5 sm:h-4.5 rounded-[50%] border-2 border-black shadow-[0_3px_0_#000] -mt-2 z-10 flex items-center justify-center"
                        style={{ backgroundColor: player.colors.accent }}
                      >
                        <div className="w-12 sm:w-16 h-1.5 rounded-[50%] bg-white/40 blur-[1px]" />
                      </div>
                    </div>

                    {/* Player Info Box */}
                    <div className="text-center w-full mt-1">
                      <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate">
                        {player.name}
                      </h2>
                      <span className="text-[8px] sm:text-[9px] font-bold text-amber-300 block truncate">
                        {player.perkTitle}
                      </span>
                    </div>

                    {/* Stat Badges Row */}
                    <div className="w-full flex items-center justify-around gap-1 mt-1 text-[8px] sm:text-[9px] font-mono font-bold bg-neutral-900/80 px-1.5 py-0.5 rounded-lg border border-white/10">
                      <span title="Kick Power">⚡ {player.stats.power}</span>
                      <span title="Pass IQ">🧠 {player.stats.iq}</span>
                      <span title="Reaction Speed">⏱ {player.stats.speed}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* =========================================================
              LOWER SECTION: SQUAD ROSTER BENCH & SCOUT MARKET
              Horizontal scrollable deck of cards matching sketch
              ========================================================= */}
          <section
            id="squad-bench-market"
            aria-label="Squad Bench and Transfer Market"
            className="w-full flex-1 max-h-[50%] bg-neutral-900 border-[3px] border-black rounded-3xl p-3 sm:p-4 shadow-[0_6px_0_#000] flex flex-col justify-between overflow-hidden mt-2"
          >
            {/* Shelf Title & Instructions */}
            <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-sky-400 text-black font-black text-[9px] uppercase rounded-md border border-black shadow-[0_1px_0_#000]">
                  ROSTER BENCH
                </span>
                <span className="text-[10px] sm:text-xs font-black text-sky-300 uppercase tracking-wide">
                  TRANSFER MARKET & DEPLOYABLE PLAYERS
                </span>
              </div>
              <span className="text-[9px] text-neutral-400 font-bold uppercase hidden sm:inline">
                Scroll horizontally • Drag cards onto pedestals above
              </span>
            </div>

            {/* Horizontal Scrollable Cards Shelf */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-stretch gap-2.5 sm:gap-3 py-1 px-0.5">
              {allPlayers.map((player) => {
                const isUnlocked = rosterManager.isUnlocked(player.id);
                const activeSlot = rosterManager.getSlotForPlayer(player.id);
                const isEquipped = activeSlot !== null;
                const canAfford = coins >= player.cost;

                return (
                  <div
                    key={player.id}
                    draggable={isUnlocked}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', player.id);
                    }}
                    className={`shrink-0 w-44 sm:w-48 rounded-2xl border-[2.5px] p-2.5 sm:p-3 flex flex-col justify-between select-none shadow-[0_3.5px_0_#000] transition-all relative ${
                      isEquipped
                        ? 'border-amber-400 bg-neutral-950/90 shadow-[0_4px_0_#f59e0b]'
                        : isUnlocked
                        ? 'border-white/30 bg-neutral-950/80 hover:border-white'
                        : 'border-neutral-700 bg-neutral-950/60 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Top Row: Country Flag + Rarity */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <CountryFlag country={player.country} size="xs" rounded="xs" shadow={false} />
                        <span className="text-[9px] font-bold text-neutral-400 uppercase truncate max-w-[60px]">
                          {player.country}
                        </span>
                      </div>
                      {getRarityBadge(player.rarity)}
                    </div>

                    {/* Middle: Avatar + Title */}
                    <div className="flex items-center gap-2 my-1">
                      <div
                        className="w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center text-xl shrink-0 shadow-[0_2px_0_#000]"
                        style={{ backgroundColor: player.colors.accent + '35', borderColor: player.colors.accent }}
                      >
                        {player.avatarEmoji}
                      </div>
                      <div className="flex flex-col text-left overflow-hidden">
                        <h3 className="text-xs font-black text-white uppercase tracking-tight truncate">
                          {player.name}
                        </h3>
                        <span className="text-[8px] font-black uppercase text-amber-400 truncate">
                          {player.archetype}
                        </span>
                      </div>
                    </div>

                    {/* Perk Description */}
                    <p className="text-[8.5px] sm:text-[9px] text-neutral-300 leading-tight my-1 line-clamp-2">
                      {player.perkDescription}
                    </p>

                    {/* Mini Stats Bar */}
                    <div className="w-full grid grid-cols-3 gap-1 my-1 text-[8px] font-mono font-bold bg-neutral-900 px-1 py-0.5 rounded border border-white/10 text-center">
                      <span>PWR {player.stats.power}</span>
                      <span>IQ {player.stats.iq}</span>
                      <span>SPD {player.stats.speed}</span>
                    </div>

                    {/* Action Button Row */}
                    <div className="mt-1">
                      {isEquipped ? (
                        <div className="w-full py-1.5 bg-amber-400 text-black font-black text-[9px] sm:text-[10px] rounded-xl border border-black flex items-center justify-center gap-1 uppercase shadow-[0_2px_0_#000]">
                          <Check size={12} strokeWidth={3} />
                          <span>IN SET (SLOT {activeSlot + 1})</span>
                        </div>
                      ) : isUnlocked ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAssignToSlot(player.id, 0)}
                            title="Assign to Slot 1 (Striker)"
                            className="flex-1 py-1 bg-white hover:bg-neutral-200 active:translate-y-0.5 text-black font-black text-[8px] rounded-lg border border-black transition-transform cursor-pointer"
                          >
                            SLOT 1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAssignToSlot(player.id, 1)}
                            title="Assign to Slot 2 (Midfield)"
                            className="flex-1 py-1 bg-white hover:bg-neutral-200 active:translate-y-0.5 text-black font-black text-[8px] rounded-lg border border-black transition-transform cursor-pointer"
                          >
                            SLOT 2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAssignToSlot(player.id, 2)}
                            title="Assign to Slot 3 (Defense)"
                            className="flex-1 py-1 bg-white hover:bg-neutral-200 active:translate-y-0.5 text-black font-black text-[8px] rounded-lg border border-black transition-transform cursor-pointer"
                          >
                            SLOT 3
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {canAfford ? (
                            <button
                              type="button"
                              onClick={() => handleBuyPlayer(player)}
                              className="w-full py-1.5 bg-emerald-400 hover:bg-emerald-300 active:translate-y-0.5 text-black font-black text-[9px] sm:text-[10px] rounded-xl border border-black flex items-center justify-center gap-1 uppercase transition-transform cursor-pointer shadow-[0_2px_0_#000]"
                            >
                              <Coins size={12} className="fill-black" />
                              <span>BUY ({player.cost})</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUnlockPlayerWithAd(player)}
                              disabled={isWatchingAd}
                              className="w-full py-1.5 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-black font-black text-[9px] sm:text-[10px] rounded-xl border border-black flex items-center justify-center gap-1 uppercase transition-transform cursor-pointer shadow-[0_2px_0_#000]"
                            >
                              <Tv size={12} />
                              <span>SCOUT (1 AD)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* End Card matching sketch [+] slot for Scout / Bonus coins */}
              <div
                onClick={handleWatchAdForCoins}
                className="shrink-0 w-36 sm:w-40 rounded-2xl border-[2.5px] border-dashed border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20 active:scale-98 transition-all p-3 flex flex-col items-center justify-center text-center cursor-pointer shadow-[0_3px_0_#000]"
              >
                <div className="w-11 h-11 rounded-2xl bg-amber-400 border-2 border-black flex items-center justify-center text-black shadow-[0_2px_0_#000] mb-2">
                  <Plus size={24} strokeWidth={3} />
                </div>
                <span className="text-xs font-black uppercase text-amber-300 tracking-wider">
                  SCOUT SPONSOR
                </span>
                <span className="text-[8px] font-bold text-neutral-300 uppercase mt-1 leading-tight">
                  Watch 1 Ad for +100 Coins
                </span>
              </div>
            </div>
          </section>
        </main>
      ) : (
        /* =========================================================
            ACCESSORIES / BALL SKINS TAB (Existing ball catalog)
            ========================================================= */
        <main className="flex-1 flex flex-col overflow-hidden p-3 sm:p-6 max-w-6xl mx-auto w-full">
          {/* Filter Bar */}
          <div className="w-full bg-neutral-900 border-2 border-black rounded-2xl px-3 sm:px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0 shadow-[0_2.5px_0_#000] mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {(['all', 'legendary', 'rare', 'common'] as const).map((filter) => {
                const label =
                  filter === 'all'
                    ? `ALL (${skins.length})`
                    : filter === 'legendary'
                    ? 'LEGENDARY'
                    : filter === 'rare'
                    ? 'RARE'
                    : 'STANDARD';

                const isSelected = selectedFilter === filter;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-amber-400 text-black shadow-[0_2px_0_#000] scale-102'
                        : 'bg-neutral-800 text-white/70 hover:text-white hover:bg-neutral-700 shadow-none'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-300">
              <span>UNLOCKED:</span>
              <span>{skins.filter((s) => ballSkinManager.isSkinUnlocked(s.id)).length} / {skins.length}</span>
            </div>
          </div>

          {/* Ball Showcase Grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pr-1">
            {skins
              .filter((skin) => selectedFilter === 'all' || skin.rarity === selectedFilter)
              .map((skin) => {
                const isUnlocked = ballSkinManager.isSkinUnlocked(skin.id);
                const isActive = activeSkin.id === skin.id;

                return (
                  <div
                    key={skin.id}
                    className={`group flex flex-col justify-between rounded-3xl border-[3px] border-black p-3.5 transition-all relative overflow-hidden ${
                      isActive
                        ? 'bg-neutral-900 border-amber-400 shadow-[0_5px_0_#f59e0b] ring-2 ring-amber-400/50'
                        : isUnlocked
                        ? 'bg-neutral-900 hover:border-white shadow-[0_5px_0_#000]'
                        : 'bg-neutral-950/90 border-neutral-700 shadow-[0_4px_0_#000] opacity-90 hover:opacity-100'
                    }`}
                  >
                    {/* Top Row: Name + Rarity */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
                        {skin.name}
                      </h3>
                      {getRarityBadge(skin.rarity)}
                    </div>

                    {/* Ball Box */}
                    <div
                      id={`ball-preview-${skin.id}`}
                      className="w-full h-36 sm:h-40 rounded-2xl border-2 border-black flex items-center justify-center p-3 my-1.5 relative overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]"
                      style={{
                        backgroundColor: skin.themeColor === '#ffffff' ? '#181a20' : skin.themeColor + '18',
                        borderColor: isActive ? '#f59e0b' : '#000000',
                      }}
                    >
                      <div
                        className="absolute bottom-2 w-20 h-4 rounded-full blur-[8px] opacity-70"
                        style={{ backgroundColor: skin.themeColor }}
                      />
                      {renderBallVisual(skin)}
                    </div>

                    {/* CTA Button */}
                    <div className="mt-1.5">
                      {isActive ? (
                        <div className="w-full py-2.5 bg-emerald-400 text-black font-black text-xs rounded-xl border-2 border-black flex items-center justify-center gap-1.5 uppercase shadow-[0_2.5px_0_#000]">
                          <Check size={16} strokeWidth={3} />
                          <span>EQUIPPED</span>
                        </div>
                      ) : isUnlocked ? (
                        <button
                          type="button"
                          onClick={() => handleEquipBall(skin.id)}
                          className="w-full py-2.5 bg-white hover:bg-neutral-100 active:translate-y-0.5 text-black font-black text-xs rounded-xl border-2 border-black flex items-center justify-center gap-1 uppercase cursor-pointer shadow-[0_2.5px_0_#000] transition-transform"
                        >
                          <span>EQUIP</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUnlockBallWithAd(skin)}
                          disabled={isWatchingAd}
                          className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-black font-black text-xs rounded-xl border-2 border-black flex items-center justify-center gap-1.5 uppercase cursor-pointer shadow-[0_2.5px_0_#000] transition-transform disabled:opacity-50"
                        >
                          <Tv size={14} />
                          <span>WATCH AD</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </main>
      )}
    </div>
  );
};
