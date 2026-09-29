import React, { useState } from 'react';
import {
  Shield,
  Zap,
  Flame,
  Crosshair,
  RotateCcw,
  Trash2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { PlayerRole, FieldPlayerConfig, ROLE_TACTICAL_ZONES } from '../types';
import { MascotSlot3D } from './MascotSlot3D';

interface TeamToolbarProps {
  fieldPlayers: FieldPlayerConfig[];
  selectedPlayer: FieldPlayerConfig | null;
  pendingPlacementRole: PlayerRole | null;
  ejectedRoles?: PlayerRole[];
  externalFeedback?: { message: string; type: 'warning' | 'error' | 'success' } | null;
  onSelectPendingRole: (role: PlayerRole | null) => void;
  onAddPlayer: (role: PlayerRole) => void;
  onRotatePlayer?: (id: string, deltaRad: number) => void;
  onRemovePlayer: (id: string) => void;
  onClearPlayers: () => void;
  onResetDefault?: () => void;
  onPowerKick?: () => void;
  isPowerKickReady?: boolean;
  onStartDragRole?: (role: PlayerRole, clientX: number, clientY: number, pointerId: number) => void;
}

const PLAYER_ROLES_CONFIG: Array<{
  role: PlayerRole;
  title: string;
  badge: string;
  zoneDesc: string;
  colorBg: string;
  icon: React.ReactNode;
}> = [
  {
    role: 'striker',
    title: 'STRIKER',
    badge: 'FWD',
    zoneDesc: 'ATTACK ZONE',
    colorBg: 'bg-rose-500',
    icon: <Crosshair size={10} className="text-white" />,
  },
  {
    role: 'midfielder',
    title: 'MIDFIELD',
    badge: 'MID',
    zoneDesc: 'MIDFIELD ZONE',
    colorBg: 'bg-sky-400',
    icon: <Zap size={10} className="text-black" />,
  },
  {
    role: 'defender',
    title: 'DEFENDER',
    badge: 'DEF',
    zoneDesc: 'DEFENSE ZONE',
    colorBg: 'bg-emerald-400',
    icon: <Shield size={10} className="text-black" />,
  },
  {
    role: 'cannon',
    title: 'CANNON',
    badge: 'PWR',
    zoneDesc: 'ATTACK ZONE',
    colorBg: 'bg-purple-500',
    icon: <Flame size={10} className="text-white" />,
  },
];

export const TeamToolbar: React.FC<TeamToolbarProps> = ({
  fieldPlayers,
  selectedPlayer,
  pendingPlacementRole,
  ejectedRoles = [],
  externalFeedback,
  onSelectPendingRole,
  onAddPlayer,
  onRotatePlayer,
  onRemovePlayer,
  onClearPlayers,
  onResetDefault,
  onPowerKick,
  isPowerKickReady = false,
  onStartDragRole,
}) => {
  const [internalFeedback, setInternalFeedback] = useState<string | null>(null);

  const activeFeedback = externalFeedback?.message || internalFeedback;

  const isSquadFull = fieldPlayers.length >= 3;
  const isRoleOnField = (role: PlayerRole) => fieldPlayers.some((p) => p.role === role);
  const isRoleEjected = (role: PlayerRole) => ejectedRoles.includes(role);

  // Position exclusivity rule: if role is on the field, its card is NOT in the deck.
  // Ejected players stay in the deck with a bold RED CARD (-1) badge!
  const leftRoles = PLAYER_ROLES_CONFIG.slice(0, 2).filter((item) => !isRoleOnField(item.role));
  const rightRoles = PLAYER_ROLES_CONFIG.slice(2, 4).filter((item) => !isRoleOnField(item.role));

  const handleMascotSelect = (role: PlayerRole) => {
    if (isRoleEjected(role)) {
      setInternalFeedback(`${role.toUpperCase()} was RED CARD EJECTED! Team is playing with -1 player.`);
      setTimeout(() => setInternalFeedback(null), 2500);
      return;
    }

    if (isSquadFull) {
      setInternalFeedback('Squad full (max 3 players). Remove one to place.');
      setTimeout(() => setInternalFeedback(null), 2200);
      return;
    }

    if (pendingPlacementRole === role) {
      onSelectPendingRole(null);
    } else {
      onSelectPendingRole(role);
    }
  };

  const handleStartDrag = (
    role: PlayerRole,
    clientX: number,
    clientY: number,
    pointerId: number
  ) => {
    if (isRoleEjected(role)) {
      setInternalFeedback(`${role.toUpperCase()} was RED CARD EJECTED! Team is playing with -1 player.`);
      setTimeout(() => setInternalFeedback(null), 2500);
      return;
    }

    if (isSquadFull) {
      setInternalFeedback('Squad full (max 3 players). Remove one to place.');
      setTimeout(() => setInternalFeedback(null), 2200);
      return;
    }

    if (onStartDragRole) {
      onStartDragRole(role, clientX, clientY, pointerId);
    }
  };

  const pendingZone = pendingPlacementRole ? ROLE_TACTICAL_ZONES[pendingPlacementRole] : null;

  return (
    <div
      id="team-toolbar-root"
      className="absolute inset-0 pointer-events-none z-20 select-none font-sans"
    >
      {/* 1. Tactical Placement Guide Banner */}
      {pendingPlacementRole && pendingZone && (
        <div
          id="pending-placement-banner"
          className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-amber-400 border-2 border-black rounded-full px-4 py-1.5 shadow-[0_3px_0_#000] pointer-events-auto animate-bounce z-30"
        >
          <span className="text-[10px] sm:text-xs font-black uppercase text-black tracking-wide">
            DEPLOY {pendingZone.badge}: TAP INSIDE HIGHLIGHTED {pendingZone.name.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={() => onSelectPendingRole(null)}
            className="p-0.5 bg-black text-white rounded-full hover:bg-neutral-800 cursor-pointer transition-transform active:scale-90"
            title="Cancel"
          >
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* Tactical Feedback Toast */}
      {activeFeedback && (
        <div
          id="squad-feedback-banner"
          className="absolute top-28 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-rose-500 text-white border-2 border-black rounded-full px-4 py-1.5 shadow-[0_3px_0_#000] pointer-events-auto z-40 animate-fade-in max-w-sm sm:max-w-md text-center"
        >
          <AlertCircle size={14} className="shrink-0 text-white" />
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wide">
            {activeFeedback}
          </span>
        </div>
      )}

      {/* Ejection banner if team is playing down a player */}
      {ejectedRoles && ejectedRoles.length > 0 && (
        <div
          id="team-ejection-indicator"
          className="absolute top-16 right-3 sm:right-5 flex items-center space-x-1.5 bg-red-600 border-2 border-black text-white px-2.5 sm:px-3 py-1 rounded-full shadow-[0_3px_0_#000] z-25 pointer-events-auto animate-pulse"
          title="Team is playing with a player deficit due to Red Card ejection"
        >
          <span className="w-2.5 h-3.5 bg-red-200 rounded-xs border border-black inline-block" />
          <span className="text-[9.5px] sm:text-[10px] font-black tracking-wider uppercase">
            SQUAD: -{ejectedRoles.length} (RED CARD)
          </span>
        </div>
      )}

      {/* 2. Bottom-Left Corner: Available Attack Mascot Slots (Hidden if placed on field) */}
      {leftRoles.length > 0 && (
        <div
          id="deck-corner-left"
          className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 flex flex-col md:flex-row gap-1.5 sm:gap-2 pointer-events-auto z-20"
        >
          {leftRoles.map((item) => (
            <MascotSlot3D
              key={item.role}
              role={item.role}
              title={item.title}
              badge={item.badge}
              zoneDesc={item.zoneDesc}
              colorBg={item.colorBg}
              icon={item.icon}
              disabled={isSquadFull}
              isEjected={isRoleEjected(item.role)}
              isSelected={pendingPlacementRole === item.role}
              onSelect={handleMascotSelect}
              onStartDrag={handleStartDrag}
            />
          ))}
        </div>
      )}

      {/* 3. Bottom-Right Corner: Available Defense Mascot Slots (Hidden if placed on field) */}
      {rightRoles.length > 0 && (
        <div
          id="deck-corner-right"
          className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 flex flex-col md:flex-row gap-1.5 sm:gap-2 pointer-events-auto z-20"
        >
          {rightRoles.map((item) => (
            <MascotSlot3D
              key={item.role}
              role={item.role}
              title={item.title}
              badge={item.badge}
              zoneDesc={item.zoneDesc}
              colorBg={item.colorBg}
              icon={item.icon}
              disabled={isSquadFull}
              isEjected={isRoleEjected(item.role)}
              isSelected={pendingPlacementRole === item.role}
              onSelect={handleMascotSelect}
              onStartDrag={handleStartDrag}
            />
          ))}
        </div>
      )}

      {/* 4. Bottom-Center: Centered Reset & Remove Controls */}
      <div
        id="tactical-deck-center"
        className="absolute bottom-2 sm:bottom-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-30"
      >
        {/* Warning pill if selected player is damaged or has yellow card */}
        {selectedPlayer && (selectedPlayer.knockoutCount || selectedPlayer.hasYellowCard) && (
          <div className="mb-1.5 whitespace-nowrap bg-black/90 border border-amber-400 text-amber-300 text-[8.5px] sm:text-[9.5px] font-black uppercase px-2.5 py-1 rounded-full shadow-[0_2px_0_#000] flex items-center space-x-1.5 animate-pulse">
            <span>
              {selectedPlayer.hasYellowCard
                ? `🟨 YELLOW CARD (${selectedPlayer.knockoutCount} HITS)`
                : `⚠️ ${selectedPlayer.knockoutCount} POWER HIT`}
            </span>
            <span className="text-neutral-300 font-bold">
              • SWAP FROM CENTER TO AVOID RED CARD!
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Reset button: clears the level to let you place players from scratch */}
          <button
            id="btn-team-reset"
            type="button"
            onClick={onClearPlayers}
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-neutral-100 active:translate-y-0.5 border-2 border-black rounded-xl text-[10.5px] sm:text-xs font-black tracking-wider text-black uppercase flex items-center space-x-1.5 shadow-[0_3px_0_#000] transition-transform cursor-pointer touch-manipulation select-none"
            title="Reset level to place players from scratch"
          >
            <RotateCcw size={13} className="shrink-0" />
            <span>RESET</span>
          </button>

          {/* Remove button: only activated when a player is selected */}
          <button
            id="btn-team-remove"
            type="button"
            disabled={!selectedPlayer}
            onClick={() => {
              if (selectedPlayer) {
                onRemovePlayer(selectedPlayer.id);
              }
            }}
            className={`px-3.5 sm:px-4 py-1.5 sm:py-2 border-2 rounded-xl text-[10.5px] sm:text-xs font-black tracking-wider uppercase flex items-center space-x-1.5 transition-all select-none touch-manipulation ${
              selectedPlayer
                ? 'bg-rose-500 hover:bg-rose-600 active:translate-y-0.5 border-black text-white shadow-[0_3px_0_#000] cursor-pointer'
                : 'bg-neutral-200 text-neutral-400 border-neutral-400 shadow-none cursor-not-allowed opacity-50'
            }`}
            title={selectedPlayer ? `Remove selected player from pitch` : 'Select a player on field to activate remove'}
          >
            <Trash2 size={13} className="shrink-0" />
            <span>REMOVE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
