import { leaderboardService } from './LeaderboardService';
import { platformSDK } from './PlatformSDK';

export type PlayerArchetype = 'striker' | 'playmaker' | 'defender' | 'winger';
export type PlayerRarity = 'common' | 'rare' | 'legendary';

export interface RosterPlayer {
  id: string;
  name: string;
  nickname: string;
  archetype: PlayerArchetype;
  rarity: PlayerRarity;
  cost: number;
  avatarEmoji: string;
  country: string;
  perkTitle: string;
  perkDescription: string;
  stats: {
    power: number; // 0-100 (kick speed 23 to 34 m/s)
    iq: number; // 0-100 (bank shot angles & vision)
    speed: number; // 0-100 (reaction & cooldown 0.12s - 0.28s)
    hitbox: number; // 0-100 (deflection radius & bounce bumper)
  };
  colors: {
    jersey: number;
    shorts: number;
    accent: string;
  };
}

export const INITIAL_ROSTER_PLAYERS: RosterPlayer[] = [
  {
    id: 'leo-maestro',
    name: 'Leo Maestro',
    nickname: 'The Magician',
    archetype: 'striker',
    rarity: 'legendary',
    cost: 0,
    avatarEmoji: '👑',
    country: 'Argentina',
    perkTitle: 'Hyper-Curved Cannon',
    perkDescription: 'Calculates laser ricochets off side walls directly into top corners.',
    stats: { power: 95, iq: 98, speed: 90, hitbox: 85 },
    colors: { jersey: 0x75aadb, shorts: 0x111111, accent: '#75aadb' },
  },
  {
    id: 'luka-vision',
    name: 'Luka Vision',
    nickname: 'The Conductor',
    archetype: 'playmaker',
    rarity: 'rare',
    cost: 0,
    avatarEmoji: '🎯',
    country: 'Croatia',
    perkTitle: 'Laser Wall Ricochet',
    perkDescription: 'Cushions high-velocity air hockey rebounds and feeds laser passes to your flippers.',
    stats: { power: 82, iq: 96, speed: 88, hitbox: 80 },
    colors: { jersey: 0xd40000, shorts: 0xffffff, accent: '#ef4444' },
  },
  {
    id: 'virgil-wall',
    name: 'Virgil Wall',
    nickname: 'The Titan',
    archetype: 'defender',
    rarity: 'rare',
    cost: 0,
    avatarEmoji: '🛡️',
    country: 'Netherlands',
    perkTitle: 'Iron Rebound Bumper',
    perkDescription: 'Massive mushroom-bumper pop and wide deflection zone that denies enemy shots.',
    stats: { power: 88, iq: 84, speed: 78, hitbox: 96 },
    colors: { jersey: 0xf36c21, shorts: 0x111111, accent: '#f97316' },
  },
  {
    id: 'kylian-flash',
    name: 'Kylian Flash',
    nickname: 'The Speedster',
    archetype: 'winger',
    rarity: 'legendary',
    cost: 150,
    avatarEmoji: '⚡',
    country: 'France',
    perkTitle: 'Sonic Reflex Kick',
    perkDescription: 'Ultra-fast reaction speed (0.12s cooldown) with supersonic forward velocity.',
    stats: { power: 92, iq: 86, speed: 99, hitbox: 82 },
    colors: { jersey: 0x002654, shorts: 0xffffff, accent: '#3b82f6' },
  },
  {
    id: 'erling-cyborg',
    name: 'Erling Cyborg',
    nickname: 'The Tank',
    archetype: 'striker',
    rarity: 'legendary',
    cost: 250,
    avatarEmoji: '🚀',
    country: 'Norway',
    perkTitle: 'Rocket Breaker Kick',
    perkDescription: 'Fires blistering 34 m/s shots that punch through CPU keeper dives with ease.',
    stats: { power: 99, iq: 88, speed: 85, hitbox: 90 },
    colors: { jersey: 0xba0c2f, shorts: 0x00205b, accent: '#ef4444' },
  },
  {
    id: 'neymar-joga',
    name: 'Neymar Joga',
    nickname: 'The Artist',
    archetype: 'playmaker',
    rarity: 'rare',
    cost: 180,
    avatarEmoji: '✨',
    country: 'Brazil',
    perkTitle: 'Chaos Spin Curve',
    perkDescription: 'Injects chaotic angular spin into the ball, bending its trajectory around defenses.',
    stats: { power: 85, iq: 92, speed: 92, hitbox: 85 },
    colors: { jersey: 0xfed100, shorts: 0x002776, accent: '#eab308' },
  },
  {
    id: 'gigi-shield',
    name: 'Gigi Shield',
    nickname: 'The Wall',
    archetype: 'defender',
    rarity: 'common',
    cost: 80,
    avatarEmoji: '🧤',
    country: 'Italy',
    perkTitle: 'Super Elastic Sponge',
    perkDescription: 'Absorbs hypersonic puck speed and resets ball trajectory safely away from your goal.',
    stats: { power: 75, iq: 80, speed: 82, hitbox: 98 },
    colors: { jersey: 0x0047ab, shorts: 0xffffff, accent: '#60a5fa' },
  },
];

const ROSTER_STORAGE_KEYS = {
  ACTIVE_SQUAD: 'soccer_pinball_roster_active_set',
  UNLOCKED: 'soccer_pinball_roster_unlocked',
};

