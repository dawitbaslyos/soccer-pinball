import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Tv, Sparkles, Flame, Zap, ShoppingBag, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ballSkinManager, BallSkin } from '../services/BallSkinManager';
import { platformSDK } from '../services/PlatformSDK';
import { soundEffects } from '../audio/SoundEffects';

interface ShopScreenProps {
  onBackToHome: () => void;
  onSelectSkin: (skinId: string) => void;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({
  onBackToHome,
  onSelectSkin,
}) => {
  const [, setVersion] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'legendary' | 'rare' | 'common'>('all');
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adFeedback, setAdFeedback] = useState<string | null>(null);

  useEffect(() => {
    return ballSkinManager.subscribe(() => {
      setVersion((v) => v + 1);
    });
  }, []);

  const skins = ballSkinManager.getAvailableSkins();
  const activeSkin = ballSkinManager.getActiveSkin();
  const unlockedCount = skins.filter((s) => ballSkinManager.isSkinUnlocked(s.id)).length;

  const filteredSkins = skins.filter((skin) => {
    if (selectedFilter === 'all') return true;
    return skin.rarity === selectedFilter;
  });

  const handleEquip = (skinId: string) => {
    soundEffects.playKick();
    ballSkinManager.setActiveSkin(skinId);
    onSelectSkin(skinId);
  };

  const handleUnlockWithAd = (skin: BallSkin) => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    setAdFeedback(`Watching sponsor ad for ${skin.name}...`);

    platformSDK.requestRewardedAd({
      onStarted: () => {
        setAdFeedback(`Watching ad...`);
      },
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

  const getRarityBadge = (rarity: BallSkin['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return (
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-400 text-black border-2 border-black shadow-[0_2px_0_#000] flex items-center gap-1">
            <Sparkles size={11} className="fill-black" />
            <span>LEGENDARY</span>
          </span>
        );
      case 'rare':
        return (
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-500 text-white border-2 border-black shadow-[0_2px_0_#000] flex items-center gap-1">
            <Zap size={11} />
            <span>RARE</span>
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-neutral-700 text-white/90 border-2 border-black shadow-[0_2px_0_#000] flex items-center gap-1">
            <ShieldCheck size={11} />
            <span>STANDARD</span>
          </span>
        );
    }
  };

  const renderBallVisual = (skin: BallSkin) => {
    // If user provided a real PNG image path, render the exact image
    if (skin.previewImage) {
      return (
        <img
          src={skin.previewImage}
          alt={skin.name}
          className="w-full h-full object-contain p-2 drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-105"
        />
      );
    }

    // High-fidelity procedural 3D sphere fallback with custom theme shaders/gradients
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
      {/* 1. Header Toolbar */}
      <header className="w-full border-b-[3px] border-black bg-amber-400 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_0_#000] shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <button
            id="btn-shop-back"
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs uppercase border-2 border-black rounded-xl shadow-[0_2.5px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] transition-all cursor-pointer touch-manipulation"
          >
            <ArrowLeft size={16} />
            <span>BACK</span>
          </button>

          <div className="flex items-center gap-2">
            <ShoppingBag size={22} className="text-black" />
            <h1 className="text-lg sm:text-xl font-black text-black tracking-wider uppercase leading-none">
              BALL SHOP
            </h1>
          </div>
        </div>

        {/* Top-Right Active Ball Indicator */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-[9px] font-black text-black/70 uppercase">EQUIPPED</span>
            <span className="text-xs font-black text-black uppercase mt-0.5 truncate max-w-[120px]">
              {activeSkin.name}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-neutral-900 border-2 border-black rounded-xl text-amber-300 font-black text-xs uppercase shadow-[0_2px_0_#000] flex items-center gap-1.5">
            <span>UNLOCKED</span>
            <span className="px-1.5 py-0.2 bg-amber-400 text-black rounded text-[10px] font-black">
              {unlockedCount} / {skins.length}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Filter Bar */}
      <div className="w-full bg-neutral-900 border-b-2 border-black px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0 shadow-xs">
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
      </div>

      {/* Notification Toast if ad is active */}
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

      {/* 3. Main Showcase Grid */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredSkins.map((skin) => {
            const isUnlocked = ballSkinManager.isSkinUnlocked(skin.id);
            const isActive = activeSkin.id === skin.id;

            return (
              <div
                key={skin.id}
                className={`group flex flex-col justify-between rounded-3xl border-[3px] border-black p-4 transition-all relative overflow-hidden ${
                  isActive
                    ? 'bg-neutral-900 border-amber-400 shadow-[0_6px_0_#f59e0b] ring-2 ring-amber-400/50'
                    : isUnlocked
                    ? 'bg-neutral-900 hover:border-white shadow-[0_6px_0_#000]'
                    : 'bg-neutral-950/90 border-neutral-700 shadow-[0_4px_0_#000] opacity-90 hover:opacity-100'
                }`}
              >
                {/* Top Row: Ball Name + Rarity Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider truncate">
                    {skin.name}
                  </h2>
                  {getRarityBadge(skin.rarity)}
                </div>

                {/* Ball Showcase Box (Clean Container for Future PNGs) */}
                <div
                  id={`ball-preview-${skin.id}`}
                  className="w-full h-44 sm:h-48 rounded-2xl border-2 border-black flex items-center justify-center p-4 my-2 relative overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]"
                  style={{
                    backgroundColor: skin.themeColor === '#ffffff' ? '#181a20' : skin.themeColor + '18',
                    borderColor: isActive ? '#f59e0b' : '#000000',
                  }}
                >
                  {/* Subtle pedestal illumination */}
                  <div
                    className="absolute bottom-2 w-24 h-5 rounded-full blur-[10px] opacity-70"
                    style={{ backgroundColor: skin.themeColor }}
                  />

                  {/* Render Visual / PNG */}
                  {renderBallVisual(skin)}
                </div>

                {/* Direct CTA Action Button */}
                <div className="mt-2">
                  {isActive ? (
                    <div className="w-full py-3 bg-emerald-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black flex items-center justify-center gap-2 uppercase shadow-[0_3px_0_#000]">
                      <Check size={18} strokeWidth={3} />
                      <span>EQUIPPED</span>
                    </div>
                  ) : isUnlocked ? (
                    <button
                      id={`btn-equip-${skin.id}`}
                      type="button"
                      onClick={() => handleEquip(skin.id)}
                      className="w-full py-3 bg-white hover:bg-neutral-100 active:translate-y-0.5 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black flex items-center justify-center gap-1.5 uppercase cursor-pointer shadow-[0_3px_0_#000] transition-transform touch-manipulation"
                    >
                      <span>EQUIP</span>
                    </button>
                  ) : (
                    <button
                      id={`btn-unlock-${skin.id}`}
                      type="button"
                      onClick={() => handleUnlockWithAd(skin)}
                      disabled={isWatchingAd}
                      className="w-full py-3 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black flex items-center justify-center gap-2 uppercase cursor-pointer shadow-[0_3px_0_#000] transition-transform disabled:opacity-50 touch-manipulation"
                    >
                      <Tv size={16} />
                      <span>WATCH AD</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
