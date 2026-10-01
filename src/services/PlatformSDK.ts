/**
 * PlatformSDK Service - CrazyGames SDK v3 Integration with Fallback Support
 * Handles:
 * - CrazyGames SDK v3 initialization & lifecycle (gameplayStart, gameplayStop, happytime)
 * - Video Ads (Midgame & Rewarded) with automatic audio muting
 * - Mandatory tab visibility & window blur/focus audio silencing & auto-pause
 * - Graceful local development / standalone fallback
 */

import { soundEffects } from '../audio/SoundEffects';

export interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

export interface RewardedCallbacks {
  onReward?: () => void;
  rewardGranted?: () => void;
  onStarted?: () => void;
  adStarted?: () => void;
  onFinished?: () => void;
  adFinished?: () => void;
  onError?: (error: unknown) => void;
  adError?: (error: unknown) => void;
}

type PauseListener = (reason: 'ad' | 'blur') => void;
type ResumeListener = (reason: 'ad' | 'focus') => void;

interface CrazyGamesSDKInstance {
  init: () => Promise<void>;
  getEnvironment?: () => string;
  game: {
    gameplayStart: () => void;
    gameplayStop: () => void;
    happytime: () => void;
  };
  ad: {
    requestAd: (
      type: 'midgame' | 'rewarded',
      callbacks?: {
        adStarted?: () => void;
        adFinished?: () => void;
        adError?: (error: unknown) => void;
      }
    ) => void;
    hasAdblock?: () => Promise<boolean>;
  };
  /** CrazyGames SDK v3 Data API — mirrors localStorage */
  data?: {
    setItem: (key: string, value: string) => void;
    getItem: (key: string) => string | null;
    removeItem: (key: string) => void;
    clear: () => void;
  };
  /** CrazyGames SDK v3 User API */
  user?: {
    getUser?: () => Promise<{ username: string; profilePictureUrl: string } | null>;
    addAuthListener?: (callback: (user: { username: string } | null) => void) => void;
    removeAuthListener?: (callback: (user: { username: string } | null) => void) => void;
  };
  /** CrazyGames SDK v3 Leaderboard API */
  leaderboard?: {
    submit: (params: { name: string; score: number }) => Promise<void>;
    getScores: (params: { name: string; top: number }) => Promise<{ playerName: string; score: number }[]>;
  };
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK: CrazyGamesSDKInstance;
    };
  }
}

class PlatformSDKService {
  private isInitialized = false;
  private isAdPlaying = false;
  private isDocumentVisible = true;
  private isWindowFocused = true;
  private pauseListeners: Set<PauseListener> = new Set();
  private resumeListeners: Set<ResumeListener> = new Set();

  constructor() {
    this.setupVisibilityListeners();
  }