class RosterManager {
  private players: RosterPlayer[] = INITIAL_ROSTER_PLAYERS;
  private unlockedIds: Set<string> = new Set(['leo-maestro', 'luka-vision', 'virgil-wall']);
  private activeSquadIds: [string, string, string] = ['leo-maestro', 'luka-vision', 'virgil-wall'];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadFromStorage();
    // Kick off cloud sync asynchronously after local load
    this.syncFromCloud().catch(() => {});
  }

  private loadFromStorage() {
    try {
      const savedUnlocked = platformSDK.cloudLoad(ROSTER_STORAGE_KEYS.UNLOCKED);
      if (savedUnlocked) {
        const parsed = JSON.parse(savedUnlocked);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => this.unlockedIds.add(id));
        }
      }

      const savedSquad = platformSDK.cloudLoad(ROSTER_STORAGE_KEYS.ACTIVE_SQUAD);
      if (savedSquad) {
        const parsed = JSON.parse(savedSquad);
        if (Array.isArray(parsed) && parsed.length === 3) {
          const valid = parsed.every((id) => this.players.some((p) => p.id === id));
          if (valid) {
            this.activeSquadIds = [parsed[0], parsed[1], parsed[2]];
          }
        }
      }
    } catch {
      // Storage unavailable / fallback defaults
    }
  }

  private saveToStorage() {
    try {
      platformSDK.cloudSave(
        ROSTER_STORAGE_KEYS.UNLOCKED,
        JSON.stringify(Array.from(this.unlockedIds))
      );
      platformSDK.cloudSave(
        ROSTER_STORAGE_KEYS.ACTIVE_SQUAD,
        JSON.stringify(this.activeSquadIds)
      );
    } catch {}
  }

  /**
   * Async cloud sync: loads the 'sp_roster_v1' blob and merges unlocked IDs (union),
   * uses cloud activeSquad if all 3 IDs refer to valid players.
   */
  private async syncFromCloud(): Promise<void> {
    try {
      const blobRaw = platformSDK.cloudLoad('sp_roster_v1');
      if (blobRaw) {
        const blob = JSON.parse(blobRaw) as {
          unlockedIds?: string[];
          activeSquadIds?: [string, string, string];
        };

        // Union of unlocked IDs
        if (Array.isArray(blob.unlockedIds)) {
          blob.unlockedIds.forEach((id) => {
            if (this.players.some((p) => p.id === id)) {
              this.unlockedIds.add(id);
            }
          });
        }

        // Accept cloud squad only if all 3 IDs are valid players
        if (
          Array.isArray(blob.activeSquadIds) &&
          blob.activeSquadIds.length === 3 &&
          blob.activeSquadIds.every((id) => this.players.some((p) => p.id === id))
        ) {
          this.activeSquadIds = [
            blob.activeSquadIds[0],
            blob.activeSquadIds[1],
            blob.activeSquadIds[2],
          ];
        }

        this.notify();
      }
    } catch {
      // Non-fatal
    }
  }

  /**
   * Save roster state to cloud as a JSON blob ('sp_roster_v1').
   */
  private saveToCloud(): void {
    try {
      const blob = JSON.stringify({
        unlockedIds: Array.from(this.unlockedIds),
        activeSquadIds: this.activeSquadIds,
      });
      platformSDK.cloudSave('sp_roster_v1', blob);
    } catch {
      // Non-fatal
    }
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getAllPlayers(): RosterPlayer[] {
    return this.players;
  }

  public getPlayer(id: string): RosterPlayer | undefined {
    return this.players.find((p) => p.id === id);
  }

  public isUnlocked(id: string): boolean {
    return this.unlockedIds.has(id);
  }

  public getActiveSquadIds(): [string, string, string] {
    return [...this.activeSquadIds];
  }

  public getActiveSquad(): [RosterPlayer, RosterPlayer, RosterPlayer] {
    const p0 = this.getPlayer(this.activeSquadIds[0]) || this.players[0];
    const p1 = this.getPlayer(this.activeSquadIds[1]) || this.players[1];
    const p2 = this.getPlayer(this.activeSquadIds[2]) || this.players[2];
    return [p0, p1, p2];
  }

  public unlockPlayer(playerId: string, bypassCost = false): boolean {
    if (this.unlockedIds.has(playerId)) return true;
    const player = this.getPlayer(playerId);
    if (!player) return false;

    if (!bypassCost && player.cost > 0) {
      const success = leaderboardService.spendCoins(player.cost);
      if (!success) return false;
    }

    this.unlockedIds.add(playerId);
    this.saveToStorage();
    this.saveToCloud();
    this.notify();
    return true;
  }

  public assignPlayerToSlot(playerId: string, slotIndex: 0 | 1 | 2): boolean {
    if (!this.unlockedIds.has(playerId)) return false;
    if (!this.players.some((p) => p.id === playerId)) return false;

    // Check if player is already in another slot: if so, swap them!
    const currentSlot = this.activeSquadIds.indexOf(playerId);
    if (currentSlot !== -1 && currentSlot !== slotIndex) {
      const displacedPlayer = this.activeSquadIds[slotIndex];
      this.activeSquadIds[currentSlot] = displacedPlayer;
    }

    this.activeSquadIds[slotIndex] = playerId;
    this.saveToStorage();
    this.saveToCloud();
    this.notify();
    return true;
  }

  public getSlotForPlayer(playerId: string): number | null {
    const idx = this.activeSquadIds.indexOf(playerId);
    return idx === -1 ? null : idx;
  }
}

export const rosterManager = new RosterManager();
