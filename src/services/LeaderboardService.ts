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
  }

  private loadFromStorage() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const savedDate = localStorage.getItem(STORAGE_KEYS.DAILY_DATE);

      // Check daily reset
      if (savedDate !== today) {
        this.dailyGoals = 0;
        this.dailyHighScore = 0;
        localStorage.setItem(STORAGE_KEYS.DAILY_DATE, today);
        localStorage.setItem(STORAGE_KEYS.DAILY_GOALS, '0');
        localStorage.setItem(STORAGE_KEYS.DAILY_HIGH_SCORE, '0');
      } else {
        this.dailyGoals = parseInt(localStorage.getItem(STORAGE_KEYS.DAILY_GOALS) || '0', 10);
        this.dailyHighScore = parseInt(localStorage.getItem(STORAGE_KEYS.DAILY_HIGH_SCORE) || '0', 10);
      }

      this.currentStreak = parseInt(localStorage.getItem(STORAGE_KEYS.CURRENT_STREAK) || '0', 10);
      this.bestStreak = parseInt(localStorage.getItem(STORAGE_KEYS.BEST_STREAK) || '0', 10);
      this.trophiesWon = parseInt(localStorage.getItem(STORAGE_KEYS.TROPHIES_WON) || '0', 10);
      this.coins = parseInt(localStorage.getItem(STORAGE_KEYS.COINS) || '120', 10);

      const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
      if (savedName && savedName.trim().length > 0) {
        const clean = savedName.trim().slice(0, 14);
        if (clean.toLowerCase() === 'striker' || clean.toLowerCase() === 'striker#1') {
          this.playerName = 'Player1';
        } else {
          this.playerName = clean;
        }
      }

      const savedCountryCode = localStorage.getItem(STORAGE_KEYS.PLAYER_COUNTRY);
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
    this.notify();
  }

  public spendCoins(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.coins < amount) return false;
    this.coins -= amount;
    this.saveCoins();
    this.notify();
    return true;
  }

  private saveCoins() {
    try {
      localStorage.setItem(STORAGE_KEYS.COINS, String(this.coins));
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
      localStorage.setItem(STORAGE_KEYS.TROPHIES_WON, String(this.trophiesWon));
      localStorage.setItem(STORAGE_KEYS.COINS, String(this.coins));
    } catch {}
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
      localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, clean);
    } catch {}
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
        localStorage.setItem(STORAGE_KEYS.PLAYER_COUNTRY, found.code);
      } catch {}
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
      localStorage.setItem(STORAGE_KEYS.CURRENT_STREAK, String(this.currentStreak));
      localStorage.setItem(STORAGE_KEYS.BEST_STREAK, String(this.bestStreak));
      localStorage.setItem(STORAGE_KEYS.DAILY_GOALS, String(this.dailyGoals));
      localStorage.setItem(STORAGE_KEYS.DAILY_HIGH_SCORE, String(this.dailyHighScore));
      localStorage.setItem(STORAGE_KEYS.COINS, String(this.coins));
    } catch {}

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
      localStorage.setItem(STORAGE_KEYS.DAILY_GOALS, String(this.dailyGoals));
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

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const leaderboardService = new LeaderboardService();
