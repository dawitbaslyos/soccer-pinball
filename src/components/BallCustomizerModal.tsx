import React, { useState, useEffect } from 'react';
import { X, Check, Tv, Sparkles, Flame, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ballSkinManager, BallSkin } from '../services/BallSkinManager';
import { platformSDK } from '../services/PlatformSDK';

interface BallCustomizerModalProps {
  show: boolean;
  onClose: () => void;
  onSelectSkin: (skinId: string) => void;
}

export const BallCustomizerModal: React.FC<BallCustomizerModalProps> = ({
  show,
  onClose,
  onSelectSkin,
}) => {
  const [, setVersion] = useState(0);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  useEffect(() => {
    return ballSkinManager.subscribe(() => {
      setVersion((v) => v + 1);
    });
  }, []);

  const skins = ballSkinManager.getAvailableSkins();
  const activeSkin = ballSkinManager.getActiveSkin();

  const handleEquip = (skinId: string) => {
    ballSkinManager.setActiveSkin(skinId);
    onSelectSkin(skinId);
  };

  const handleUnlockWithAd = (skin: BallSkin) => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);

    platformSDK.requestRewardedAd({
      adFinished: () => {
        setIsWatchingAd(false);
      },
      adError: () => {
        setIsWatchingAd(false);
      },
      rewardGranted: () => {
        setIsWatchingAd(false);
        ballSkinManager.unlockSkin(skin.id);
        onSelectSkin(skin.id);
      },
    });
  };

  const getRarityBadge = (rarity: BallSkin['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-black border border-black/40">
            Legendary
          </span>
        );
      case 'rare':
        return (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500 text-white border border-black/40">
            Rare
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-neutral-600 text-white border border-black/40">
            Standard
          </span>
        );
    }
  };

  const getSkinIcon = (skin: BallSkin) => {
    switch (skin.id) {
      case 'gold':
        return <Sparkles className="text-amber-400" size={28} />;
      case 'fire':
        return <Flame className="text-orange-500" size={28} />;
      case 'cyber':
        return <Zap className="text-cyan-400" size={28} />;
      default:
        return <span className="text-3xl leading-none">⚽</span>;
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div
          id="ball-customizer-overlay"
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-5 select-none font-sans"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex flex-col w-full max-w-md bg-neutral-900 border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[0_8px_0_#000] relative max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚽</span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider leading-none">
                    BALL CUSTOMIZER
                  </h2>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Select your match ball skin for the arena
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Skins Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1 pb-1">
              {skins.map((skin) => {
                const isUnlocked = ballSkinManager.isSkinUnlocked(skin.id);
                const isActive = activeSkin.id === skin.id;

                return (
                  <div
                    key={skin.id}
                    className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 transition-all ${
                      isActive
                        ? 'bg-neutral-800 border-amber-400 shadow-[0_3px_0_#f59e0b]'
                        : isUnlocked
                        ? 'bg-neutral-800/80 border-white/20 hover:border-white/50'
                        : 'bg-neutral-900 border-white/10 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-2">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-black shadow-[0_2px_0_#000]"
                          style={{ backgroundColor: skin.themeColor === '#ffffff' ? '#222' : skin.themeColor + '33' }}
                        >
                          {getSkinIcon(skin)}
                        </div>
                        {getRarityBadge(skin.rarity)}
                      </div>

                      <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide truncate">
                        {skin.name}
                      </h3>
                      <p className="text-[10px] text-white/60 leading-tight mt-1 line-clamp-2">
                        {skin.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/10">
                      {isActive ? (
                        <div className="w-full py-1.5 bg-emerald-500 text-black font-black text-[11px] rounded-lg border border-black flex items-center justify-center gap-1.5 uppercase shadow-[0_2px_0_#000]">
                          <Check size={14} />
                          <span>EQUIPPED</span>
                        </div>
                      ) : isUnlocked ? (
                        <button
                          type="button"
                          onClick={() => handleEquip(skin.id)}
                          className="w-full py-1.5 bg-white hover:bg-neutral-200 active:scale-95 text-black font-black text-[11px] rounded-lg border border-black flex items-center justify-center uppercase cursor-pointer shadow-[0_2px_0_#000] transition-transform"
                        >
                          EQUIP
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUnlockWithAd(skin)}
                          disabled={isWatchingAd}
                          className="w-full py-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-black font-black text-[11px] rounded-lg border border-black flex items-center justify-center gap-1.5 uppercase cursor-pointer shadow-[0_2px_0_#000] transition-transform disabled:opacity-50"
                        >
                          <Tv size={13} />
                          <span>UNLOCK (1 AD)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Done button */}
            <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-black text-xs uppercase rounded-xl border border-white/20 cursor-pointer transition-colors"
              >
                DONE
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