  /**
   * Initialize CrazyGames SDK v3 with graceful fallback
   */
  public async init(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      if (typeof window !== 'undefined' && window.CrazyGames?.SDK) {
        await window.CrazyGames.SDK.init();
        this.isInitialized = true;
        const env = window.CrazyGames.SDK.getEnvironment?.() || 'unknown';
        console.log(`[PlatformSDK] CrazyGames SDK v3 successfully initialized (Environment: ${env})`);
        return true;
      } else {
        console.log('[PlatformSDK] CrazyGames SDK script not found or blocked. Running in Standalone / Dev Fallback mode.');
        this.isInitialized = true;
        return false;
      }
    } catch (err) {
      console.warn('[PlatformSDK] Failed to initialize CrazyGames SDK v3:', err);
      this.isInitialized = true;
      return false;
    }
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.CrazyGames?.SDK);
  }

  /**
   * Signal that active gameplay has started (match kickoff / resume)
   */
  public gameplayStart(): void {
    try {
      if (window.CrazyGames?.SDK?.game) {
        window.CrazyGames.SDK.game.gameplayStart();
      }
    } catch (e) {
      console.warn('[PlatformSDK] gameplayStart error:', e);
    }
  }

  /**
   * Signal that gameplay has stopped (menu, pause, game-over)
   */
  public gameplayStop(): void {
    try {
      if (window.CrazyGames?.SDK?.game) {
        window.CrazyGames.SDK.game.gameplayStop();
      }
    } catch (e) {
      console.warn('[PlatformSDK] gameplayStop error:', e);
    }
  }

  /**
   * Trigger CrazyGames celebratory confetti animation on site
   * Use on goals scored, tournament round victory, or trophy win!
   */
  public happytime(): void {
    try {
      if (window.CrazyGames?.SDK?.game) {
        window.CrazyGames.SDK.game.happytime();
      }
    } catch (e) {
      console.warn('[PlatformSDK] happytime error:', e);
    }
  }

  /**
   * Request a midgame / interstitial ad between matches or tournament rounds.
   * Automatically mutes audio & signals system pause.
   */
  public requestMidgameAd(callbacks?: AdCallbacks): void {
    if (!this.isAvailable()) {
      callbacks?.adFinished?.();
      return;
    }

    this.onAdStarted();
    callbacks?.adStarted?.();

    try {
      window.CrazyGames!.SDK.ad.requestAd('midgame', {
        adStarted: () => {
          this.onAdStarted();
          callbacks?.adStarted?.();
        },
        adFinished: () => {
          this.onAdFinished();
          callbacks?.adFinished?.();
        },
        adError: (error) => {
          this.onAdFinished();
          callbacks?.adError?.(error);
        },
      });
    } catch (e) {
      console.warn('[PlatformSDK] requestMidgameAd error:', e);
      this.onAdFinished();
      callbacks?.adFinished?.();
    }
  }

  /**
   * Request a rewarded ad (e.g. Extra Ball / Second Chance, double coins).
   * Calls onReward when ad is watched completely.
   */
  public requestRewardedAd(callbacks: RewardedCallbacks): void {
    const triggerReward = () => {
      callbacks.onReward?.();
      callbacks.rewardGranted?.();
    };
    const triggerStarted = () => {
      callbacks.onStarted?.();
      callbacks.adStarted?.();
    };
    const triggerFinished = () => {
      callbacks.onFinished?.();
      callbacks.adFinished?.();
    };
    const triggerError = (error: unknown) => {
      callbacks.onError?.(error);
      callbacks.adError?.(error);
    };

    if (!this.isAvailable()) {
      // In local dev/fallback, award immediately so testing works seamlessly
      console.log('[PlatformSDK] Mock Rewarded Ad completed in dev mode.');
      triggerStarted();
      triggerReward();
      triggerFinished();
      return;
    }

    this.onAdStarted();
    triggerStarted();

    let rewardGiven = false;

    try {
      window.CrazyGames!.SDK.ad.requestAd('rewarded', {
        adStarted: () => {
          this.onAdStarted();
          triggerStarted();
        },
        adFinished: () => {
          rewardGiven = true;
          this.onAdFinished();
          triggerReward();
          triggerFinished();
        },
        adError: (error) => {
          this.onAdFinished();
          if (!rewardGiven) {
            triggerError(error);
          }
        },
      });
    } catch (e) {
      console.warn('[PlatformSDK] requestRewardedAd error:', e);
      this.onAdFinished();
      triggerError(e);
    }
  }

  /**
   * Subscribe to system pause requirements (ad started, tab hidden, or window blurred)
   */
  public onPauseRequired(listener: PauseListener): () => void {
    this.pauseListeners.add(listener);
    return () => {
      this.pauseListeners.delete(listener);
    };
  }

  /**
   * Subscribe to system resume allowance (ad ended, tab focused)
   */
  public onResumeAllowed(listener: ResumeListener): () => void {
    this.resumeListeners.add(listener);
    return () => {
      this.resumeListeners.delete(listener);
    };
  }

  // ─── Cloud Save / Data API ──────────────────────────────────────────────────

  /**
   * Save a key/value string to CrazyGames cloud data.
   * Falls back to localStorage when SDK is not available.
   */
  public cloudSave(key: string, value: string): void {
    try {
      if (window.CrazyGames?.SDK?.data) {
        window.CrazyGames.SDK.data.setItem(key, value);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('[PlatformSDK] cloudSave error:', e);
      try { localStorage.setItem(key, value); } catch {}
    }
  }

  /**
   * Load a value by key from CrazyGames cloud data.
   * Falls back to localStorage when SDK is not available.
   */
  public cloudLoad(key: string): string | null {
    try {
      if (window.CrazyGames?.SDK?.data) {
        return window.CrazyGames.SDK.data.getItem(key);
      }
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[PlatformSDK] cloudLoad error:', e);
      try { return localStorage.getItem(key); } catch { return null; }
    }
  }

  /**
   * Remove a key from CrazyGames cloud data (and localStorage fallback).
   */
  public cloudRemove(key: string): void {
    try {
      if (window.CrazyGames?.SDK?.data) {
        window.CrazyGames.SDK.data.removeItem(key);
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[PlatformSDK] cloudRemove error:', e);
    }
  }

  // ─── User Auth API ───────────────────────────────────────────────────────────

  /**
   * Returns the currently logged-in CrazyGames user, or null if not logged in / SDK unavailable.
   */
  public async getUser(): Promise<{ username: string; profilePictureUrl?: string } | null> {
    try {
      if (window.CrazyGames?.SDK?.user?.getUser) {
        const user = await window.CrazyGames.SDK.user.getUser();
        return user ?? null;
      }
    } catch (e) {
      console.warn('[PlatformSDK] getUser error:', e);
    }
    return null;
  }

  /**
   * Subscribe to CrazyGames auth changes (login / logout).
   * Returns an unsubscribe function. Safe no-op when SDK is unavailable.
   */
  public addAuthListener(cb: (user: { username: string } | null) => void): () => void {
    try {
      if (window.CrazyGames?.SDK?.user?.addAuthListener) {
        window.CrazyGames.SDK.user.addAuthListener(cb);
        return () => {
          try {
            window.CrazyGames?.SDK?.user?.removeAuthListener?.(cb);
          } catch {}
        };
      }
    } catch (e) {
      console.warn('[PlatformSDK] addAuthListener error:', e);
    }
    // No-op unsubscribe when SDK is unavailable
    return () => {};
  }

  // ─── Leaderboard API ────────────────────────────────────────────────────────

  /**
   * Submit a score to a CrazyGames leaderboard. Fire-and-forget; logs on error.
   */
  public submitLeaderboardScore(boardName: string, score: number): void {
    if (!window.CrazyGames?.SDK?.leaderboard) return;
    window.CrazyGames.SDK.leaderboard
      .submit({ name: boardName, score })
      .catch((e: unknown) => console.warn('[PlatformSDK] submitLeaderboardScore error:', e));
  }

  /**
   * Fetch top scores from a CrazyGames leaderboard.
   * Returns an empty array if SDK is unavailable or the call fails.
   */
  public async getLeaderboardScores(
    boardName: string,
    top: number
  ): Promise<Array<{ playerName: string; score: number }>> {
    try {
      if (window.CrazyGames?.SDK?.leaderboard) {
        return await window.CrazyGames.SDK.leaderboard.getScores({ name: boardName, top });
      }
    } catch (e) {
      console.warn('[PlatformSDK] getLeaderboardScores error:', e);
    }
    return [];
  }

  // ────────────────────────────────────────────────────────────────────────────

  private onAdStarted(): void {
    this.isAdPlaying = true;
    soundEffects.setSystemMuted(true);
    this.notifyPauseListeners('ad');
  }

  private onAdFinished(): void {
    this.isAdPlaying = false;
    if (this.isDocumentVisible && this.isWindowFocused) {
      soundEffects.setSystemMuted(false);
      this.notifyResumeListeners('ad');
    }
  }

  private setupVisibilityListeners(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Tab visibility change (browser tab switched or minimized)
    document.addEventListener('visibilitychange', () => {
      const isVisible = !document.hidden;
      this.isDocumentVisible = isVisible;

      if (!isVisible) {
        soundEffects.setSystemMuted(true);
        this.notifyPauseListeners('blur');
      } else if (!this.isAdPlaying && this.isWindowFocused) {
        soundEffects.setSystemMuted(false);
        this.notifyResumeListeners('focus');
      }
    });

    // 2. Window blur & focus
    window.addEventListener('blur', () => {
      this.isWindowFocused = false;
      soundEffects.setSystemMuted(true);
      this.notifyPauseListeners('blur');
    });

    window.addEventListener('focus', () => {
      this.isWindowFocused = true;
      if (!this.isAdPlaying && this.isDocumentVisible) {
        soundEffects.setSystemMuted(false);
        this.notifyResumeListeners('focus');
      }
    });
  }

  private notifyPauseListeners(reason: 'ad' | 'blur'): void {
    for (const listener of this.pauseListeners) {
      try {
        listener(reason);
      } catch (err) {
        console.error('[PlatformSDK] Error in pause listener:', err);
      }
    }
  }

  private notifyResumeListeners(reason: 'ad' | 'focus'): void {
    for (const listener of this.resumeListeners) {
      try {
        listener(reason);
      } catch (err) {
        console.error('[PlatformSDK] Error in resume listener:', err);
      }
    }
  }
}

export const platformSDK = new PlatformSDKService();
