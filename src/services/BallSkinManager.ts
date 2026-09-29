export interface BallSkin {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'legendary';
  themeColor: string;
  accentColor: string;
  unlockedByDefault: boolean;
  previewImage?: string;
  badgeTag?: string;
  perks?: string[];
}

export const BALL_SKINS: BallSkin[] = [
  {
    id: 'classic',
    name: 'Classic Match Ball',
    description: 'Traditional stitched leather soccer sphere with iconic pentagons.',
    icon: '⚽',
    rarity: 'common',
    themeColor: '#ffffff',
    accentColor: '#1c1e21',
    unlockedByDefault: true,
    badgeTag: 'STANDARD',
    perks: ['FIFA Regulation Weight', 'Balanced Bounce', 'Crisp Flipper Response'],
  },
  {
    id: 'gold',
    name: 'World Cup Gold',
    description: 'Forged in championship trophy gold with brilliant metallic luster.',
    icon: '🏆',
    rarity: 'legendary',
    themeColor: '#ffd700',
    accentColor: '#b8860b',
    unlockedByDefault: false,
    badgeTag: 'LEGENDARY',
    perks: ['Reflective Chrome Sheen', 'World Cup Glory Aura', 'Golden Trail Sparks'],
  },
  {
    id: 'fire',
    name: 'Flame Comet Ball',
    description: 'Superheated magma core emitting an incandescent fiery trail.',
    icon: '🔥',
    rarity: 'rare',
    themeColor: '#ff4500',
    accentColor: '#ffaa00',
    unlockedByDefault: false,
    badgeTag: 'HOT',
    perks: ['Incandescent Red Core', 'Fiery Comet Ribbon', 'Meteor Impact FX'],
  },
  {
    id: 'cyber',
    name: 'Cyber Neon Ball',
    description: 'Electrified synthwave sphere with glowing cyan circuits.',
    icon: '⚡',
    rarity: 'rare',
    themeColor: '#00e5ff',
    accentColor: '#09152b',
    unlockedByDefault: false,
    badgeTag: 'SYNTH',
    perks: ['Electric Cyan Pulses', 'Arcade Circuit Traces', 'Neon Shockwaves'],
  },
];

const STORAGE_KEY_UNLOCKED = 'soccer_pinball_unlocked_skins';
const STORAGE_KEY_ACTIVE = 'soccer_pinball_active_skin';

class BallSkinManager {
  private unlockedSkinIds: Set<string>;
  private activeSkinId: string;
  private listeners: Array<() => void> = [];

  constructor() {
    this.unlockedSkinIds = new Set(['classic']);
    this.activeSkinId = 'classic';
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedUnlocked = localStorage.getItem(STORAGE_KEY_UNLOCKED);
      if (storedUnlocked) {
        const parsed = JSON.parse(storedUnlocked);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => this.unlockedSkinIds.add(id));
        }
      }

      const storedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
      if (storedActive && this.unlockedSkinIds.has(storedActive)) {
        this.activeSkinId = storedActive;
      }
    } catch {
      // Fallback for sandboxed iframes without localStorage
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY_UNLOCKED,
        JSON.stringify(Array.from(this.unlockedSkinIds))
      );
      localStorage.setItem(STORAGE_KEY_ACTIVE, this.activeSkinId);
    } catch {
      // Storage unavailable
    }
    this.notifyListeners();
  }

  public getAvailableSkins(): BallSkin[] {
    return BALL_SKINS;
  }

  public getActiveSkin(): BallSkin {
    return BALL_SKINS.find((s) => s.id === this.activeSkinId) || BALL_SKINS[0];
  }

  public isSkinUnlocked(skinId: string): boolean {
    return this.unlockedSkinIds.has(skinId);
  }

  public unlockSkin(skinId: string): boolean {
    if (!BALL_SKINS.some((s) => s.id === skinId)) return false;
    this.unlockedSkinIds.add(skinId);
    this.activeSkinId = skinId;
    this.saveToStorage();
    return true;
  }

  public setActiveSkin(skinId: string): boolean {
    if (!this.unlockedSkinIds.has(skinId)) return false;
    this.activeSkinId = skinId;
    this.saveToStorage();
    return true;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('BallSkinManager listener error:', err);
      }
    });
  }
}

export const ballSkinManager = new BallSkinManager();
