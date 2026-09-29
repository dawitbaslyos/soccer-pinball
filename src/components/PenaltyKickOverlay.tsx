import React from 'react';
import { PenaltyState } from '../types';

interface PenaltyKickOverlayProps {
  penaltyState: PenaltyState | null;
  onShoot: () => void;
}

export const PenaltyKickOverlay: React.FC<PenaltyKickOverlayProps> = ({
  penaltyState,
  onShoot,
}) => {
  if (!penaltyState || !penaltyState.isActive) return null;

  const isYellow = penaltyState.card === 'yellow';
  const pct = Math.max(0, Math.min(100, (penaltyState.timeLeft / penaltyState.totalTime) * 100));

  return (
    <>
      {/* Fullscreen click/tap backdrop so simple tap or click anywhere on screen fires immediately */}
      {penaltyState.isShooterUser && (
        <div
          id="penalty-screen-tap-capture"
          onPointerDown={(e) => {
            e.stopPropagation();
            onShoot();
          }}
          className="fixed inset-0 z-30 cursor-pointer select-none bg-transparent"
        />
      )}

      <div
        id="penalty-kick-overlay"
        className="absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-35 select-none font-sans px-2"
      >
        <div
          onPointerDown={
            penaltyState.isShooterUser
              ? (e) => {
                  e.stopPropagation();
                  onShoot();
                }
              : undefined
          }
          className={`flex flex-col items-center w-[250px] sm:w-[275px] bg-white border-2 border-black rounded-xl p-2 sm:p-2.5 shadow-[0_3px_0_#000] animate-fade-in ${
            penaltyState.isShooterUser
              ? 'cursor-pointer hover:bg-neutral-50 pointer-events-auto'
              : 'pointer-events-none'
          }`}
        >
          {/* Card and Header */}
          <div className="flex items-center space-x-2 w-full justify-between pb-1 border-b border-black/15">
            <div className="flex items-center space-x-1.5">
              <span
                id="penalty-card-chip"
                className={`w-2.5 h-3.5 rounded-xs inline-block border border-black shadow-2xs shrink-0 ${
                  isYellow ? 'bg-amber-400' : 'bg-red-600'
                }`}
              />
              <span className="text-[9.5px] sm:text-[10px] font-black tracking-wider text-black uppercase">
                PENALTY KICK
              </span>
            </div>

            {/* Shot clock digital time */}
            <div className="flex items-center space-x-1 bg-neutral-100 border border-black rounded-md px-1.5 py-0.5">
              <span className="text-[8px] text-neutral-600 uppercase font-black">CLOCK</span>
              <span
                id="penalty-shot-clock"
                className={`text-xs font-black tracking-wider ${
                  penaltyState.timeLeft <= 2.0 ? 'text-red-600 animate-pulse' : 'text-black'
                }`}
              >
                0{Math.max(0, penaltyState.timeLeft).toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Punished player info if penalty was triggered by power knockouts */}
          {penaltyState.punishedPlayerName && (
            <div className="w-full flex items-center justify-between text-[8.5px] font-black uppercase pt-1 text-neutral-600">
              <span className="text-red-600 font-extrabold">{penaltyState.punishedPlayerName}</span>
              <span className="text-[7.5px] font-bold text-neutral-500">{penaltyState.cardReason}</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full bg-neutral-200 border border-black h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 rounded-full ${
                penaltyState.timeLeft <= 2.0 ? 'bg-red-500' : 'bg-amber-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Quick shoot guidance - tap anywhere on the screen or press space */}
          <div className="text-center pt-2 pb-0.5 text-[10px] sm:text-[10.5px] font-black tracking-wide uppercase leading-tight">
            {penaltyState.isShooterUser ? (
              <span className="text-red-600 animate-pulse">
                TAP THE SCREEN TO SHOOT... QUICK!
              </span>
            ) : (
              <span className="text-neutral-700">
                {penaltyState.kickerName} AIMING • AUTO-STRIKING!
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
