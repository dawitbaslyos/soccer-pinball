import { platformSDK } from './PlatformSDK';
import { ALL_COUNTRIES, CountryItem } from '../data/countries';

export { ALL_COUNTRIES, type CountryItem };
export const POPULAR_COUNTRIES = ALL_COUNTRIES;

export interface LeaderboardEntry {
  rank: number;
  name: string;
  country: string; // Flag code or emoji
  flag: string;
  score: number;
  isCurrentPlayer?: boolean;
}

export interface PlayerIdentity {
  name: string;
  countryCode: string;
  countryName: string;
  flag: string;
}

const STORAGE_KEYS = {
  PLAYER_NAME: 'soccer_pinball_player_name',
  PLAYER_COUNTRY: 'soccer_pinball_player_country',
  CURRENT_STREAK: 'soccer_pinball_current_streak',
  BEST_STREAK: 'soccer_pinball_best_streak',
  DAILY_GOALS: 'soccer_pinball_daily_goals',
  DAILY_HIGH_SCORE: 'soccer_pinball_daily_high_score',
  DAILY_DATE: 'soccer_pinball_daily_date',
  TROPHIES_WON: 'soccer_pinball_trophies_won',
  COINS: 'soccer_pinball_coins',
  /** Cloud save blob key */
  CLOUD_BLOB: 'sp_save_v1',
};

class LeaderboardService {
  private listeners: Array<() => void> = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private trophiesWon = 0;
  private coins = 120;
  private dailyGoals = 0;
  private dailyHighScore = 0;
  private playerName = 'Player1';
  private playerCountry: CountryItem = ALL_COUNTRIES.find((c) => c.code === 'BR') || ALL_COUNTRIES[0];

  constructor() {
    this.loadFromStorage();
    // Kick off cloud sync asynchronously after local load
    this.syncFromCloud().catch(() => {});
  }

  private loadFromStorage() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const savedDate = platformSDK.cloudLoad(STORAGE_KEYS.DAILY_DATE);

      // Check daily reset
      if (savedDate !== today) {
        this.dailyGoals = 0;
        this.dailyHighScore = 0;
        platformSDK.cloudSave(STORAGE_KEYS.DAILY_DATE, today);
        platformSDK.cloudSave(STORAGE_KEYS.DAILY_GOALS, '0');
        platformSDK.cloudSave(STORAGE_KEYS.DAILY_HIGH_SCORE, '0');
      } else {
        this.dailyGoals = parseInt(platformSDK.cloudLoad(STORAGE_KEYS.DAILY_GOALS) || '0', 10);
        this.dailyHighScore = parseInt(platformSDK.cloudLoad(STORAGE_KEYS.DAILY_HIGH_SCORE) || '0', 10);
      }

      this.currentStreak = parseInt(platformSDK.cloudLoad(STORAGE_KEYS.CURRENT_STREAK) || '0', 10);
      this.bestStreak = parseInt(platformSDK.cloudLoad(STORAGE_KEYS.BEST_STREAK) || '0', 10);
      this.trophiesWon = parseInt(platformSDK.cloudLoad(STORAGE_KEYS.TROPHIES_WON) || '0', 10);
      this.coins = parseInt(platformSDK.cloudLoad(STORAGE_KEYS.COINS) || '120', 10);

      const savedName = platformSDK.cloudLoad(STORAGE_KEYS.PLAYER_NAME);
      if (savedName && savedName.trim().length > 0) {
        const clean = savedName.trim().slice(0, 14);
        if (clean.toLowerCase() === 'striker' || clean.toLowerCase() === 'striker#1') {
          this.playerName = 'Player1';
        } else {
          this.playerName = clean;
        }
      }

