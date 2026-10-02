/**
 * MultiplayerService.ts
 * Singleton wrapping Playroom Kit for Soccer Pinball online multiplayer.
 * Handles: room creation, player sync, host-authoritative ball state, input broadcasting.
 *
 * Uses dynamic import() for playroomkit to avoid increasing initial bundle size.
 */

export interface OnlinePlayerState {
  id: string;
  name: string;
  country: string;
  flag: string;
  isHost: boolean;
}

export interface BallSyncState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Monotonically increasing tick — clients discard stale packets */
  tick: number;
}

export interface InputState {
  leftFlipper: boolean;
  rightFlipper: boolean;
  actionKick: boolean;
}

class MultiplayerService {
  private _isOnline = false;
  private _isHost = false;
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();
  private lastBallTick = -1;

  public get isOnline() {
    return this._isOnline;
  }
  public get iAmHost() {
    return this._isHost;
  }

  /** Lazy import to avoid loading Playroom at startup (code splitting) */
  private playroomKit: typeof import('playroomkit') | null = null;

  private async loadPlayroom() {
    if (!this.playroomKit) {
      this.playroomKit = await import('playroomkit');
    }
    return this.playroomKit;
  }

  /**
   * Initialize Playroom Kit lobby and set up event listeners.
   * Resolves once the local player has entered the room.
   */
  public async startOnlineMatch(options: {
    playerName: string;
    playerCountry: string;
    playerFlag: string;
    onPlayerJoined: (player: OnlinePlayerState) => void;
    onPlayerLeft: (playerId: string) => void;
    onGameStart: (amHost: boolean) => void;
  }): Promise<void> {
    const pk = await this.loadPlayroom();

    await pk.insertCoin({
      matchmaking: true,
      maxPlayersPerRoom: 2,
      skipLobby: false,
    } as Parameters<typeof pk.insertCoin>[0]);

    this._isOnline = true;
    this._isHost = pk.isHost();

    pk.onPlayerJoin((playerState) => {
      // Set local player metadata on first join
      if (playerState.id === pk.myPlayer()?.id) {
        playerState.setState('name', options.playerName);
        playerState.setState('country', options.playerCountry);
        playerState.setState('flag', options.playerFlag);
      }

      options.onPlayerJoined({
        id: playerState.id,
        name: (playerState.getState('name') as string | undefined) || 'Opponent',
        country: (playerState.getState('country') as string | undefined) || 'World',
        flag: (playerState.getState('flag') as string | undefined) || '🌍',
        isHost: pk.isHost(),
      });

      playerState.onQuit(() => {
        options.onPlayerLeft(playerState.id);
        this._isOnline = false;
      });
    });

    // Register RPCs for goal events (host broadcasts, all receive)
    pk.RPC.register('goal', async (data: unknown, _sender) => {
      this.emit('goal', data);
    });

    pk.RPC.register('gameOver', async (data: unknown, _sender) => {
      this.emit('gameOver', data);
    });

    // Client sends action kick to host via RPC
    pk.RPC.register('actionKick', async (_data: unknown, _sender) => {
      this.emit('actionKick', {});
    });

    options.onGameStart(this._isHost);
  }

  // ---------------------------------------------------------------------------
  // Ball physics sync (host-authoritative)
  // ---------------------------------------------------------------------------

  /** Host broadcasts ball physics state every frame tick */
  public syncBall(state: BallSyncState): void {
    if (!this._isOnline || !this._isHost || !this.playroomKit) return;
    this.playroomKit.setState('ball', state);
  }

  /**
   * Client reads ball state from host.
   * Returns null if state is stale or unavailable.
   */
  public readBallState(): BallSyncState | null {
    if (!this._isOnline || this._isHost || !this.playroomKit) return null;
    const state = this.playroomKit.getState('ball') as BallSyncState | null;
    if (!state || state.tick <= this.lastBallTick) return null;
    this.lastBallTick = state.tick;
    return state;
  }

  // ---------------------------------------------------------------------------
  // Player input sync
  // ---------------------------------------------------------------------------

  /** Broadcast local player flipper/kick inputs to shared state */
  public sendInput(input: InputState): void {
    if (!this._isOnline || !this.playroomKit) return;
    const me = this.playroomKit.myPlayer();
    if (!me) return;
    me.setState('input', input);
  }

  /** Client sends an action kick event to the host via RPC */
  public sendActionKick(): void {
    if (!this._isOnline || this._isHost || !this.playroomKit) return;
    this.playroomKit.RPC.call('actionKick', {}, this.playroomKit.RPC.Mode.HOST);
  }

  /**
   * Host reads opponent (client) inputs.
   * Iterates all Playroom participants, finds the non-local player, and reads their 'input' state.
   */
  public readOpponentInput(): InputState | null {
    if (!this._isOnline || !this._isHost || !this.playroomKit) return null;
    const myId = this.playroomKit.myPlayer()?.id;
    if (!myId) return null;
    const participants = this.playroomKit.getParticipants();
    for (const [id, player] of Object.entries(participants)) {
      if (id !== myId) {
        const raw = player.getState('input') as InputState | null | undefined;
        if (raw) return raw;
      }
    }
    return null;
  }


  // ---------------------------------------------------------------------------
  // Goal / game-over RPCs (host only)
  // ---------------------------------------------------------------------------

  /** Announce a goal to all clients (host calls this) */
  public announceGoal(
    scorer: 'pinball' | 'players',
    scoreHost: number,
    scoreGuest: number
  ): void {
    if (!this._isOnline || !this._isHost || !this.playroomKit) return;
    this.playroomKit.RPC.call(
      'goal',
      { scorer, scoreHost, scoreGuest },
      this.playroomKit.RPC.Mode.ALL
    );
  }

  /** Announce game over to all clients (host calls this) */
  public announceGameOver(winner: string): void {
    if (!this._isOnline || !this._isHost || !this.playroomKit) return;
    this.playroomKit.RPC.call(
      'gameOver',
      { winner },
      this.playroomKit.RPC.Mode.ALL
    );
  }

  // ---------------------------------------------------------------------------
  // Event emitter
  // ---------------------------------------------------------------------------

  public on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
    return () => {
      const arr = this.listeners.get(event) || [];
      this.listeners.set(event, arr.filter((h) => h !== handler));
    };
  }

  private emit(event: string, data: unknown): void {
    (this.listeners.get(event) || []).forEach((h) => h(data));
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  public disconnect(): void {
    this._isOnline = false;
    this._isHost = false;
    this.lastBallTick = -1;
    this.listeners.clear();
    // Playroom handles socket cleanup automatically on page unload
  }
}

export const multiplayerService = new MultiplayerService();
