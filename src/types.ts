export type ActiveScreen = 'home' | 'tournament_hub' | 'two_player_hub' | 'shop' | 'gameplay';

export interface TwoPlayerSettings {
  targetGoals: number;
  matchDurationSeconds: number;
}

export interface BracketTeam {
  name: string;
  badge: string;
  isPlayer?: boolean;
  score?: number;
  tactics?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  flag?: string;
  colors?: { jersey: number; shorts: number };
}

export interface BracketMatch {
  id: string;
  round: 1 | 2 | 3; // 1 = Quarter-Finals, 2 = Semi-Finals, 3 = Final
  label: string;
  teamA: BracketTeam;
  teamB: BracketTeam;
  winner?: 'A' | 'B';
  status: 'completed' | 'active' | 'upcoming';
  targetGoals: number;
}

export const INITIAL_BRACKET_MATCHES: BracketMatch[] = [
  // Quarter-Finals (Round 1) - World Cup Tournament Bracket
  {
    id: 'qf-1',
    round: 1,
    label: 'QUARTER-FINAL 1',
    teamA: { name: 'YOU', badge: '⭐', isPlayer: true, flag: '⭐' },
    teamB: {
      name: 'Japan',
      badge: '🇯🇵',
      flag: '🇯🇵',
      tactics: 'Samurai Blue • Fast High-Press & Counters',
      difficulty: 'easy',
      colors: { jersey: 0x004098, shorts: 0xffffff },
    },
    status: 'active',
    targetGoals: 5,
  },
  {
    id: 'qf-2',
    round: 1,
    label: 'QUARTER-FINAL 2',
    teamA: {
      name: 'Germany',
      badge: '🇩🇪',
      flag: '🇩🇪',
      tactics: 'Die Mannschaft • Physical Midfield & Direct Strikes',
      difficulty: 'medium',
      colors: { jersey: 0xffffff, shorts: 0x111111 },
    },
    teamB: {
      name: 'Spain',
      badge: '🇪🇸',
      flag: '🇪🇸',
      tactics: 'La Roja • Possession Control & Precision Angles',
      difficulty: 'medium',
      colors: { jersey: 0xc60b1e, shorts: 0x002b7f },
    },
    status: 'upcoming',
    targetGoals: 5,
  },
  {
    id: 'qf-3',
    round: 1,
    label: 'QUARTER-FINAL 3',
    teamA: {
      name: 'Brazil',
      badge: '🇧🇷',
      flag: '🇧🇷',
      tactics: 'Seleção • Explosive Flank Attacks & Joga Bonito',
      difficulty: 'medium',
      colors: { jersey: 0xfed100, shorts: 0x002776 },
    },
    teamB: {
      name: 'England',
      badge: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      tactics: 'Three Lions • Aerial Power & Dead-ball Cannons',
      difficulty: 'medium',
      colors: { jersey: 0xffffff, shorts: 0x001f3f },
    },
    status: 'upcoming',
    targetGoals: 5,
  },
  {
    id: 'qf-4',
    round: 1,
    label: 'QUARTER-FINAL 4',
    teamA: {
      name: 'Netherlands',
      badge: '🇳🇱',
      flag: '🇳🇱',
      tactics: 'Oranje • Total Pinball Dynamic Rotation',
      difficulty: 'medium',
      colors: { jersey: 0xf36c21, shorts: 0xffffff },
    },
    teamB: {
      name: 'Argentina',
      badge: '🇦🇷',
      flag: '🇦🇷',
      tactics: 'La Albiceleste • World Champions • Relentless Defense',
      difficulty: 'hard',
      colors: { jersey: 0x75aadb, shorts: 0x000000 },
    },
    status: 'upcoming',
    targetGoals: 5,
  },

  // Semi-Finals (Round 2)
  {
    id: 'sf-1',
    round: 2,
    label: 'SEMI-FINAL A',
    teamA: { name: 'Winner QF 1', badge: '❓' },
    teamB: { name: 'Winner QF 2', badge: '❓' },
    status: 'upcoming',
    targetGoals: 5,
  },
  {
    id: 'sf-2',
    round: 2,
    label: 'SEMI-FINAL B',
    teamA: { name: 'Winner QF 3', badge: '❓' },
    teamB: { name: 'Winner QF 4', badge: '❓' },
    status: 'upcoming',
    targetGoals: 5,
  },

  // Grand Final (Round 3)
  {
    id: 'fin-1',
    round: 3,
    label: 'WORLD CUP FINAL',
    teamA: { name: 'Finalist A', badge: '🏆' },
    teamB: { name: 'Finalist B', badge: '🏆' },
    status: 'upcoming',
    targetGoals: 5,
  },
];

export type CameraViewMode = 'gameplay';

export type GameMode = 'home' | 'pinball' | 'team' | 'two_player';

export type MatchType = 'quick' | 'tournament' | 'two_player';

export type TournamentDifficulty = 'standard' | 'pro' | 'legend';

export interface TournamentDifficultyConfig {
  id: TournamentDifficulty;
  name: string;
  badge: string;
  scoreMultiplier: number;
  aiModifier: 'easy' | 'medium' | 'hard';
  description: string;
  badgeClass: string;
}