      const savedCountryCode = platformSDK.cloudLoad(STORAGE_KEYS.PLAYER_COUNTRY);
      if (savedCountryCode) {
        const found = ALL_COUNTRIES.find(
          (c) =>
            c.code.toLowerCase() === savedCountryCode.toLowerCase() ||
            c.name.toLowerCase() === savedCountryCode.toLowerCase()
        );
        if (found) this.playerCountry = found;
      }
    } catch {
      // Storage unavailable / private mode
    }
  }

  /**
   * Async cloud sync: fetches the CG user (for auto-name) and merges cloud blob stats.
   */
  private async syncFromCloud(): Promise<void> {
    try {
      // 1. Auto-set player name from CG user if still default
      const cgUser = await platformSDK.getUser();
      if (cgUser && cgUser.username) {
        if (this.playerName === 'Player1') {
          this.playerName = cgUser.username.slice(0, 14);
          platformSDK.cloudSave(STORAGE_KEYS.PLAYER_NAME, this.playerName);
        }
      }

      // 2. Load cloud blob and merge higher values
      const blobRaw = platformSDK.cloudLoad(STORAGE_KEYS.CLOUD_BLOB);
      if (blobRaw) {
        const blob = JSON.parse(blobRaw) as {
          coins?: number;
          bestStreak?: number;
          trophiesWon?: number;
          dailyHighScore?: number;
          playerName?: string;
          playerCountryCode?: string;
        };

        if (typeof blob.bestStreak === 'number' && blob.bestStreak > this.bestStreak) {
          this.bestStreak = blob.bestStreak;
        }
        if (typeof blob.trophiesWon === 'number' && blob.trophiesWon > this.trophiesWon) {
          this.trophiesWon = blob.trophiesWon;
        }
        if (typeof blob.coins === 'number' && blob.coins > this.coins) {
          this.coins = blob.coins;
        }
        if (typeof blob.dailyHighScore === 'number' && blob.dailyHighScore > this.dailyHighScore) {
          this.dailyHighScore = blob.dailyHighScore;
        }
        // Accept cloud player name only if local is still default
        if (blob.playerName && this.playerName === 'Player1') {
          this.playerName = blob.playerName.slice(0, 14);
        }
        if (blob.playerCountryCode) {
          const found = ALL_COUNTRIES.find(
            (c) => c.code.toLowerCase() === blob.playerCountryCode!.toLowerCase()
          );
          if (found) this.playerCountry = found;
        }
      }
    } catch {
      // Network / parse errors are non-fatal
    }

    this.notify();
  }

  /**
   * Save a cloud blob snapshot of the key progression stats.
   */
  private saveToCloud(): void {
    try {
      const blob = JSON.stringify({
        coins: this.coins,
        bestStreak: this.bestStreak,
        trophiesWon: this.trophiesWon,
        dailyHighScore: this.dailyHighScore,
        playerName: this.playerName,
        playerCountryCode: this.playerCountry.code,
      });
      platformSDK.cloudSave(STORAGE_KEYS.CLOUD_BLOB, blob);
    } catch {
      // Non-fatal
    }
  }

  /**
   * Subscribe to CrazyGames auth changes.
   * On login, re-runs syncFromCloud so the new user's cloud data is merged.
   * Returns an unsubscribe function.
   */
  public subscribeToAuth(): () => void {
    return platformSDK.addAuthListener((user) => {
      if (user) {
        // User just logged in — refresh cloud state
        this.syncFromCloud().catch(() => {});
      }
    });
  }

  public getIdentity(): PlayerIdentity {
    return {
      name: this.playerName,
      countryCode: this.playerCountry.code,
      countryName: this.playerCountry.name,
      flag: this.playerCountry.flag,
    };
  }

  public getCoins(): number {
    return this.coins;
  }

  public addCoins(amount: number) {
    if (amount <= 0) return;
    this.coins += amount;
    this.saveCoins();
    this.saveToCloud();
    this.notify();
  }

  public spendCoins(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.coins < amount) return false;
    this.coins -= amount;
    this.saveCoins();
    this.saveToCloud();
    this.notify();
    return true;
  }

  private saveCoins() {
    try {
      platformSDK.cloudSave(STORAGE_KEYS.COINS, String(this.coins));
    } catch {}
  }

  /**
   * Daily Streak boosts score: +10% boost per consecutive win/streak day (max +100% / 2x multiplier).
   */
  public getStreakScoreMultiplier(): number {
    return 1.0 + Math.min(1.0, this.currentStreak * 0.10);
  }

  public getStreakBoostPercent(): number {
    return Math.round((this.getStreakScoreMultiplier() - 1.0) * 100);
  }

  public getStats() {
    return {
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      trophiesWon: this.trophiesWon,
      coins: this.coins,
      dailyGoals: this.dailyGoals,
      dailyHighScore: this.dailyHighScore,
      playerName: this.playerName,
      playerCountry: this.playerCountry.name,
      playerCountryCode: this.playerCountry.code,
      playerFlag: this.playerCountry.flag,
      streakMultiplier: this.getStreakScoreMultiplier(),
      streakBoostPercent: this.getStreakBoostPercent(),
    };
  }

  public recordWorldCupVictory() {
    this.trophiesWon += 1;
    const earnedCoins = Math.round(100 * this.getStreakScoreMultiplier());
    this.coins += earnedCoins;
    try {
      platformSDK.cloudSave(STORAGE_KEYS.TROPHIES_WON, String(this.trophiesWon));
      platformSDK.cloudSave(STORAGE_KEYS.COINS, String(this.coins));
    } catch {}
    this.saveToCloud();
    // Submit daily high score to leaderboard (fire-and-forget)
    platformSDK.submitLeaderboardScore('high_score', this.dailyHighScore);
    this.notify();
  }

  public getTrophiesWon(): number {
    return this.trophiesWon;
  }

  public recordGoalScored(count = 1) {
    this.addDailyGoals(count);
    const earnedCoins = Math.round(5 * count * this.getStreakScoreMultiplier());
    this.addCoins(earnedCoins);
  }

  public setPlayerName(name: string) {
    const trimmed = name.trim().slice(0, 14);
    const clean = trimmed.length > 0 ? trimmed : 'Player1';
    this.playerName = clean;
    try {
      platformSDK.cloudSave(STORAGE_KEYS.PLAYER_NAME, clean);
    } catch {}
    this.saveToCloud();
    this.notify();
  }

  public setPlayerCountry(countryNameOrCode: string) {
    const clean = countryNameOrCode.trim().toLowerCase();
    const found = ALL_COUNTRIES.find(
      (c) => c.code.toLowerCase() === clean || c.name.toLowerCase() === clean
    );
    if (found) {
      this.playerCountry = found;
      try {
        platformSDK.cloudSave(STORAGE_KEYS.PLAYER_COUNTRY, found.code);
      } catch {}
      this.saveToCloud();
      this.notify();
    }
  }

  public getCurrentStreak(): number {
    return this.currentStreak;
  }

  public getBestStreak(): number {
    return this.bestStreak;
  }

  public getDailyGoals(): number {
    return this.dailyGoals;
  }

  public getDailyHighScore(): number {
    return this.dailyHighScore;
  }

  public recordMatchResult(won: boolean, matchScore: number, matchGoals: number) {
    // 1. Streak & coins handling
    if (won) {
      this.currentStreak += 1;
      if (this.currentStreak > this.bestStreak) {
        this.bestStreak = this.currentStreak;
      }
      const earnedCoins = Math.round(25 * this.getStreakScoreMultiplier());
      this.coins += earnedCoins;
    } else {
      this.currentStreak = 0;
    }

    // 2. Daily goals & score accumulation
    this.dailyGoals += matchGoals;
    if (matchScore > this.dailyHighScore) {
      this.dailyHighScore = matchScore;
    }

    try {
      platformSDK.cloudSave(STORAGE_KEYS.CURRENT_STREAK, String(this.currentStreak));
      platformSDK.cloudSave(STORAGE_KEYS.BEST_STREAK, String(this.bestStreak));
      platformSDK.cloudSave(STORAGE_KEYS.DAILY_GOALS, String(this.dailyGoals));
      platformSDK.cloudSave(STORAGE_KEYS.DAILY_HIGH_SCORE, String(this.dailyHighScore));
      platformSDK.cloudSave(STORAGE_KEYS.COINS, String(this.coins));
    } catch {}

    this.saveToCloud();

    // Submit to leaderboard on wins (fire-and-forget)
    if (won) {
      platformSDK.submitLeaderboardScore('high_score', this.dailyHighScore);
    }

    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public addDailyGoals(goals = 1) {
    this.dailyGoals += goals;
    try {
      platformSDK.cloudSave(STORAGE_KEYS.DAILY_GOALS, String(this.dailyGoals));
    } catch {}
    this.notify();
  }

  // Generates real-time leaderboard data seeded with competitive community benchmarks
  public getLeaderboard(tab: 'goals' | 'scores' | 'streaks'): LeaderboardEntry[] {
    const currentVal =
      tab === 'goals'
        ? this.dailyGoals
        : tab === 'scores'
        ? this.dailyHighScore
        : this.currentStreak;

    // Seeded competitive players representing global CrazyGames community
    const seeded =
      tab === 'goals'
        ? [
            { name: 'Kaiser99', flag: '🇩🇪', score: 38 },
            { name: 'NeymarJR_Fan', flag: '🇧🇷', score: 32 },
            { name: 'Mbappe_Speed', flag: '🇫🇷', score: 27 },
            { name: 'LeoTheGoat', flag: '🇦🇷', score: 23 },
            { name: 'CR7_Siuuu', flag: '🇵🇹', score: 19 },
            { name: 'SamuraiStrike', flag: '🇯🇵', score: 16 },
            { name: 'GoldenBoot', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', score: 14 },
            { name: 'TikiTaka_X', flag: '🇪🇸', score: 11 },
            { name: 'SoccerKing', flag: '🇺🇸', score: 8 },
          ]
        : tab === 'scores'
        ? [
            { name: 'PinballWizard', flag: '🇫🇷', score: 48500 },
            { name: 'LeoTheGoat', flag: '🇦🇷', score: 42100 },
            { name: 'Kaiser99', flag: '🇩🇪', score: 36800 },
            { name: 'NeymarJR_Fan', flag: '🇧🇷', score: 31200 },
            { name: 'CR7_Siuuu', flag: '🇵🇹', score: 26500 },
            { name: 'SamuraiStrike', flag: '🇯🇵', score: 21900 },
            { name: 'GoldenBoot', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', score: 18400 },
            { name: 'TikiTaka_X', flag: '🇪🇸', score: 15600 },
            { name: 'SoccerKing', flag: '🇺🇸', score: 12200 },
          ]
        : [
            { name: 'Unstoppable', flag: '🇧🇷', score: 12 },
            { name: 'LeoTheGoat', flag: '🇦🇷', score: 9 },
            { name: 'Kaiser99', flag: '🇩🇪', score: 7 },
            { name: 'Mbappe_Speed', flag: '🇫🇷', score: 6 },
            { name: 'CR7_Siuuu', flag: '🇵🇹', score: 5 },
            { name: 'SamuraiStrike', flag: '🇯🇵', score: 4 },
            { name: 'GoldenBoot', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', score: 3 },
            { name: 'TikiTaka_X', flag: '🇪🇸', score: 2 },
            { name: 'SoccerKing', flag: '🇺🇸', score: 1 },
          ];

    // Combine player with seeded competitors
    const all = [
      ...seeded.map((s) => ({
        name: s.name,
        country: s.flag,
        flag: s.flag,
        score: s.score,
        isCurrentPlayer: false,
      })),
      {
        name: this.playerName,
        country: this.playerCountry.code,
        flag: this.playerCountry.flag,
        score: currentVal,
        isCurrentPlayer: true,
      },
    ];

    // Sort descending by score
    all.sort((a, b) => b.score - a.score);

    // Assign rank 1-10
    return all.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const leaderboardService = new LeaderboardService();
