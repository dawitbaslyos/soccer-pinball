import React from 'react';

interface PenaltyBannerProps {
  show: boolean;
  card: 'yellow' | 'red';
}

export const PenaltyBanner: React.FC<PenaltyBannerProps> = ({ show, card }) => {
  if (!show) return null;

  return (
    <div
      id="penalty-card-overlay"
      className="absolute inset-0 pointer-events-none z-35 flex items-center justify-center select-none font-sans px-4"
    >
      {/* Pure clean referee card ONLY - no text under it */}
      <div className="relative animate-bounce">
        <div
          id="referee-card"
          className={`relative w-14 h-22 sm:w-16 sm:h-25 md:w-18 md:h-28 rounded-lg shadow-[0_6px_0_#000] border-[2.5px] border-black transition-transform duration-200 -rotate-3 overflow-hidden ${
            card === 'yellow' ? 'bg-amber-400' : 'bg-red-600'
          }`}
        >
          {/* Subtle glossy card sheen */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-black/15 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