export const TOURNAMENT_DIFFICULTIES: Record<TournamentDifficulty, TournamentDifficultyConfig> = {
  standard: {
    id: 'standard',
    name: 'STANDARD CUP',
    badge: '1.0x',
    scoreMultiplier: 1.0,
    aiModifier: 'medium',
    description: 'Balanced AI reflexes & speed',
    badgeClass: 'bg-emerald-400 text-black',
  },
  pro: {
    id: 'pro',
    name: 'PRO CUP',
    badge: '+25% PTS',
    scoreMultiplier: 1.25,
    aiModifier: 'hard',
    description: 'Faster AI flippers & bank shots',
    badgeClass: 'bg-amber-400 text-black',
  },
  legend: {
    id: 'legend',
    name: 'LEGEND CUP',
    badge: '+50% PTS',
    scoreMultiplier: 1.5,
    aiModifier: 'hard',
    description: 'Max reflex CPU with curve shots',
    badgeClass: 'bg-rose-500 text-white',
  },
};

export interface TournamentRound {
  roundNumber: number; // 1 = Quarter-Finals, 2 = Semi-Finals, 3 = Cup Final
  name: string;
  opponentName: string;
  opponentTactic: string;
  opponentBadge: string;
  targetGoals: number;
  aiDifficulty: 'easy' | 'medium' | 'hard';
}

export const TOURNAMENT_ROUNDS: TournamentRound[] = [
  {
    roundNumber: 1,
    name: 'QUARTER-FINAL',
    opponentName: 'Japan',
    opponentTactic: 'Samurai Blue • Fast High-Press & Counters',
    opponentBadge: '🇯🇵',
    targetGoals: 5,
    aiDifficulty: 'easy',
  },
  {
    roundNumber: 2,
    name: 'SEMI-FINAL',
    opponentName: 'Germany',
    opponentTactic: 'Die Mannschaft • Physical Midfield & Counter-Press',
    opponentBadge: '🇩🇪',
    targetGoals: 5,
    aiDifficulty: 'medium',
  },
  {
    roundNumber: 3,
    name: 'WORLD CUP FINAL',
    opponentName: 'Argentina',
    opponentTactic: 'World Champions • Relentless Defense & Rapid Reflexes',
    opponentBadge: '🇦🇷',
    targetGoals: 5,
    aiDifficulty: 'hard',
  },
];

export type PlayerRole = 'striker' | 'midfielder' | 'defender' | 'cannon';

export interface TacticalZone {
  minZ: number;
  maxZ: number;
  minX: number;
  maxX: number;
  name: string;
  shortName: string;
  badge: string;
  color: number;
  hexColor: string;
  accentBg: string;
}

export const ROLE_TACTICAL_ZONES: Record<PlayerRole, TacticalZone> = {
  striker: {
    minZ: -6.5,
    maxZ: -1.0,
    minX: -3.5,
    maxX: 3.5,
    name: 'Forward Attacking Zone',
    shortName: 'Attack Zone',
    badge: 'FWD',
    color: 0xf43f5e,
    hexColor: '#f43f5e',
    accentBg: 'bg-rose-500',
  },
  cannon: {
    minZ: -6.5,
    maxZ: -1.0,
    minX: -3.5,
    maxX: 3.5,
    name: 'Forward Attacking Zone',
    shortName: 'Attack Zone',
    badge: 'PWR',
    color: 0xa855f7,
    hexColor: '#a855f7',
    accentBg: 'bg-purple-500',
  },
  midfielder: {
    minZ: -1.0,
    maxZ: 2.4,
    minX: -3.5,
    maxX: 3.5,
    name: 'Midfield Playmaking Zone',
    shortName: 'Midfield Zone',
    badge: 'MID',
    color: 0x38bdf8,
    hexColor: '#38bdf8',
    accentBg: 'bg-sky-400',
  },
  defender: {
    minZ: 2.4,
    maxZ: 6.2,
    minX: -3.5,
    maxX: 3.5,
    name: 'Defensive Backline Zone',
    shortName: 'Defense Zone',
    badge: 'DEF',
    color: 0x34d399,
    hexColor: '#34d399',
    accentBg: 'bg-emerald-400',
  },
};

export interface GameStats {
  score: number;
  goals: number; // Goals scored by Pinball (top goal)
  playerGoals: number; // Goals scored by Players (bottom goal)
  maxGoals: number; // 5
  scoreLimit: number; // 10000
  winner: 'pinball' | 'players' | null;
  shots: number;
  saves: number;
  combo: number;
  highScore: number;
  ballsLeft: number;
  matchTime: number; // in seconds
  isGameOver: boolean;
  isPaused: boolean;
  bankShots?: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  rarity?: 'common' | 'rare' | 'legendary';
  iq: number; // 0 - 100: Intelligence & vision for bank shots and passes
  shotAccuracy: number; // 0 - 100: Precision aiming on goal corners
  passSpeed: number; // Impulse weight
  specialTrait?: 'bank_master' | 'tiki_taka' | 'sniper' | 'wall_rebound';
}

export interface FieldPlayerConfig {
  id: string;
  name: string;
  x: number; // Pitch coordinate: [-3.5, 3.5]
  z: number; // Pitch coordinate: [-7.5, 5.5]
  role: PlayerRole;
  facingAngle: number; // In radians
  knockoutCount?: number;
  hasYellowCard?: boolean;
  isEjected?: boolean;
  profile?: PlayerProfile;
}

export interface TacticalFormation {
  id: string;
  name: string;
  description: string;
  badge: string;
  players: Array<{
    role: PlayerRole;
    x: number;
    z: number;
    facingAngle: number;
  }>;
}

export interface PenaltyState {
  isActive: boolean;
  timeLeft: number; // in seconds, e.g. 5.4
  totalTime: number; // e.g. 6.0
  card: 'yellow' | 'red';
  isShooterUser: boolean; // true if user controls the shooter
  kickerName: string;
  punishedPlayerName?: string;
  cardReason?: string;
}
