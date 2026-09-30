import * as THREE from 'three';
import confetti from 'canvas-confetti';
import {
  CameraViewMode,
  GameMode,
  GameStats,
  PlayerRole,
  FieldPlayerConfig,
  PlayerProfile,
  PenaltyState,
  ROLE_TACTICAL_ZONES,
  TacticalZone,
} from '../types';
import { soundEffects } from '../audio/SoundEffects';
import { PRESET_FORMATIONS } from './formations';
import { rosterManager, RosterPlayer } from '../services/RosterManager';

export interface EngineCallbacks {
  onScoreUpdate: (stats: GameStats) => void;
  onGoal: (scorer: 'pinball' | 'players', stats: GameStats) => void;
  onBallLost: (ballsLeft: number) => void;
  onPlayersChanged?: (players: FieldPlayerConfig[]) => void;
  onPlayerSelected?: (player: FieldPlayerConfig | null) => void;
  onComboPass?: (comboCount: number, playerName: string) => void;
  onPenaltyCard?: (card: 'yellow' | 'red') => void;
  onPenaltyPhaseChange?: (penalty: PenaltyState | null) => void;
  onPowerKickAvailabilityChange?: (isReady: boolean) => void;
  onPlacementFeedback?: (feedback: { message: string; type: 'warning' | 'error' | 'success' }) => void;
  onActiveRoleZoneChange?: (role: PlayerRole | null) => void;
  onEjectedRolesChange?: (roles: PlayerRole[]) => void;
  onTwoPlayerPhaseChange?: (phase: {
    isSetup: boolean;
    p1Locked: boolean;
    p2Locked: boolean;
    countdown: number | null;
  }) => void;
}

export interface PlayerCharacter {
  id: string;
  name: string;
  group: THREE.Group;
  basePos: THREE.Vector3;
  legRight: THREE.Group;
  legLeft: THREE.Group;
  head: THREE.Mesh;
  targetRing: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  aimLine: THREE.Line;
  roleBadgeMesh: THREE.Mesh;
  isKicking: boolean;
  kickTimer: number;
  isStunned: boolean;
  stunTimer: number;
  stunStars: THREE.Group;
  role: PlayerRole;
  facingAngle: number;
  isDragging?: boolean;
  knockoutCount: number;
  hasYellowCard: boolean;
  isEjected: boolean;
  cardMesh?: THREE.Mesh;
  team?: 'p1' | 'p2';
  profile?: PlayerProfile;
  kickCooldown?: number;
}

interface Flipper {
  group: THREE.Group;
  mesh: THREE.Mesh;
  pivot: THREE.Vector3;
  isLeft: boolean;
  currentAngle: number;
  targetAngle: number;
  restAngle: number;
  activeAngle: number;
  angularVelocity: number;
  length: number;
  width: number;
}

export class SoccerPinballEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  // Cameras
  private engineCamera: THREE.PerspectiveCamera;
  private gameplayCamera: THREE.PerspectiveCamera;
  public viewMode: CameraViewMode = 'gameplay';
  public gameMode: GameMode = 'home';

  // Game elements
  private ballMesh!: THREE.Mesh;
  private ballRadius = 0.38;
  private ballPos = new THREE.Vector3(0, 0.38, 5.0);
  private ballVel = new THREE.Vector3(0, 0, 0);
  private ballSpin = 0; // Angular velocity around Y-axis (rad/s) for curving shots
  private isBallInPlay = true;
  public isPowerKickActive = false;
  private lastPowerKickReady = false;
  private stuckTimer = 0;
  private lastAutoFormationIdx = 0;
  private currentSkinId = 'classic';
  private ballTexture: THREE.CanvasTexture | null = null;
  public hasUsedSecondChance = false;
  private wasLastShotBank = false;
  private scoreMultiplier = 1.0;

  // Visual Effects & Game Juice
  private shakeIntensity = 0;
  private shakeDecay = 7.5;
  private baseCameraPos = new THREE.Vector3(0, 20.5, 15.8);
  private timeScale = 1.0;
  private slowMoTimer = 0;

  // High-Velocity Ball Fire / Speed Trail
  private ballTrailLine!: THREE.Line;
  private ballTrailGeo!: THREE.BufferGeometry;
  private maxTrailPoints = 16;
  private ballTrailHistory: THREE.Vector3[] = [];
  private ballTrailPositions = new Float32Array(16 * 3);
  private ballTrailColors = new Float32Array(16 * 3);
  private ballTrailEmitTimer = 0;

  // Match timer (2 minutes max = 120 seconds)
  private matchTimerAccumulator = 0;

  // Penalty Phase State
  public isPenaltyPhase = false;
  private penaltyTimeRemaining = 0;
  private penaltyTotalTime = 6.0;
  private penaltyKicker: PlayerCharacter | null = null;
  private penaltyCardType: 'yellow' | 'red' = 'yellow';
  private penaltyAimLine!: THREE.Line;
  private penaltySpotRing!: THREE.Mesh;
  private penaltyLastEmitTime = 0;
  private penaltySavedPlayerPositions: Map<string, THREE.Vector3> = new Map();
  private penaltyShotActiveTimer = 0; // Ensures only the single penalty taker shoots and others do not intercept

  // Pitch & Environment
  private pitchWidth = 9.0;
  private pitchLength = 22.0; // Z: -11 to +11
  private centerCircleScoreMesh!: THREE.Mesh;
  private centerCircleScoreTexture!: THREE.CanvasTexture;

  // Flippers
  private leftFlipper!: Flipper;
  private rightFlipper!: Flipper;
  private isLeftFlipperDown = false;
  private isRightFlipperDown = false;
  private leftFlipperHoldTimer = 0;
  private rightFlipperHoldTimer = 0;
  private kickResetTimeout: ReturnType<typeof setTimeout> | null = null;

  // Top Flippers for Player 2 (Z = -8.80)
  private topFlipperLeft!: Flipper;
  private topFlipperRight!: Flipper;
  private isP2LeftFlipperDown = false;
  private isP2RightFlipperDown = false;
  private p2LeftFlipperHoldTimer = 0;
  private p2RightFlipperHoldTimer = 0;

  // 2-Player Head-to-Head Tactical Setup State
  public isTwoPlayerSetupPhase = false;
  public isP1LockedIn = false;
  public isP2LockedIn = false;
  public twoPlayerCountdown: number | null = null;
  private twoPlayerCountdownInterval: ReturnType<typeof setInterval> | null = null;

  // Autonomous CPU Opponent for Top Flippers (used in Tournament & vs CPU)
  public isP2Cpu = false;
  private p2CpuDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  public p2CountryName: string = '';
  public p2CountryBadge: string = '🇯🇵';
  public p2JerseyColor: number = 0x004098;
  public p2ShortsColor: number = 0xffffff;
  private p2AiHoldTimerLeft = 0;
  private p2AiHoldTimerRight = 0;

  public setP2Cpu(
    isCpu: boolean,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    countryName: string = '',
    countryBadge: string = '',
    colors?: { jersey: number; shorts: number }
  ) {
    this.isP2Cpu = isCpu;
    this.p2CpuDifficulty = difficulty;
    if (countryName) this.p2CountryName = countryName;
    if (countryBadge) this.p2CountryBadge = countryBadge;
    if (colors) {
      this.p2JerseyColor = colors.jersey;
      this.p2ShortsColor = colors.shorts;
    }
    if (isCpu) {
      this.isP2LockedIn = true;
    }
  }

  public setP2LockedIn(locked: boolean) {
    this.isP2LockedIn = locked;
    this.notifyTwoPlayerPhase();
  }

  // Autonomous Pinball AI (active when user plays as Team)
  private aiLeftHoldTimer = 0;
  private aiRightHoldTimer = 0;
  private aiKickCooldown = 0;
  private aiDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  private targetMaxGoals = 5;

  public setAiDifficulty(difficulty: 'easy' | 'medium' | 'hard') {
    this.aiDifficulty = difficulty;
  }

  public setMaxGoals(max: number) {
    this.targetMaxGoals = Math.max(1, max);
    this.stats.maxGoals = this.targetMaxGoals;
  }

  // Overall max players on field is 3; unique role on pitch
  public static readonly MAX_FIELD_PLAYERS = 3;

  // Track players who received a red card and are ejected (-1 player!)
  public ejectedRoles: Set<PlayerRole> = new Set();

  // Mascot Drag & Drop Ghost Placement
  private ghostGroup: THREE.Group | null = null;
  private ghostRole: PlayerRole | null = null;

  // Goalkeeper
  private keeperGroup!: THREE.Group;
  private keeperPos = new THREE.Vector3(0, 0, -9.8);
  private keeperVelX = 2.8;
  private isKeeperDiving = false;
  private keeperDiveTimer = 0;
  private keeperTargetX = 0;
  private isDraggingKeeper = false;
  private consecutiveKnockouts = 0;

  // Field Players & Tactician Placement
  public static readonly MIN_PLAYER_SPACING = 2.0;
  private fieldPlayers: PlayerCharacter[] = [];
  private customSquadPlayers: RosterPlayer[] = rosterManager.getActiveSquad();
  private unsubscribeRoster?: () => void;

  public syncRosterSquad(squad?: [RosterPlayer, RosterPlayer, RosterPlayer]) {
    this.customSquadPlayers = squad || rosterManager.getActiveSquad();
    this.applySquadProfilesToFieldPlayers();
  }

  public applySquadProfilesToFieldPlayers() {
    if (!this.fieldPlayers || this.fieldPlayers.length === 0) return;
    this.fieldPlayers.forEach((player) => {
      if (player.team === 'p2') return;

      const squadIdx = player.role === 'striker' ? 0 : (player.role === 'midfielder' || player.role === 'cannon') ? 1 : 2;
      const squadMember = this.customSquadPlayers[squadIdx];
      if (!squadMember) return;

      player.name = squadMember.name;
      player.profile = {
        id: squadMember.id,
        name: squadMember.name,
        rarity: squadMember.rarity,
        iq: squadMember.stats.iq,
        shotAccuracy: squadMember.stats.iq,
        passSpeed: squadMember.stats.power,
        power: squadMember.stats.power,
        speed: squadMember.stats.speed,
        hitbox: squadMember.stats.hitbox,
        perkTitle: squadMember.perkTitle,
        specialTrait: squadMember.stats.iq >= 90 ? 'bank_master' : undefined,
      };

      // Dynamically re-tint jersey and shorts meshes if present
      player.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          // Torso mesh (positioned around y = 1.35)
          if (Math.abs(child.position.y - 1.35) < 0.12) {
            child.material.color.setHex(squadMember.colors.jersey);
          } else if (Math.abs(child.position.y - 0.92) < 0.12) {
            // Shorts mesh (positioned around y = 0.92)
            child.material.color.setHex(squadMember.colors.shorts);
          }
        }
      });
    });
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
  }

  private draggedPlayer: PlayerCharacter | null = null;
  private isDraggingPlayer = false;
  private selectedPlayerId: string | null = null;
  private pendingPlacementRole: PlayerRole | null = null;
  private nextPlayerId = 1;
  private placementBoundaryMesh!: THREE.LineSegments;
  private dustPuffParticles: THREE.Points[] = [];

  // Tactical Deployment Zones Visualizer
  private activeZoneRole: PlayerRole | null = null;
  private tacticalZoneGroup!: THREE.Group;
  private zonePlaneMesh!: THREE.Mesh;
  private zoneOutlineMesh!: THREE.LineSegments;
  private zoneLabelMesh!: THREE.Mesh;
  private zoneLabelCanvas!: HTMLCanvasElement;
  private zoneLabelTex!: THREE.CanvasTexture;

  // Table collision lines/walls
  private walls: Array<{
    p1: THREE.Vector2;
    p2: THREE.Vector2;
    normal: THREE.Vector2;
    restitution: number;
  }> = [];

  // Goal & Score
  private stats: GameStats = {
    score: 0,
    goals: 0,
    playerGoals: 0,
    maxGoals: 5,
    scoreLimit: 10000,
    winner: null,
    shots: 0,
    saves: 0,
    combo: 1,
    highScore: 0,
    ballsLeft: 3,
    matchTime: 120, // 2 minutes max
    isGameOver: false,
    isPaused: false,
  };

  private callbacks: EngineCallbacks;
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private aimTarget = new THREE.Vector3(0, 0, -10.2); // Default aimed towards goal center

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e222b);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    // 3. Cameras
    const aspect = container.clientWidth / container.clientHeight;
    // Engine camera (dynamic 3D closer perspective)
    this.engineCamera = new THREE.PerspectiveCamera(48, aspect, 0.1, 100);
    this.engineCamera.position.set(0, 8.5, 9.2);
    this.engineCamera.lookAt(0, 0.5, -2.5);

    // Gameplay camera with calibrated angled stadium perspective so team goalie, flippers & players in action are in full view
    this.gameplayCamera = new THREE.PerspectiveCamera(44, aspect, 0.1, 100);
    this.updateCameraForAspect(aspect);

    // 4. Lights
    this.setupLighting();

    // 5. Construct Table & Entities
    this.createPitch();
    this.createWallsAndRails();
    this.createGoalAndCrowd();
    this.createPlacementBoundary();
    this.createTacticalZoneVisualizer();
    this.createFieldPlayers();
    this.createGoalkeeper();
    this.createFlippers();
    this.createBall();
    this.createBallTrail();
    this.createPenaltyVisuals();

    // 6. Listeners & Initial Render
    window.addEventListener('resize', this.onResize);
    this.setupPointerEvents();
    this.isBallInPlay = false;
    if (this.ballMesh) {
      this.ballMesh.visible = false;
    }
    this.stats.isPaused = true;

    // Render one initial static frame for the stadium backdrop
    this.renderViewports();

    // Auto-sync roster squad when changed in shop/transfers
    this.unsubscribeRoster = rosterManager.subscribe(() => {
      this.syncRosterSquad();
    });
  }

  // Calibrate camera perspective according to viewport aspect ratio and chosen game mode:
  // - When player chooses 'team', camera is on the goalie side (negative Z, looking downfield towards flippers)
  //   with the full goal post, crossbar, net, and goalkeeper clearly visible at the bottom of the screen!
  // - When player chooses 'pinball' or 'two_player' (including Tournaments), camera is on the flipper side
  //   (positive Z, looking upfield towards opponent goal) with full view of bottom flippers and arena!
  public updateCameraForAspect(aspect: number) {
    this.gameplayCamera.aspect = aspect;
    this.gameplayCamera.fov = 48;

    const isGoalieSide = this.gameMode === 'team';

    if (aspect < 0.75) {
      // Narrow portrait (mobile screens): pull camera back along Z to frame goal post with generous headroom
      const posY = isGoalieSide ? 24.5 : 23.5;
      const posZ = isGoalieSide ? -19.6 : 17.8;
      const targetZ = isGoalieSide ? -1.6 : 0.4;
      this.gameplayCamera.position.set(0, posY, posZ);
      this.gameplayCamera.lookAt(0, 0.4, targetZ);
    } else if (aspect < 1.0) {
      // Medium screens / tablets
      const posY = isGoalieSide ? 22.0 : 21.0;
      const posZ = isGoalieSide ? -18.2 : 16.8;
      const targetZ = isGoalieSide ? -1.4 : 0.6;
      this.gameplayCamera.position.set(0, posY, posZ);
      this.gameplayCamera.lookAt(0, 0.4, targetZ);
    } else {
      // Wide desktop: angled stadium perspective showing full goal post & net with plenty of breathing room
      const posY = isGoalieSide ? 20.5 : 19.5;
      const posZ = isGoalieSide ? -17.2 : 15.8;
      const targetZ = isGoalieSide ? -1.2 : 0.8;
      this.gameplayCamera.position.set(0, posY, posZ);
      this.gameplayCamera.lookAt(0, 0.4, targetZ);
    }
    this.gameplayCamera.updateProjectionMatrix();
    this.baseCameraPos.copy(this.gameplayCamera.position);
  }

  // ==========================================
  // LIGHTING
  // ==========================================
  private setupLighting() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    // Main Stadium Floodlight (Casting crisp shadows)
    const dirLight = new THREE.DirectionalLight(0xfff8ee, 1.25);
    dirLight.position.set(8, 22, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 45;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 16;
    dirLight.shadow.camera.bottom = -16;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Secondary fill light from opposite corner
    const fillLight = new THREE.DirectionalLight(0x90c5ff, 0.65);
    fillLight.position.set(-9, 15, -12);
    this.scene.add(fillLight);
  }

  // ==========================================
  // PITCH SURFACE & LINES
  // ==========================================
  private createPitch() {
    // High quality striped grass canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    // Grass stripes (vibrant soccer pitch green)
    const stripeCount = 18;
    const stripeHeight = canvas.height / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#2ec44a' : '#27b541';
      ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
    }

    // Grass subtle noise texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * canvas.width;
      const ry = Math.random() * canvas.height;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Pitch Lines (clean white marking)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    const padX = 50;
    const padY = 50;
    const w = canvas.width - padX * 2;
    const h = canvas.height - padY * 2;

    // Outer boundary
    ctx.strokeRect(padX, padY, w, h);

    // Halfway line
    const midY = canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(padX, midY);
    ctx.lineTo(canvas.width - padX, midY);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, midY, 190, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, midY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Top Penalty Area (around goal)
    const penW = w * 0.55;
    const penH = h * 0.22;
    ctx.strokeRect((canvas.width - penW) / 2, padY, penW, penH);

    // Goal Area (6-yard box)
    const sixW = penW * 0.55;
    const sixH = penH * 0.45;
    ctx.strokeRect((canvas.width - sixW) / 2, padY, sixW, sixH);

    // Penalty arc
    ctx.beginPath();
    ctx.arc(canvas.width / 2, padY + penH * 0.65, 80, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Bottom Penalty Area
    ctx.strokeRect((canvas.width - penW) / 2, canvas.height - padY - penH, penW, penH);
    ctx.strokeRect((canvas.width - sixW) / 2, canvas.height - padY - sixH, sixW, sixH);

    const pitchTexture = new THREE.CanvasTexture(canvas);
    pitchTexture.anisotropy = 8;

    // Geometry
    const pitchGeo = new THREE.PlaneGeometry(this.pitchWidth, this.pitchLength);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: pitchTexture,
      roughness: 0.8,
      metalness: 0.05,
    });
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.receiveShadow = true;
    this.scene.add(pitchMesh);

    // Center circle dynamic score display
    this.createCenterCircleScore();
  }

  // Create big glowing score in the center circle (0, 1, 2...)
  private createCenterCircleScore() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    this.centerCircleScoreTexture = new THREE.CanvasTexture(canvas);
    this.updateCenterCircleCanvas(0);

    const scoreGeo = new THREE.PlaneGeometry(2.4, 2.4);
    const scoreMat = new THREE.MeshBasicMaterial({
      map: this.centerCircleScoreTexture,
      transparent: true,
      depthWrite: false,
    });
    this.centerCircleScoreMesh = new THREE.Mesh(scoreGeo, scoreMat);
    this.centerCircleScoreMesh.rotation.x = -Math.PI / 2;
    this.centerCircleScoreMesh.position.set(0, 0.02, 0);
    this.scene.add(this.centerCircleScoreMesh);
  }

  private updateCenterCircleCanvas(goals: number) {
    const canvas = this.centerCircleScoreTexture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // High contrast stylized number matching video
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 150px "Chakra Petch", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${goals}`, canvas.width / 2, canvas.height / 2);

    this.centerCircleScoreTexture.needsUpdate = true;
  }

  // ==========================================
  // WALLS, GUIDE RAILS & PINBALL APERTURE
  // ==========================================
  private createWallsAndRails() {
    const wallHeight = 1.1;
    const wallThickness = 0.45;
    const wallColor = 0xf0f3f6;
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.35,
      metalness: 0.1,
    });

    const addWall = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      thickness = wallThickness,
      isAngledRail = false
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);

      const geo = new THREE.BoxGeometry(thickness, wallHeight, length);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set((x1 + x2) / 2, wallHeight / 2, (z1 + z2) / 2);
      mesh.rotation.y = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Add top decorative rail strip
      const railGeo = new THREE.CylinderGeometry(thickness * 0.6, thickness * 0.6, length, 12);
      const railMat = new THREE.MeshStandardMaterial({
        color: isAngledRail ? 0xffffff : 0xecf0f4,
        roughness: 0.2,
        metalness: 0.3,
      });
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.position.set((x1 + x2) / 2, wallHeight, (z1 + z2) / 2);
      railMesh.rotation.x = Math.PI / 2;
      railMesh.rotation.z = -angle;
      this.scene.add(railMesh);

      // Register collision line
      const normal = new THREE.Vector2(-(z2 - z1), x2 - x1).normalize();
      this.walls.push({
        p1: new THREE.Vector2(x1, z1),
        p2: new THREE.Vector2(x2, z2),
        normal,
        restitution: 0.97, // Air hockey rail bounce!
      });
    };

    const halfW = this.pitchWidth / 2;
    const halfL = this.pitchLength / 2;

    // Midfield Side Walls (running between top and bottom angled funnels)
    addWall(-halfW, -5.5, -halfW, 5.5);
    addWall(halfW, -5.5, halfW, 5.5);

    // ========================================================
    // TOP CORNERS & GUIDE RAILS (Player 2 Flipper Area)
    // Symmetrically matches bottom corners with diagonal guide rails
    // ========================================================
    // Top Angled Funnel Guide Rails (Funneling ball smoothly into top flippers)
    // Left top guide rail: from (-halfW, -5.5) to (-1.98, -8.80)
    addWall(-halfW, -5.5, -1.98, -8.80, 0.35, true);
    // Right top guide rail: from (halfW, -5.5) to (1.98, -8.80)
    addWall(halfW, -5.5, 1.98, -8.80, 0.35, true);

    // Top Outlane & Side Return Barriers
    addWall(-halfW, -5.5, -halfW, -halfL);
    addWall(halfW, -5.5, halfW, -halfL);
    addWall(-halfW, -halfL, -2.25, -halfL);
    addWall(2.25, -halfL, halfW, -halfL);

    // Top Flipper Base Return Guides: Guide ball from behind top flipper hubs into goal
    addWall(-1.98, -8.80, -2.25, -halfL, 0.3);
    addWall(1.98, -8.80, 2.25, -halfL, 0.3);

    // ========================================================
    // BOTTOM CORNERS & GUIDE RAILS (Player 1 Flipper Area)
    // ========================================================
    // Bottom Angled Funnel Guide Rails (Funneling ball smoothly into bottom flippers)
    // Left bottom guide rail: from (-halfW, 5.5) to (-1.98, 8.80)
    addWall(-halfW, 5.5, -1.98, 8.80, 0.35, true);
    // Right bottom guide rail: from (halfW, 5.5) to (1.98, 8.80)
    addWall(halfW, 5.5, 1.98, 8.80, 0.35, true);

    // Bottom Outlane & Side Return Barriers (Solid boundary preventing ball escaping outer field)
    addWall(-halfW, 5.5, -halfW, halfL);
    addWall(halfW, 5.5, halfW, halfL);
    addWall(-halfW, halfL, -2.25, halfL);
    addWall(2.25, halfL, halfW, halfL);

    // Flipper Base Return Guides: Guide the ball from behind flipper hubs into the drain without getting trapped
    addWall(-1.98, 8.80, -2.25, halfL, 0.3);
    addWall(1.98, 8.80, 2.25, halfL, 0.3);
  }

  // ==========================================
  // GOAL, NET & SPECTATOR PEGS
  // ==========================================
  private createGoalAndCrowd() {
    const goalWidth = 4.2;
    const goalHeight = 2.4;
    const goalDepth = 1.8;
    const goalZ = -10.5;

    const postMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.3,
    });
    const postRadius = 0.1;

    // Left post
    const leftPostGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16);
    const leftPost = new THREE.Mesh(leftPostGeo, postMat);
    leftPost.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
    leftPost.castShadow = true;
    this.scene.add(leftPost);

    // Right post
    const rightPost = leftPost.clone();
    rightPost.position.set(goalWidth / 2, goalHeight / 2, goalZ);
    this.scene.add(rightPost);

    // Crossbar
    const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 16);
    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, goalZ);
    crossbar.castShadow = true;
    this.scene.add(crossbar);

    // Goal Net (semi-transparent grid)
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xe6eef8,
      wireframe: true,
      roughness: 0.9,
      transparent: true,
      opacity: 0.55,
    });

    // Back net
    const backNetGeo = new THREE.PlaneGeometry(goalWidth, goalHeight, 12, 8);
    const backNet = new THREE.Mesh(backNetGeo, netMat);
    backNet.position.set(0, goalHeight / 2, goalZ - goalDepth);
    this.scene.add(backNet);

    // Top net
    const topNetGeo = new THREE.PlaneGeometry(goalWidth, goalDepth, 12, 6);
    const topNet = new THREE.Mesh(topNetGeo, netMat);
    topNet.rotation.x = Math.PI / 2;
    topNet.position.set(0, goalHeight, goalZ - goalDepth / 2);
    this.scene.add(topNet);

    // Side net left
    const sideNetGeo = new THREE.PlaneGeometry(goalDepth, goalHeight, 6, 8);
    const sideNetL = new THREE.Mesh(sideNetGeo, netMat);
    sideNetL.rotation.y = Math.PI / 2;
    sideNetL.position.set(-goalWidth / 2, goalHeight / 2, goalZ - goalDepth / 2);
    this.scene.add(sideNetL);

    // Side net right
    const sideNetR = sideNetL.clone();
    sideNetR.position.set(goalWidth / 2, goalHeight / 2, goalZ - goalDepth / 2);
    this.scene.add(sideNetR);

    // Bottom back net ground support pipe
    const backBarGeo = new THREE.CylinderGeometry(0.06, 0.06, goalWidth, 12);
    const backBar = new THREE.Mesh(backBarGeo, postMat);
    backBar.rotation.z = Math.PI / 2;
    backBar.position.set(0, 0.06, goalZ - goalDepth);
    this.scene.add(backBar);

    // Goal Back Wall (stops ball)
    this.walls.push({
      p1: new THREE.Vector2(-goalWidth / 2, goalZ - goalDepth),
      p2: new THREE.Vector2(goalWidth / 2, goalZ - goalDepth),
      normal: new THREE.Vector2(0, 1),
      restitution: 0.15,
    });
    // Goal Left Wall
    this.walls.push({
      p1: new THREE.Vector2(-goalWidth / 2, goalZ),
      p2: new THREE.Vector2(-goalWidth / 2, goalZ - goalDepth),
      normal: new THREE.Vector2(1, 0),
      restitution: 0.3,
    });
    // Goal Right Wall
    this.walls.push({
      p1: new THREE.Vector2(goalWidth / 2, goalZ - goalDepth),
      p2: new THREE.Vector2(goalWidth / 2, goalZ),
      normal: new THREE.Vector2(-1, 0),
      restitution: 0.3,
    });

    // Spectator rows behind goal (colorful pegs like in the video!)
    const crowdGroup = new THREE.Group();
    const colors = [0xf39c12, 0x3498db, 0xe74c3c, 0x2ecc71, 0x9b59b6, 0xf1c40f, 0x1abc9c];
    const pegGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.7, 12);
    const headGeo = new THREE.SphereGeometry(0.17, 12, 12);

    for (let row = 0; row < 3; row++) {
      const zPos = goalZ - goalDepth - 0.7 - row * 0.65;
      const yPos = 0.4 + row * 0.45;
      const cols = 22;
      for (let col = 0; col < cols; col++) {
        const xPos = -5.0 + (col / (cols - 1)) * 10.0 + (Math.random() * 0.1 - 0.05);
        const colColor = colors[(row * 7 + col) % colors.length];
        const bodyMat = new THREE.MeshStandardMaterial({ color: colColor, roughness: 0.4 });
        const body = new THREE.Mesh(pegGeo, bodyMat);
        body.position.set(xPos, yPos, zPos);
        body.castShadow = true;

        const headMat = new THREE.MeshStandardMaterial({ color: 0xffd2a0, roughness: 0.6 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(xPos, yPos + 0.48, zPos);
        crowdGroup.add(body);
        crowdGroup.add(head);
      }
    }
    this.scene.add(crowdGroup);

    // Bottom Drain Net (behind flippers - player scoring goal)
    const bottomGoalGeo = new THREE.BoxGeometry(4.4, 0.7, 1.4);
    const bottomGoalMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.5,
      wireframe: true,
    });
    const bottomGoal = new THREE.Mesh(bottomGoalGeo, bottomGoalMat);
    bottomGoal.position.set(0, 0.35, 11.2);
    this.scene.add(bottomGoal);

    // Goal posts marking the bottom goal aperture
    const bottomPostMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.4,
    });
    const bPostGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 16);
    const bPostL = new THREE.Mesh(bPostGeo, bottomPostMat);
    bPostL.position.set(-2.25, 0.4, 10.45);
    const bPostR = new THREE.Mesh(bPostGeo, bottomPostMat);
    bPostR.position.set(2.25, 0.4, 10.45);
    this.scene.add(bPostL, bPostR);
  }

  // ==========================================
  // TACTICAL PLACEMENT ZONE & BOUNDARIES
  // ==========================================
  private createPlacementBoundary() {
    const points: THREE.Vector3[] = [];
    const minX = -3.6;
    const maxX = 3.6;
    const minZ = -7.5;
    const maxZ = 5.5;

    // Outer tactical pitch boundary
    points.push(new THREE.Vector3(minX, 0.02, minZ), new THREE.Vector3(maxX, 0.02, minZ));
    points.push(new THREE.Vector3(maxX, 0.02, minZ), new THREE.Vector3(maxX, 0.02, maxZ));
    points.push(new THREE.Vector3(maxX, 0.02, maxZ), new THREE.Vector3(minX, 0.02, maxZ));
    points.push(new THREE.Vector3(minX, 0.02, maxZ), new THREE.Vector3(minX, 0.02, minZ));

    // Subtle tactical zone divider lines across pitch:
    // 1. Attack / Midfield boundary at Z = -1.0
    points.push(new THREE.Vector3(minX, 0.02, -1.0), new THREE.Vector3(maxX, 0.02, -1.0));
    // 2. Midfield / Defense boundary at Z = 2.4
    points.push(new THREE.Vector3(minX, 0.02, 2.4), new THREE.Vector3(maxX, 0.02, 2.4));

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.35,
      gapSize: 0.25,
      transparent: true,
      opacity: 0.3,
    });
    this.placementBoundaryMesh = new THREE.LineSegments(geo, mat);
    this.placementBoundaryMesh.computeLineDistances();
    this.scene.add(this.placementBoundaryMesh);
  }

  private createTacticalZoneVisualizer() {
    this.tacticalZoneGroup = new THREE.Group();
    this.tacticalZoneGroup.position.set(0, 0.025, 0);

    // 1. Glowing translucent plane
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.zonePlaneMesh = new THREE.Mesh(planeGeo, planeMat);
    this.zonePlaneMesh.rotation.x = -Math.PI / 2;
    this.tacticalZoneGroup.add(this.zonePlaneMesh);

    // 2. Highlight border
    const borderGeo = new THREE.BufferGeometry();
    const borderMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.4,
      gapSize: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    this.zoneOutlineMesh = new THREE.LineSegments(borderGeo, borderMat);
    this.tacticalZoneGroup.add(this.zoneOutlineMesh);

    // 3. Floating tactical banner label
    this.zoneLabelCanvas = document.createElement('canvas');
    this.zoneLabelCanvas.width = 512;
    this.zoneLabelCanvas.height = 80;
    this.zoneLabelTex = new THREE.CanvasTexture(this.zoneLabelCanvas);
    const labelGeo = new THREE.PlaneGeometry(3.6, 0.55);
    const labelMat = new THREE.MeshBasicMaterial({
      map: this.zoneLabelTex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.zoneLabelMesh = new THREE.Mesh(labelGeo, labelMat);
    this.zoneLabelMesh.rotation.x = -Math.PI / 2;
    this.zoneLabelMesh.position.y = 0.005;
    this.tacticalZoneGroup.add(this.zoneLabelMesh);

    this.tacticalZoneGroup.visible = false;
    this.scene.add(this.tacticalZoneGroup);
  }

  public showTacticalZone(role: PlayerRole) {
    this.activeZoneRole = role;
    const zone = ROLE_TACTICAL_ZONES[role];
    if (!zone || !this.tacticalZoneGroup) return;

    const width = zone.maxX - zone.minX;
    const length = zone.maxZ - zone.minZ;
    const centerX = (zone.minX + zone.maxX) / 2;
    const centerZ = (zone.minZ + zone.maxZ) / 2;

    // Update Plane
    this.zonePlaneMesh.scale.set(width, length, 1);
    this.zonePlaneMesh.position.set(centerX, 0, centerZ);
    (this.zonePlaneMesh.material as THREE.MeshBasicMaterial).color.setHex(zone.color);

    // Update Dashed Outline
    const p = [
      new THREE.Vector3(zone.minX, 0, zone.minZ),
      new THREE.Vector3(zone.maxX, 0, zone.minZ),
      new THREE.Vector3(zone.maxX, 0, zone.minZ),
      new THREE.Vector3(zone.maxX, 0, zone.maxZ),
      new THREE.Vector3(zone.maxX, 0, zone.maxZ),
      new THREE.Vector3(zone.minX, 0, zone.maxZ),
      new THREE.Vector3(zone.minX, 0, zone.maxZ),
      new THREE.Vector3(zone.minX, 0, zone.minZ),
    ];
    this.zoneOutlineMesh.geometry.dispose();
    this.zoneOutlineMesh.geometry = new THREE.BufferGeometry().setFromPoints(p);
    this.zoneOutlineMesh.computeLineDistances();
    (this.zoneOutlineMesh.material as THREE.LineDashedMaterial).color.setHex(zone.color);

    // Update Canvas Label
    const ctx = this.zoneLabelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 80);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(16, 10, 480, 60, 16);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = zone.hexColor;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${zone.badge} • ${zone.name.toUpperCase()}`, 256, 40);
    this.zoneLabelTex.needsUpdate = true;

    this.zoneLabelMesh.position.set(centerX, 0.005, centerZ);

    this.tacticalZoneGroup.visible = true;
    this.callbacks.onActiveRoleZoneChange?.(role);
  }

  public hideTacticalZone() {
    this.activeZoneRole = null;
    if (this.tacticalZoneGroup) {
      this.tacticalZoneGroup.visible = false;
    }
    this.callbacks.onActiveRoleZoneChange?.(null);
  }

  public isPositionValidForRole(
    role: PlayerRole,
    x: number,
    z: number,
    ignorePlayerId?: string
  ): { valid: boolean; reason?: 'zone' | 'clumping'; message?: string } {
    const zone = ROLE_TACTICAL_ZONES[role];
    if (!zone) return { valid: false, reason: 'zone', message: 'Unknown role' };

    // 1. Role-specific tactical zone check
    if (x < zone.minX || x > zone.maxX || z < zone.minZ || z > zone.maxZ) {
      return {
        valid: false,
        reason: 'zone',
        message: `${zone.badge} must be deployed inside the ${zone.name.toUpperCase()}!`,
      };
    }

    // 2. Anti-clamping spacing check (min 2.0m)
    for (const p of this.fieldPlayers) {
      if (ignorePlayerId && p.id === ignorePlayerId) continue;
      if (p.isDragging) continue;
      const d = Math.hypot(p.group.position.x - x, p.group.position.z - z);
      if (d < SoccerPinballEngine.MIN_PLAYER_SPACING) {
        return {
          valid: false,
          reason: 'clumping',
          message: `Too close to ${p.name.toUpperCase()}! Maintain 2m tactical spacing.`,
        };
      }
    }

    return { valid: true };
  }

  public findNearestValidSpotInZone(
    role: PlayerRole,
    preferredX: number,
    preferredZ: number,
    ignorePlayerId?: string
  ): { x: number; z: number } | null {
    const zone = ROLE_TACTICAL_ZONES[role];
    if (!zone) return null;

    const clampedPrefX = Math.max(zone.minX, Math.min(zone.maxX, preferredX));
    const clampedPrefZ = Math.max(zone.minZ, Math.min(zone.maxZ, preferredZ));

    const check = this.isPositionValidForRole(role, clampedPrefX, clampedPrefZ, ignorePlayerId);
    if (check.valid) {
      return { x: clampedPrefX, z: clampedPrefZ };
    }

    // Spiral search for open spot inside the role's zone
    for (let r = 0.8; r <= 4.5; r += 0.6) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        const testX = clampedPrefX + Math.cos(angle) * r;
        const testZ = clampedPrefZ + Math.sin(angle) * r;
        if (testX >= zone.minX && testX <= zone.maxX && testZ >= zone.minZ && testZ <= zone.maxZ) {
          const testCheck = this.isPositionValidForRole(role, testX, testZ, ignorePlayerId);
          if (testCheck.valid) {
            return { x: testX, z: testZ };
          }
        }
      }
    }

    // Fallback: candidate grid points within zone
    const xSteps = [0, -1.8, 1.8, -2.8, 2.8];
    const zCenter = (zone.minZ + zone.maxZ) / 2;
    const zSteps = [zCenter, zone.minZ + 0.5, zone.maxZ - 0.5];
    for (const testZ of zSteps) {
      for (const testX of xSteps) {
        if (testX >= zone.minX && testX <= zone.maxX) {
          const c = this.isPositionValidForRole(role, testX, testZ, ignorePlayerId);
          if (c.valid) {
            return { x: testX, z: testZ };
          }
        }
      }
    }

    return null;
  }

  public resolvePlayerClustering(): void {
    if (this.fieldPlayers.length < 2) return;

    for (let iter = 0; iter < 4; iter++) {
      let anyMoved = false;
      for (let i = 0; i < this.fieldPlayers.length; i++) {
        const pA = this.fieldPlayers[i];
        if (pA.isDragging) continue;
        const posA = pA.group.position;
        const zoneA = ROLE_TACTICAL_ZONES[pA.role];

        for (let j = i + 1; j < this.fieldPlayers.length; j++) {
          const pB = this.fieldPlayers[j];
          if (pB.isDragging) continue;
          const posB = pB.group.position;
          const zoneB = ROLE_TACTICAL_ZONES[pB.role];

          let dx = posA.x - posB.x;
          let dz = posA.z - posB.z;
          let dist = Math.hypot(dx, dz);

          if (dist < 0.001) {
            dx = (Math.random() - 0.5) * 0.2;
            dz = 0.2;
            dist = 0.2;
          }

          if (dist < SoccerPinballEngine.MIN_PLAYER_SPACING) {
            anyMoved = true;
            const overlap = (SoccerPinballEngine.MIN_PLAYER_SPACING - dist) * 0.55;
            const nx = dx / dist;
            const nz = dz / dist;

            // Push apart
            posA.x += nx * overlap;
            posA.z += nz * overlap;
            posB.x -= nx * overlap;
            posB.z -= nz * overlap;

            // Clamp both players inside their respective tactical zones
            if (zoneA) {
              posA.x = Math.max(zoneA.minX, Math.min(zoneA.maxX, posA.x));
              posA.z = Math.max(zoneA.minZ, Math.min(zoneA.maxZ, posA.z));
            }
            if (zoneB) {
              posB.x = Math.max(zoneB.minX, Math.min(zoneB.maxX, posB.x));
              posB.z = Math.max(zoneB.minZ, Math.min(zoneB.maxZ, posB.z));
            }

            pA.basePos.copy(posA);
            pB.basePos.copy(posB);
          }
        }
      }
      if (!anyMoved) break;
    }
  }

  // ==========================================
  // FIELD PLAYERS (KICKERS & STUN EFFECT)
  // ==========================================
  private createFieldPlayers() {
    this.clearAllPlayers();
    const classic = PRESET_FORMATIONS[0];
    classic.players.forEach((p) => {
      this.addPlayer(p.role, p.x, p.z, p.facingAngle);
    });
  }

  public getRoleCount(role: PlayerRole): number {
    return this.fieldPlayers.filter((p) => p.role === role).length;
  }

  public isRoleOnField(role: PlayerRole): boolean {
    return this.fieldPlayers.some((p) => p.role === role);
  }

  public canAddPlayer(role: PlayerRole): boolean {
    return (
      this.fieldPlayers.length < SoccerPinballEngine.MAX_FIELD_PLAYERS &&
      !this.isRoleOnField(role) &&
      !this.ejectedRoles.has(role)
    );
  }

  public addPlayer(
    role: PlayerRole = 'striker',
    x?: number,
    z?: number,
    facingAngle: number = 0
  ): boolean {
    // 0. Red card ejection check: ejected players cannot return (-1 player!)
    if (this.ejectedRoles.has(role)) {
      this.callbacks.onPlacementFeedback?.({
        message: `${role.toUpperCase()} was RED CARD EJECTED! Team is playing with -1 player.`,
        type: 'error',
      });
      return false;
    }

    // 1. Overall team cap: maximum 3 total players on the field!
    if (this.fieldPlayers.length >= SoccerPinballEngine.MAX_FIELD_PLAYERS) {
      this.callbacks.onPlacementFeedback?.({
        message: 'Squad limit reached! Maximum 3 players on pitch.',
        type: 'error',
      });
      return false;
    }

    // 2. Position exclusivity: if role is already on field, cannot place another
    if (this.isRoleOnField(role)) {
      this.callbacks.onPlacementFeedback?.({
        message: `${role.toUpperCase()} is already on the field!`,
        type: 'error',
      });
      return false;
    }

    const zone = ROLE_TACTICAL_ZONES[role];
    if (!zone) return false;

    let targetX = x;
    let targetZ = z;

    if (targetX === undefined || targetZ === undefined) {
      const spot = this.findNearestValidSpotInZone(role, 0, (zone.minZ + zone.maxZ) / 2);
      if (!spot) {
        this.callbacks.onPlacementFeedback?.({
          message: `No open space in ${zone.name}!`,
          type: 'error',
        });
        return false;
      }
      targetX = spot.x;
      targetZ = spot.z;
    } else {
      const check = this.isPositionValidForRole(role, targetX, targetZ);
      if (!check.valid) {
        const spot = this.findNearestValidSpotInZone(role, targetX, targetZ);
        if (spot) {
          targetX = spot.x;
          targetZ = spot.z;
          this.callbacks.onPlacementFeedback?.({
            message: `${zone.badge} deployed in ${zone.name}!`,
            type: 'warning',
          });
        } else {
          this.callbacks.onPlacementFeedback?.({
            message: check.message || `Cannot deploy ${role} here!`,
            type: 'error',
          });
          return false;
        }
      }
    }

    targetX = Math.max(zone.minX, Math.min(zone.maxX, targetX));
    targetZ = Math.max(zone.minZ, Math.min(zone.maxZ, targetZ));

    const id = `player_${this.nextPlayerId++}_${Date.now()}`;
    const player = this.buildPlayerMesh(role, id, facingAngle);

    player.group.position.set(targetX, 0, targetZ);
    player.basePos.set(targetX, 0, targetZ);
    player.group.rotation.y = facingAngle;

    this.scene.add(player.group);
    this.fieldPlayers.push(player);

    this.resolvePlayerClustering();
    this.updatePlayerTrajectory(player);
    this.createPlacementPuff(targetX, targetZ);
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());

    return true;
  }

  // ==========================================
  // 3D MASCOT GHOST DRAG & DROP
  // ==========================================
  public startGhostPlacement(role: PlayerRole, clientX: number, clientY: number): boolean {
    if (!this.canAddPlayer(role)) return false;
    this.cancelGhostPlacement();
    this.ghostRole = role;

    this.showTacticalZone(role);

    // Create a semi-transparent ghost preview
    const mascot = this.buildPlayerMesh(role, 'ghost_preview', 0);
    mascot.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => {
            m.transparent = true;
            m.opacity = 0.75;
          });
        } else if (obj.material) {
          obj.material = obj.material.clone();
          obj.material.transparent = true;
          obj.material.opacity = 0.75;
        }
      }
    });

    this.ghostGroup = mascot.group;
    this.scene.add(this.ghostGroup);

    this.updateGhostPlacement(clientX, clientY);
    return true;
  }

  public updateGhostPlacement(clientX: number, clientY: number): { valid: boolean; x: number; z: number } {
    if (!this.ghostGroup || !this.ghostRole) return { valid: false, x: 0, z: 0 };
    const hit = this.getRaycastIntersection(clientX, clientY);
    if (!hit.point) {
      this.ghostGroup.visible = false;
      return { valid: false, x: 0, z: 0 };
    }

    this.ghostGroup.visible = true;
    const role = this.ghostRole;
    const zone = ROLE_TACTICAL_ZONES[role];

    const check = this.isPositionValidForRole(role, hit.point.x, hit.point.z);

    const clampedX = Math.max(zone.minX, Math.min(zone.maxX, hit.point.x));
    const clampedZ = Math.max(zone.minZ, Math.min(zone.maxZ, hit.point.z));
    this.ghostGroup.position.set(clampedX, 0.25, clampedZ);

    // Dynamic ring color feedback: green if valid in zone, red if invalid
    this.ghostGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.RingGeometry) {
        if (obj.material instanceof THREE.MeshBasicMaterial) {
          obj.material.color.setHex(check.valid ? 0x00ff88 : 0xff2222);
          obj.material.opacity = check.valid ? 0.9 : 1.0;
        }
      }
    });

    return { valid: check.valid, x: clampedX, z: clampedZ };
  }

  public finishGhostPlacement(clientX: number, clientY: number): boolean {
    if (!this.ghostGroup || !this.ghostRole) {
      this.cancelGhostPlacement();
      return false;
    }
    const status = this.updateGhostPlacement(clientX, clientY);
    const role = this.ghostRole;
    this.cancelGhostPlacement();

    if (status.valid) {
      const ok = this.addPlayer(role, status.x, status.z);
      if (ok) {
        soundEffects.playPlayerPlace();
      }
      return ok;
    } else {
      soundEffects.playWallBounce(0.5);
      const zone = ROLE_TACTICAL_ZONES[role];
      this.callbacks.onPlacementFeedback?.({
        message: `${zone.badge} (${role.toUpperCase()}) CAN ONLY BE DEPLOYED IN ${zone.name.toUpperCase()}!`,
        type: 'error',
      });
      return false;
    }
  }

  public cancelGhostPlacement(): void {
    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }
    this.ghostRole = null;
    if (!this.pendingPlacementRole && !this.isDraggingPlayer && !this.selectedPlayerId) {
      this.hideTacticalZone();
    }
  }

  public removePlayer(id: string) {
    const idx = this.fieldPlayers.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const player = this.fieldPlayers[idx];
      this.scene.remove(player.group);
      this.fieldPlayers.splice(idx, 1);
      if (this.selectedPlayerId === id) {
        this.selectedPlayerId = null;
        this.callbacks.onPlayerSelected?.(null);
      }
      soundEffects.playWallBounce(0.5);
      this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
    }
  }

  public clearAllPlayers(resetEjections: boolean = true) {
    for (const player of this.fieldPlayers) {
      this.scene.remove(player.group);
    }
    this.fieldPlayers = [];
    this.selectedPlayerId = null;
    this.draggedPlayer = null;
    this.isDraggingPlayer = false;
    if (resetEjections) {
      this.ejectedRoles.clear();
      this.callbacks.onEjectedRolesChange?.([]);
    }
    this.callbacks.onPlayerSelected?.(null);
    this.callbacks.onPlayersChanged?.([]);
  }

  public resetDefaultFormation() {
    this.setFormation('classic');
  }

  public rearrangePlayersComputer() {
    // Computer selects next strategic formation and rearranges players with visual dust puffs
    const formationList = PRESET_FORMATIONS;
    this.lastAutoFormationIdx = (this.lastAutoFormationIdx + 1) % formationList.length;
    const formation = formationList[this.lastAutoFormationIdx];
    this.setFormation(formation.id);
  }

  public setGameMode(mode: GameMode) {
    const prevMode = this.gameMode;
    this.gameMode = mode;
    this.resetFlippers();
    this.lastPowerKickReady = false;
    this.callbacks.onPowerKickAvailabilityChange?.(false);

    if (mode === 'home') {
      this.isBallInPlay = false;
      this.ballVel.set(0, 0, 0);
      if (this.ballMesh) {
        this.ballMesh.visible = false;
      }
      this.stats.isPaused = true;
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.renderViewports();
      return;
    }

    // Active gameplay mode ('pinball' | 'team')
    if (this.ballMesh) {
      this.ballMesh.visible = true;
    }
    this.stats.isPaused = false;

    if (mode === 'pinball') {
      this.selectPlayer(null);
      this.setPendingPlacementRole(null);
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'crosshair';
      }
    } else if (mode === 'two_player') {
      this.selectPlayer(null);
      this.setPendingPlacementRole(null);
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'grab';
      }
    } else {
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'default';
      }
    }

    if (mode === 'two_player') {
      this.isTwoPlayerSetupPhase = true;
      this.isP1LockedIn = false;
      this.isP2LockedIn = this.isP2Cpu;
      this.twoPlayerCountdown = null;
      if (this.twoPlayerCountdownInterval) {
        clearInterval(this.twoPlayerCountdownInterval);
        this.twoPlayerCountdownInterval = null;
      }

      if (this.keeperGroup) this.keeperGroup.visible = false;
      if (this.topFlipperLeft) this.topFlipperLeft.group.visible = true;
      if (this.topFlipperRight) this.topFlipperRight.group.visible = true;

      this.stats.score = 0;
      this.stats.goals = 0;
      this.stats.playerGoals = 0;
      this.stats.isGameOver = false;
      this.stats.winner = null;

      this.ballPos.set(0, 0.38, 0);
      this.ballVel.set(0, 0, 0);
      this.isBallInPlay = false;
      if (this.ballMesh) {
        this.ballMesh.position.set(0, 0.38, 0);
        this.ballMesh.visible = true;
      }

      this.spawnInitialTwoPlayerTeams();
      this.notifyTwoPlayerPhase();
    } else {
      this.isTwoPlayerSetupPhase = false;
      if (this.keeperGroup) this.keeperGroup.visible = true;
      if (this.topFlipperLeft) this.topFlipperLeft.group.visible = false;
      if (this.topFlipperRight) this.topFlipperRight.group.visible = false;
    }

    if (this.container) {
      this.updateCameraForAspect(this.container.clientWidth / this.container.clientHeight);
    }

    // Starting fresh game from home screen
    if (prevMode === 'home') {
      this.restartGame();
      if (this.animationFrameId === null) {
        this.lastTime = performance.now();
        this.animate();
      }
    }
  }

  public spawnInitialTwoPlayerTeams() {
    this.clearAllPlayers();
    this.setTwoPlayerPreset('p1', 'triangle', true);
    if (this.isP2Cpu) {
      this.autoPlaceCpuTeam();
    } else {
      this.setTwoPlayerPreset('p2', 'triangle', true);
    }
  }

  /**
   * Intelligently arranges the CPU team players on the pitch based on difficulty and tactical formation.
   * Places players to strategically block angles, cover flanks, and launch counter-attacks toward the player.
   */
  public autoPlaceCpuTeam() {
    const team: 'p1' | 'p2' = 'p2';
    // Remove existing players of P2
    const toRemove = this.fieldPlayers.filter(
      (p) => p.team === team || p.basePos.z < 0
    );
    toRemove.forEach((p) => {
      this.scene.remove(p.group);
    });
    this.fieldPlayers = this.fieldPlayers.filter((p) => !toRemove.includes(p));

    const facingAngle = Math.PI; // Facing downwards toward P1

    let coords: Array<{ role: PlayerRole; x: number; z: number }>;

    // Select intelligent layout based on difficulty / country tactical style
    if (this.p2CpuDifficulty === 'hard') {
      // Hard (e.g. World Cup Final Argentina/Germany):
      // 1 Midfield interceptor centrally, 1 aggressive flank striker, 1 deep bumper defender
      coords = [
        { role: 'striker', x: -1.6, z: -3.2 },
        { role: 'midfielder', x: 1.5, z: -4.4 },
        { role: 'defender', x: 0.0, z: -5.6 },
      ];
    } else if (this.p2CpuDifficulty === 'medium') {
      // Medium (Semi-finals):
      // Split Duo covering both lateral lanes to deny easy straight shots
      const flankVariation = Math.random() < 0.5;
      coords = flankVariation
        ? [
            { role: 'midfielder', x: -1.7, z: -4.2 },
            { role: 'striker', x: 1.7, z: -3.6 },
          ]
        : [
            { role: 'striker', x: -1.8, z: -3.6 },
            { role: 'defender', x: 1.2, z: -5.2 },
          ];
    } else {
      // Easy (Quarter-finals):
      // Balanced tandem with slight offset
      coords = [
        { role: 'striker', x: 0.2, z: -3.2 },
        { role: 'defender', x: -0.6, z: -5.4 },
      ];
    }

    coords.forEach((c) => {
      const id = `p_${team}_${c.role}_${Date.now()}_${Math.random()}`;
      const player = this.buildPlayerMesh(c.role, id, facingAngle, team);
      player.group.position.set(c.x, 0, c.z);
      player.basePos.set(c.x, 0, c.z);
      player.group.rotation.y = facingAngle;
      this.scene.add(player.group);
      this.fieldPlayers.push(player);
      this.updatePlayerTrajectory(player);
      this.createPlacementPuff(c.x, c.z);
    });

    soundEffects.playPlayerPlace();
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
  }

  public setTwoPlayerPreset(team: 'p1' | 'p2', preset: 'triangle' | 'wall' | 'spread', fromInternal: boolean = false) {
    if (this.isP2Cpu && team === 'p2' && !fromInternal) return;
    // Remove existing players of this team
    const toRemove = this.fieldPlayers.filter(
      (p) => p.team === team || (team === 'p1' ? p.basePos.z > 0 : p.basePos.z < 0)
    );
    toRemove.forEach((p) => {
      this.scene.remove(p.group);
    });
    this.fieldPlayers = this.fieldPlayers.filter((p) => !toRemove.includes(p));

    const facingAngle = team === 'p1' ? 0 : Math.PI;
    const sign = team === 'p1' ? 1 : -1;

    let coords: Array<{ role: PlayerRole; x: number; z: number }>;
    if (preset === 'triangle') {
      // Tandem: 1 Forward Striker, 1 Deep Guard (clean 2-player field)
      coords = [
        { role: 'striker', x: 0, z: sign * 2.8 },
        { role: 'defender', x: 0, z: sign * 5.4 },
      ];
    } else if (preset === 'wall') {
      // Split Duo: 2 players covering left and right flanks
      coords = [
        { role: 'midfielder', x: -1.8, z: sign * 4.2 },
        { role: 'striker', x: 1.8, z: sign * 4.2 },
      ];
    } else {
      // Staggered Flanks: 1 high flanker, 1 deep power bumper
      coords = [
        { role: 'striker', x: -2.0, z: sign * 3.2 },
        { role: 'cannon', x: 2.0, z: sign * 5.2 },
      ];
    }

    coords.forEach((c) => {
      const id = `p_${team}_${c.role}_${Date.now()}_${Math.random()}`;
      const player = this.buildPlayerMesh(c.role, id, facingAngle, team);
      player.group.position.set(c.x, 0, c.z);
      player.basePos.set(c.x, 0, c.z);
      player.group.rotation.y = facingAngle;
      this.scene.add(player.group);
      this.fieldPlayers.push(player);
      this.updatePlayerTrajectory(player);
      this.createPlacementPuff(c.x, c.z);
    });

    soundEffects.playPlayerPlace();
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
  }

  public toggleTwoPlayerLock(team: 'p1' | 'p2') {
    if (team === 'p1') {
      this.isP1LockedIn = !this.isP1LockedIn;
      if (this.isP2Cpu) {
        this.isP2LockedIn = true;
      }
    } else {
      if (this.isP2Cpu) {
        this.isP2LockedIn = true;
      } else {
        this.isP2LockedIn = !this.isP2LockedIn;
      }
    }
    soundEffects.playFlipper();
    this.notifyTwoPlayerPhase();

    if (this.isP1LockedIn && this.isP2LockedIn) {
      this.startTwoPlayerCountdown();
    } else if (this.twoPlayerCountdownInterval) {
      clearInterval(this.twoPlayerCountdownInterval);
      this.twoPlayerCountdownInterval = null;
      this.twoPlayerCountdown = null;
      this.notifyTwoPlayerPhase();
    }
  }

  public quickStartTwoPlayer() {
    this.isP1LockedIn = true;
    this.isP2LockedIn = true;
    this.notifyTwoPlayerPhase();
    this.startTwoPlayerCountdown();
  }

  private startTwoPlayerCountdown() {
    if (this.twoPlayerCountdownInterval) {
      clearInterval(this.twoPlayerCountdownInterval);
    }
    this.twoPlayerCountdown = 3;
    this.notifyTwoPlayerPhase();
    soundEffects.playWhistle();

    this.twoPlayerCountdownInterval = setInterval(() => {
      if (this.twoPlayerCountdown === null) {
        clearInterval(this.twoPlayerCountdownInterval!);
        this.twoPlayerCountdownInterval = null;
        return;
      }
      this.twoPlayerCountdown -= 1;
      if (this.twoPlayerCountdown > 0) {
        soundEffects.playWallBounce(0.9);
        this.notifyTwoPlayerPhase();
      } else {
        clearInterval(this.twoPlayerCountdownInterval!);
        this.twoPlayerCountdownInterval = null;
        this.twoPlayerCountdown = null;
        this.isTwoPlayerSetupPhase = false;
        this.notifyTwoPlayerPhase();
        this.startTwoPlayerKickoff();
      }
    }, 1000);
  }

  public startTwoPlayerKickoff(towardsTeam?: 'p1' | 'p2') {
    this.ballPos.set(0, 0.38, 0);
    const targetZ =
      towardsTeam === 'p1'
        ? 14.5
        : towardsTeam === 'p2'
        ? -14.5
        : Math.random() > 0.5
        ? 14.5
        : -14.5;
    const targetX = (Math.random() - 0.5) * 8.0;
    this.ballVel.set(targetX, 0, targetZ);
    this.ballSpin = (Math.random() - 0.5) * 14.0;
    this.isBallInPlay = true;
    if (this.ballMesh) this.ballMesh.visible = true;
    soundEffects.playWhistle();
    soundEffects.playKick(1.8);
    this.createPlacementPuff(0, 0);
  }

  public handleTwoPlayerGoal(scorer: 'p1' | 'p2') {
    if (!this.isBallInPlay) return;
    this.isBallInPlay = false;

    if (scorer === 'p1') {
      this.stats.goals += 1;
      this.addScore(1000);
      if (this.wasLastShotBank) {
        this.stats.bankShots = (this.stats.bankShots || 0) + 1;
        this.stats.score += 500;
        this.callbacks.onPlacementFeedback?.({
          message: '🎯 BANK SHOT GOAL! +500 PTS!',
          type: 'success',
        });
      }
      soundEffects.playGoal();
    } else {
      this.stats.playerGoals += 1;
      soundEffects.playGoal();
    }
    this.wasLastShotBank = false;

    this.triggerCameraShake(0.75);
    this.triggerSlowMotion(0.25, 0.35);

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.5 },
      colors: scorer === 'p1' ? ['#0984e3', '#00d2ff', '#ffffff'] : ['#e74c3c', '#ff4757', '#ffffff'],
    });

    this.callbacks.onScoreUpdate(this.stats);
    this.callbacks.onGoal(scorer === 'p1' ? 'pinball' : 'players', this.stats);

    if (this.stats.goals >= this.stats.maxGoals || this.stats.playerGoals >= this.stats.maxGoals) {
      this.stats.isGameOver = true;
      this.stats.winner = this.stats.goals >= this.stats.maxGoals ? 'pinball' : 'players';
      this.callbacks.onScoreUpdate(this.stats);
      return;
    }

    // Kickoff served toward player who just conceded
    setTimeout(() => {
      if (this.gameMode === 'two_player' && !this.stats.isGameOver && !this.stats.isPaused) {
        this.startTwoPlayerKickoff(scorer === 'p1' ? 'p2' : 'p1');
      }
    }, 1800);
  }

  private notifyTwoPlayerPhase() {
    this.callbacks.onTwoPlayerPhaseChange?.({
      isSetup: this.isTwoPlayerSetupPhase,
      p1Locked: this.isP1LockedIn,
      p2Locked: this.isP2LockedIn,
      countdown: this.twoPlayerCountdown,
    });
  }

  public togglePause(): boolean {
    this.stats.isPaused = !this.stats.isPaused;
    this.callbacks.onScoreUpdate(this.stats);
    return this.stats.isPaused;
  }

  public setPaused(paused: boolean) {
    this.stats.isPaused = paused;
    this.callbacks.onScoreUpdate(this.stats);
  }

  public isPaused(): boolean {
    return this.stats.isPaused;
  }

  public setFormation(formationId: string) {
    const formation = PRESET_FORMATIONS.find((f) => f.id === formationId) || PRESET_FORMATIONS[0];
    this.clearAllPlayers();

    formation.players.forEach((p) => {
      this.addPlayer(p.role, p.x, p.z, p.facingAngle);
    });

    soundEffects.playPlayerPlace();
  }

  public rotatePlayer(id: string, deltaRad: number) {
    const player = this.fieldPlayers.find((p) => p.id === id);
    if (!player) return;

    player.facingAngle += deltaRad;
    player.group.rotation.y = player.facingAngle;
    this.updatePlayerTrajectory(player);
    soundEffects.playRotate();
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
  }

  public setPlayerAngle(id: string, angleRad: number) {
    const player = this.fieldPlayers.find((p) => p.id === id);
    if (!player) return;

    player.facingAngle = angleRad;
    player.group.rotation.y = angleRad;
    this.updatePlayerTrajectory(player);
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
  }

  public selectPlayer(id: string | null) {
    this.selectedPlayerId = id;
    for (const p of this.fieldPlayers) {
      this.updatePlayerRingColor(p);
    }
    const sel = this.fieldPlayers.find((p) => p.id === id);
    this.callbacks.onPlayerSelected?.(sel ? this.getPlayerConfig(sel) : null);
    if (sel) {
      this.showTacticalZone(sel.role);
    } else if (!this.pendingPlacementRole && !this.isDraggingPlayer && !this.ghostRole) {
      this.hideTacticalZone();
    }
  }

  public getSelectedPlayerId(): string | null {
    return this.selectedPlayerId;
  }

  public setPendingPlacementRole(role: PlayerRole | null) {
    this.pendingPlacementRole = role;
    if (this.renderer?.domElement) {
      this.renderer.domElement.style.cursor = role ? 'copy' : 'crosshair';
    }
    if (role) {
      this.showTacticalZone(role);
    } else if (!this.selectedPlayerId && !this.isDraggingPlayer && !this.ghostRole) {
      this.hideTacticalZone();
    }
  }

  public getFieldPlayerConfigs(): FieldPlayerConfig[] {
    return this.fieldPlayers.map((p) => this.getPlayerConfig(p));
  }

  private getPlayerConfig(p: PlayerCharacter): FieldPlayerConfig {
    return {
      id: p.id,
      name: p.name,
      x: p.group.position.x,
      z: p.group.position.z,
      role: p.role,
      facingAngle: p.facingAngle,
      knockoutCount: p.knockoutCount,
      hasYellowCard: p.hasYellowCard,
      isEjected: p.isEjected,
    };
  }

  private updatePlayerRingColor(player: PlayerCharacter) {
    const isSelected = player.id === this.selectedPlayerId;
    if (isSelected) {
      player.ringMat.color.setHex(0xffe600); // Gold for selected
      player.ringMat.opacity = 1.0;
    } else {
      // Role default color
      switch (player.role) {
        case 'striker':
          player.ringMat.color.setHex(0xff4757);
          break;
        case 'midfielder':
          player.ringMat.color.setHex(0x00d2ff);
          break;
        case 'defender':
          player.ringMat.color.setHex(0x2ed573);
          break;
        case 'cannon':
          player.ringMat.color.setHex(0xffa502);
          break;
      }
      player.ringMat.opacity = 0.75;
    }
  }

  private updatePlayerTrajectory(player: PlayerCharacter) {
    // Project line along current facing angle
    const dist = player.role === 'striker' ? 8.0 : player.role === 'cannon' ? 9.5 : 6.0;
    const endZ = -dist;
    const positions = player.aimLine.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(1, 0, 0.05, endZ);
    positions.needsUpdate = true;
    player.aimLine.computeLineDistances();
  }

  private drawCanvasCountryFlag(
    ctx: CanvasRenderingContext2D,
    countryName: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const c = countryName.toLowerCase();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 2);
    ctx.clip();

    if (c.includes('japan')) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#bc002d';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.includes('germany')) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, w, h / 3);
      ctx.fillStyle = '#dd0000';
      ctx.fillRect(x, y + h / 3, w, h / 3);
      ctx.fillStyle = '#ffce00';
      ctx.fillRect(x, y + (h * 2) / 3, w, h / 3);
    } else if (c.includes('spain')) {
      ctx.fillStyle = '#aa151b';
      ctx.fillRect(x, y, w, h * 0.25);
      ctx.fillStyle = '#f1bf00';
      ctx.fillRect(x, y + h * 0.25, w, h * 0.5);
      ctx.fillStyle = '#aa151b';
      ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
    } else if (c.includes('brazil')) {
      ctx.fillStyle = '#009739';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fedf00';
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 1);
      ctx.lineTo(x + w - 2, y + h / 2);
      ctx.lineTo(x + w / 2, y + h - 1);
      ctx.lineTo(x + 2, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#012169';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.includes('england')) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#ce1124';
      ctx.fillRect(x, y + h * 0.38, w, h * 0.24);
      ctx.fillRect(x + w * 0.38, y, w * 0.24, h);
    } else if (c.includes('netherland')) {
      ctx.fillStyle = '#ae1c28';
      ctx.fillRect(x, y, w, h / 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y + h / 3, w, h / 3);
      ctx.fillStyle = '#21468b';
      ctx.fillRect(x, y + (h * 2) / 3, w, h / 3);
    } else if (c.includes('argentina')) {
      ctx.fillStyle = '#74acdf';
      ctx.fillRect(x, y, w, h / 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y + h / 3, w, h / 3);
      ctx.fillStyle = '#74acdf';
      ctx.fillRect(x, y + (h * 2) / 3, w, h / 3);
      ctx.fillStyle = '#f6b40e';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.includes('france')) {
      ctx.fillStyle = '#002654';
      ctx.fillRect(x, y, w / 3, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + w / 3, y, w / 3, h);
      ctx.fillStyle = '#ce1126';
      ctx.fillRect(x + (w * 2) / 3, y, w / 3, h);
    } else {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  private buildPlayerMesh(role: PlayerRole, id: string, facingAngle: number = 0, team?: 'p1' | 'p2'): PlayerCharacter {
    const group = new THREE.Group();

    // Palette per role & team
    let jerseyColor = 0xd63031; // Crimson Striker
    let shortsColor = 0x2d3436;
    let ringColor = 0xff4757;
    let roleLabel = 'STRIKER';

    const squadIdx = role === 'striker' ? 0 : (role === 'midfielder' || role === 'cannon') ? 1 : 2;
    const squadMember = this.customSquadPlayers[squadIdx];

    if (team === 'p2') {
      if (this.isP2Cpu && this.p2CountryName) {
        jerseyColor = this.p2JerseyColor;
        shortsColor = this.p2ShortsColor;
        ringColor = 0xff4757;
        roleLabel = this.p2CountryName.toUpperCase();
      } else {
        jerseyColor = role === 'striker' ? 0xe74c3c : role === 'midfielder' ? 0xff6b81 : role === 'defender' ? 0xc0392b : 0xe67e22;
        shortsColor = 0x2d3436;
        ringColor = 0xff4757;
        roleLabel = `P2 ${role.toUpperCase()}`;
      }
    } else if (squadMember) {
      jerseyColor = squadMember.colors.jersey;
      shortsColor = squadMember.colors.shorts;
      ringColor = 0x00d2ff;
      roleLabel = squadMember.name.toUpperCase();
    } else if (team === 'p1') {
      jerseyColor = role === 'striker' ? 0x0984e3 : role === 'midfielder' ? 0x00cec9 : role === 'defender' ? 0x2980b9 : 0xf39c12;
      shortsColor = 0xf1f2f6;
      ringColor = 0x00d2ff;
      roleLabel = `P1 ${role.toUpperCase()}`;
    } else if (role === 'midfielder') {
      jerseyColor = 0x0984e3; // Azure Blue Midfielder
      shortsColor = 0xf1f2f6;
      ringColor = 0x00d2ff;
      roleLabel = 'MIDFIELDER';
    } else if (role === 'defender') {
      jerseyColor = 0x00b894; // Emerald Green Defender
      shortsColor = 0x2f3542;
      ringColor = 0x2ed573;
      roleLabel = 'DEFENDER';
    } else if (role === 'cannon') {
      jerseyColor = 0xf39c12; // Gold Amber Cannon
      shortsColor = 0x1e272e;
      ringColor = 0xffa502;
      roleLabel = 'CANNON';
    }

    const jerseyMat = new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.6 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdca07e, roughness: 0.5 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1917, roughness: 0.8 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.32);
    const torso = new THREE.Mesh(torsoGeo, jerseyMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    group.add(torso);

    // Number patch on chest
    const numberCanvas = document.createElement('canvas');
    numberCanvas.width = 64;
    numberCanvas.height = 64;
    const nCtx = numberCanvas.getContext('2d')!;
    nCtx.fillStyle = '#ffffff';
    nCtx.font = 'bold 36px sans-serif';
    nCtx.textAlign = 'center';
    nCtx.textBaseline = 'middle';
    const numChar = role === 'striker' ? '9' : role === 'midfielder' ? '10' : role === 'defender' ? '4' : '★';
    nCtx.fillText(numChar, 32, 32);
    const numTex = new THREE.CanvasTexture(numberCanvas);
    const numBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshBasicMaterial({ map: numTex, transparent: true })
    );
    numBadge.position.set(0, 1.45, 0.17);
    group.add(numBadge);

    // Shorts / Pelvis
    const pelvisGeo = new THREE.BoxGeometry(0.52, 0.35, 0.3);
    const pelvis = new THREE.Mesh(pelvisGeo, shortsMat);
    pelvis.position.y = 0.92;
    pelvis.castShadow = true;
    group.add(pelvis);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.38, 0.35);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.95;
    head.castShadow = true;
    group.add(head);

    // Hair
    const hairGeo = new THREE.BoxGeometry(0.37, 0.16, 0.37);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 2.15;
    group.add(hair);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.16);
    const armLeft = new THREE.Mesh(armGeo, jerseyMat);
    armLeft.position.set(-0.36, 1.32, 0);
    armLeft.castShadow = true;
    group.add(armLeft);

    const armRight = armLeft.clone();
    armRight.position.set(0.36, 1.32, 0);
    group.add(armRight);

    // Left Leg
    const legLeftGroup = new THREE.Group();
    legLeftGroup.position.set(-0.16, 0.75, 0);

    const legUpperGeo = new THREE.BoxGeometry(0.18, 0.45, 0.18);
    const legUpperLeft = new THREE.Mesh(legUpperGeo, skinMat);
    legUpperLeft.position.y = -0.22;
    legUpperLeft.castShadow = true;
    legLeftGroup.add(legUpperLeft);

    const bootGeo = new THREE.BoxGeometry(0.2, 0.16, 0.32);
    const bootLeft = new THREE.Mesh(bootGeo, bootMat);
    bootLeft.position.set(0, -0.48, 0.05);
    bootLeft.castShadow = true;
    legLeftGroup.add(bootLeft);
    group.add(legLeftGroup);

    // Right Leg (The kicking leg!)
    const legRightGroup = new THREE.Group();
    legRightGroup.position.set(0.16, 0.75, 0);

    const legUpperRight = new THREE.Mesh(legUpperGeo, skinMat);
    legUpperRight.position.y = -0.22;
    legUpperRight.castShadow = true;
    legRightGroup.add(legUpperRight);

    const bootRight = new THREE.Mesh(bootGeo, bootMat);
    bootRight.position.set(0, -0.48, 0.05);
    bootRight.castShadow = true;
    legRightGroup.add(bootRight);
    group.add(legRightGroup);

    // Target Selection Ring on grass
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const targetRing = new THREE.Mesh(ringGeo, ringMat);
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.y = 0.03;
    group.add(targetRing);

    // Aim Trajectory Line (dashed line pointing forward)
    const lineGeo = new THREE.BufferGeometry();
    const linePoints = [new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 0.05, -7.0)];
    lineGeo.setFromPoints(linePoints);
    const lineMat = new THREE.LineDashedMaterial({
      color: ringColor,
      dashSize: 0.3,
      gapSize: 0.2,
      linewidth: 3,
      transparent: true,
      opacity: 0.85,
    });
    const aimLine = new THREE.Line(lineGeo, lineMat);
    aimLine.computeLineDistances();
    group.add(aimLine);

    // Role Badge floating icon above head
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 144;
    badgeCanvas.height = 40;
    const bCtx = badgeCanvas.getContext('2d')!;
    bCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    bCtx.roundRect(4, 4, 136, 32, 8);
    bCtx.fill();
    bCtx.strokeStyle = '#' + ringColor.toString(16).padStart(6, '0');
    bCtx.lineWidth = 2;
    bCtx.stroke();

    if (team === 'p2' && this.isP2Cpu && this.p2CountryName) {
      this.drawCanvasCountryFlag(bCtx, this.p2CountryName, 12, 13, 22, 14);
      bCtx.fillStyle = '#ffffff';
      bCtx.font = 'bold 13px sans-serif';
      bCtx.textAlign = 'left';
      bCtx.textBaseline = 'middle';
      bCtx.fillText(roleLabel, 40, 20);
    } else {
      bCtx.fillStyle = '#ffffff';
      bCtx.font = 'bold 15px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText(roleLabel, 72, 20);
    }

    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const roleBadgeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.25),
      new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true, side: THREE.DoubleSide })
    );
    roleBadgeMesh.position.set(0, 2.45, 0);
    group.add(roleBadgeMesh);

    // Stunned Stars Group
    const stunStars = new THREE.Group();
    stunStars.position.set(0, 2.6, 0);
    stunStars.visible = false;
    for (let i = 0; i < 3; i++) {
      const starGeo = new THREE.OctahedronGeometry(0.12, 0);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffe100 });
      const star = new THREE.Mesh(starGeo, starMat);
      const ang = (i * Math.PI * 2) / 3;
      star.position.set(Math.cos(ang) * 0.45, 0, Math.sin(ang) * 0.45);
      stunStars.add(star);
    }
    group.add(stunStars);

    return {
      id,
      name: roleLabel,
      group,
      basePos: new THREE.Vector3(),
      legRight: legRightGroup,
      legLeft: legLeftGroup,
      head,
      targetRing,
      ringMat,
      aimLine,
      roleBadgeMesh,
      isKicking: false,
      kickTimer: 0,
      isStunned: false,
      stunTimer: 0,
      stunStars,
      role,
      facingAngle,
      knockoutCount: 0,
      hasYellowCard: false,
      isEjected: false,
      team,
      profile: squadMember && team !== 'p2' ? {
        id: squadMember.id,
        name: squadMember.name,
        rarity: squadMember.rarity,
        iq: squadMember.stats.iq,
        shotAccuracy: squadMember.stats.iq,
        passSpeed: squadMember.stats.power,
        power: squadMember.stats.power,
        speed: squadMember.stats.speed,
        hitbox: squadMember.stats.hitbox,
        perkTitle: squadMember.perkTitle,
        specialTrait: squadMember.stats.iq >= 90 ? 'bank_master' : 'sniper',
      } : {
        id: `profile_${id}`,
        name: roleLabel,
        iq: role === 'midfielder' ? 94 : role === 'striker' ? 90 : role === 'cannon' ? 92 : 86,
        shotAccuracy: role === 'cannon' ? 96 : role === 'striker' ? 92 : 84,
        passSpeed: role === 'cannon' ? 28 : role === 'striker' ? 25 : 21,
        power: role === 'cannon' ? 95 : role === 'striker' ? 90 : 82,
        speed: 85,
        hitbox: role === 'defender' ? 95 : 82,
        specialTrait: role === 'midfielder' ? 'tiki_taka' : role === 'defender' ? 'bank_master' : 'sniper',
      },
    };
  }

  // 3D Visual Cards (Yellow Card / Red Card)
  private create3DCardMesh(colorHex: number): THREE.Mesh {
    const geom = new THREE.BoxGeometry(0.18, 0.28, 0.03);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.25,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    return mesh;
  }

  private attachCardToPlayer(player: PlayerCharacter, cardType: 'yellow' | 'red') {
    if (player.cardMesh) {
      player.group.remove(player.cardMesh);
      player.cardMesh = undefined;
    }
    const card = this.create3DCardMesh(cardType === 'yellow' ? 0xffcc00 : 0xee2222);
    card.position.set(0.38, 2.3, 0);
    card.rotation.z = -0.15;
    player.group.add(card);
    player.cardMesh = card;
  }

  public ejectPlayer(player: PlayerCharacter) {
    player.isEjected = true;
    this.ejectedRoles.add(player.role);

    // Red puff explosion on pitch
    this.createPlacementPuff(player.group.position.x, player.group.position.z, 0xff2222);
    soundEffects.playWhistle();
    soundEffects.playStunned();

    // Remove 3D group from scene
    this.scene.remove(player.group);

    // Remove from active fieldPlayers
    this.fieldPlayers = this.fieldPlayers.filter((p) => p.id !== player.id);

    if (this.selectedPlayerId === player.id) {
      this.selectPlayer(null);
    }

    // Notify UI that squad is down a player
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
    this.callbacks.onEjectedRolesChange?.(Array.from(this.ejectedRoles));
  }

  // ==========================================
  // GOALKEEPER (DYNAMIC SAVES & DIVING)
  // ==========================================
  private createGoalkeeper() {
    this.keeperGroup = new THREE.Group();

    const jerseyMat = new THREE.MeshStandardMaterial({ color: 0x00b894, roughness: 0.5 }); // Cyan-Green
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd2a0, roughness: 0.5 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); // White goalie gloves

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.65, 0.8, 0.35);
    const torso = new THREE.Mesh(torsoGeo, jerseyMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    this.keeperGroup.add(torso);

    // Pelvis
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.32), shortsMat);
    pelvis.position.y = 0.95;
    this.keeperGroup.add(pelvis);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.38), skinMat);
    head.position.y = 1.95;
    this.keeperGroup.add(head);

    // Arms with oversized Goalie Gloves!
    const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    const gloveGeo = new THREE.BoxGeometry(0.3, 0.3, 0.22);

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.45, 1.45, 0);
    const leftArm = new THREE.Mesh(armGeo, jerseyMat);
    leftArm.position.y = -0.22;
    const leftGlove = new THREE.Mesh(gloveGeo, gloveMat);
    leftGlove.position.y = -0.55;
    leftArmGroup.add(leftArm, leftGlove);
    this.keeperGroup.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.45, 1.45, 0);
    const rightArm = new THREE.Mesh(armGeo, jerseyMat);
    rightArm.position.y = -0.22;
    const rightGlove = new THREE.Mesh(gloveGeo, gloveMat);
    rightGlove.position.y = -0.55;
    rightArmGroup.add(rightArm, rightGlove);
    this.keeperGroup.add(rightArmGroup);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.22);
    const legL = new THREE.Mesh(legGeo, shortsMat);
    legL.position.set(-0.2, 0.4, 0);
    const legR = new THREE.Mesh(legGeo, shortsMat);
    legR.position.set(0.2, 0.4, 0);
    this.keeperGroup.add(legL, legR);

    this.keeperGroup.position.copy(this.keeperPos);
    this.scene.add(this.keeperGroup);
  }

  // ==========================================
  // PINBALL FLIPPERS (DUAL-ARENA HEAD-TO-HEAD)
  // ==========================================
  private createFlippers() {
    // Proportional flipper length establishing a balanced, saveable ~0.82m scoring gap between flipper tips at rest
    const flipperLength = 1.82;
    const flipperWidth = 0.42;
    const flipperHeight = 0.55;

    const buildFlipper = (isLeft: boolean, isTop: boolean = false): Flipper => {
      const group = new THREE.Group();
      // Pivots placed with calibrated clearance: bottom flippers at Z = +8.80, top flippers at Z = -8.80
      const pivotX = isLeft ? -1.98 : 1.98;
      const pivotZ = isTop ? -8.80 : 8.80;
      const pivot = new THREE.Vector3(pivotX, 0.28, pivotZ);
      group.position.copy(pivot);

      // Capsule-like tapered paddle geometry
      const shape = new THREE.Shape();
      const w = flipperWidth;
      const l = flipperLength;
      shape.moveTo(0, -w / 2);
      shape.lineTo(l * 0.9, -w * 0.35);
      shape.absarc(l * 0.9, 0, w * 0.35, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(0, w / 2);
      shape.absarc(0, 0, w / 2, Math.PI / 2, (3 * Math.PI) / 2, false);

      const extrudeSettings = {
        depth: flipperHeight,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05,
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const flipperMat = new THREE.MeshStandardMaterial({
        color: isTop ? 0xf8f9fa : 0xffffff,
        roughness: 0.25,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, flipperMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = flipperHeight / 2;
      mesh.castShadow = true;
      group.add(mesh);

      // High-contrast pivot post
      const postGeo = new THREE.CylinderGeometry(0.32, 0.35, flipperHeight + 0.15, 24);
      const postMat = new THREE.MeshStandardMaterial({
        color: isTop ? 0xe74c3c : 0xf1c40f,
        metalness: 0.85,
        roughness: 0.2,
      });
      const postMesh = new THREE.Mesh(postGeo, postMat);
      postMesh.position.y = (flipperHeight + 0.15) / 2;
      postMesh.castShadow = true;
      group.add(postMesh);

      // Rubber band strip on impact edge
      const bandGeo = new THREE.BoxGeometry(l * 0.85, 0.14, 0.1);
      const bandMat = new THREE.MeshStandardMaterial({
        color: isTop ? 0xff4757 : 0xff3838,
        emissive: isTop ? 0x550011 : 0x440000,
        roughness: 0.3,
      });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(l * 0.45, 0.28, 0);
      group.add(band);

      this.scene.add(group);

      // Rest and active angles:
      // Bottom flippers flip upwards (-Z) into pitch
      // Top flippers flip downwards (+Z) into pitch
      let restAngle: number;
      let activeAngle: number;
      if (!isTop) {
        restAngle = isLeft ? 0.53 : Math.PI - 0.53;
        activeAngle = isLeft ? -0.40 : Math.PI + 0.40;
      } else {
        restAngle = isLeft ? -0.53 : Math.PI + 0.53;
        activeAngle = isLeft ? 0.40 : Math.PI - 0.40;
      }

      group.rotation.y = -restAngle;
      if (isTop) {
        group.visible = this.gameMode === 'two_player';
      }

      return {
        group,
        mesh,
        pivot,
        isLeft,
        currentAngle: restAngle,
        targetAngle: restAngle,
        restAngle,
        activeAngle,
        angularVelocity: 0,
        length: flipperLength,
        width: flipperWidth,
      };
    };

    this.leftFlipper = buildFlipper(true, false);
    this.rightFlipper = buildFlipper(false, false);
    this.topFlipperLeft = buildFlipper(true, true);
    this.topFlipperRight = buildFlipper(false, true);
  }

  // ==========================================
  // SOCCER BALL (ROLLING & TEXTURE)
  // ==========================================
  private createBallCanvasTexture(skinId: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    let baseColor = '#f8f9fa';
    let patchColor = '#1c1e21';
    let accentLineColor: string | null = null;

    if (skinId === 'gold') {
      baseColor = '#f5c518';
      patchColor = '#7a5200';
      accentLineColor = '#ffe066';
    } else if (skinId === 'fire') {
      baseColor = '#e63900';
      patchColor = '#4a0800';
      accentLineColor = '#ffbb00';
    } else if (skinId === 'cyber') {
      baseColor = '#060d1a';
      patchColor = '#004c6d';
      accentLineColor = '#00f0ff';
    }

    // Fill base
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pentagonal soccer patches
    ctx.fillStyle = patchColor;
    const drawPatch = (cx: number, cy: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      if (accentLineColor) {
        ctx.strokeStyle = accentLineColor;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    };

    // Distribute patches across UV coordinates
    drawPatch(128, 64, 34);
    drawPatch(384, 64, 34);
    drawPatch(256, 128, 38);
    drawPatch(128, 192, 34);
    drawPatch(384, 192, 34);
    drawPatch(0, 128, 30);
    drawPatch(512, 128, 30);

    return new THREE.CanvasTexture(canvas);
  }

  private applySkinBaseEmissive(mat: THREE.MeshStandardMaterial) {
    if (this.currentSkinId === 'fire') {
      mat.emissive.setHex(0xff3300);
      mat.emissiveIntensity = 0.45;
    } else if (this.currentSkinId === 'cyber') {
      mat.emissive.setHex(0x00e5ff);
      mat.emissiveIntensity = 0.45;
    } else if (this.currentSkinId === 'gold') {
      mat.emissive.setHex(0x553e00);
      mat.emissiveIntensity = 0.25;
    } else {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
  }

  public setBallSkin(skinId: string) {
    this.currentSkinId = skinId;
    if (!this.ballMesh) return;

    if (this.ballTexture) {
      this.ballTexture.dispose();
    }
    this.ballTexture = this.createBallCanvasTexture(skinId);
    const mat = this.ballMesh.material as THREE.MeshStandardMaterial;
    mat.map = this.ballTexture;

    if (skinId === 'gold') {
      mat.roughness = 0.18;
      mat.metalness = 0.85;
      mat.color.setHex(0xffffff);
    } else if (skinId === 'fire') {
      mat.roughness = 0.3;
      mat.metalness = 0.1;
      mat.color.setHex(0xffffff);
    } else if (skinId === 'cyber') {
      mat.roughness = 0.2;
      mat.metalness = 0.65;
      mat.color.setHex(0xffffff);
    } else {
      mat.roughness = 0.3;
      mat.metalness = 0.05;
      mat.color.setHex(0xffffff);
    }
    mat.needsUpdate = true;
    this.applySkinBaseEmissive(mat);
  }

  private createBall() {
    this.ballTexture = this.createBallCanvasTexture(this.currentSkinId);
    const ballGeo = new THREE.SphereGeometry(this.ballRadius, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      map: this.ballTexture,
      roughness: 0.3,
      metalness: 0.05,
    });
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.copy(this.ballPos);
    this.scene.add(this.ballMesh);
    this.setBallSkin(this.currentSkinId);
  }

  // ==========================================
  // BALL SPEED & FIRE / COMET TRAIL
  // ==========================================
  private createBallTrail() {
    this.ballTrailGeo = new THREE.BufferGeometry();
    for (let i = 0; i < this.maxTrailPoints; i++) {
      this.ballTrailPositions[i * 3] = 0;
      this.ballTrailPositions[i * 3 + 1] = 0.38;
      this.ballTrailPositions[i * 3 + 2] = 0;

      const t = i / this.maxTrailPoints;
      this.ballTrailColors[i * 3] = 1.0;
      this.ballTrailColors[i * 3 + 1] = 0.2 + 0.8 * t;
      this.ballTrailColors[i * 3 + 2] = 0.1 * t;
    }

    this.ballTrailGeo.setAttribute('position', new THREE.BufferAttribute(this.ballTrailPositions, 3));
    this.ballTrailGeo.setAttribute('color', new THREE.BufferAttribute(this.ballTrailColors, 3));

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      linewidth: 3,
    });

    this.ballTrailLine = new THREE.Line(this.ballTrailGeo, trailMat);
    this.ballTrailLine.frustumCulled = false;
    this.ballTrailLine.visible = false;
    this.scene.add(this.ballTrailLine);
  }

  private updateBallTrail(dt: number) {
    if (!this.ballTrailLine || !this.ballMesh || !this.isBallInPlay) {
      if (this.ballTrailLine) this.ballTrailLine.visible = false;
      return;
    }

    const speed = this.ballVel.length();
    const isHighSpeed = speed > 13.0 || this.isPowerKickActive;

    if (isHighSpeed) {
      this.ballTrailEmitTimer += dt;
      if (this.ballTrailEmitTimer >= 0.016) {
        this.ballTrailEmitTimer = 0;
        this.ballTrailHistory.unshift(this.ballPos.clone());
        if (this.ballTrailHistory.length > this.maxTrailPoints) {
          this.ballTrailHistory.pop();
        }
      }
    } else {
      if (this.ballTrailHistory.length > 0) {
        this.ballTrailHistory.pop();
      }
    }

    if (this.ballTrailHistory.length < 2) {
      this.ballTrailLine.visible = false;
      return;
    }

    this.ballTrailLine.visible = true;
    const posAttr = this.ballTrailGeo.attributes.position as THREE.BufferAttribute;
    const colAttr = this.ballTrailGeo.attributes.color as THREE.BufferAttribute;

    const count = this.ballTrailHistory.length;
    for (let i = 0; i < this.maxTrailPoints; i++) {
      const pt = i < count ? this.ballTrailHistory[i] : this.ballTrailHistory[count - 1];
      posAttr.setXYZ(i, pt.x, pt.y, pt.z);

      const ratio = 1 - i / Math.max(count, 1);
      const r = 1.0;
      const g = 0.25 + 0.65 * ratio;
      const b = 0.05 * ratio;
      colAttr.setXYZ(i, r * ratio, g * ratio, b * ratio);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  // ==========================================
  // GAME JUICE: CAMERA SCREEN SHAKE & BULLET TIME
  // ==========================================
  public triggerCameraShake(intensity = 0.35) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 1.1);
  }

  private updateCameraShake(dt: number) {
    if (this.shakeIntensity > 0.005) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
      const offsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity * 0.45;
      const offsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity * 0.35;
      const offsetZ = (Math.random() - 0.5) * 2 * this.shakeIntensity * 0.45;
      this.gameplayCamera.position.set(
        this.baseCameraPos.x + offsetX,
        this.baseCameraPos.y + offsetY,
        this.baseCameraPos.z + offsetZ
      );
    } else if (this.shakeIntensity > 0) {
      this.shakeIntensity = 0;
      this.gameplayCamera.position.copy(this.baseCameraPos);
    }
  }

  public triggerSlowMotion(scale = 0.35, duration = 0.22) {
    this.timeScale = scale;
    this.slowMoTimer = duration;
  }

  // ==========================================
  // PENALTY KICK VISUALS (GUIDE LINE & SPOT RING)
  // ==========================================
  private createPenaltyVisuals() {
    // Glowing Penalty Spot Indicator
    const ringGeo = new THREE.RingGeometry(0.38, 0.52, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf1c40f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.penaltySpotRing = new THREE.Mesh(ringGeo, ringMat);
    this.penaltySpotRing.rotation.x = -Math.PI / 2;
    this.penaltySpotRing.position.set(0, 0.04, 6.0);
    this.scene.add(this.penaltySpotRing);

    // Dynamic Penalty Aiming Guide Line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.15, 6.0),
      new THREE.Vector3(0, 0.15, 10.5),
    ]);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xf1c40f,
      dashSize: 0.4,
      gapSize: 0.25,
      transparent: true,
      opacity: 0,
    });
    this.penaltyAimLine = new THREE.Line(lineGeo, lineMat);
    this.penaltyAimLine.computeLineDistances();
    this.scene.add(this.penaltyAimLine);
  }

  // ==========================================
  // FLIPPER CONTROLS
  // ==========================================
  public resetFlippers() {
    if (this.kickResetTimeout) {
      clearTimeout(this.kickResetTimeout);
      this.kickResetTimeout = null;
    }
    this.isLeftFlipperDown = false;
    this.isRightFlipperDown = false;
    this.leftFlipperHoldTimer = 0;
    this.rightFlipperHoldTimer = 0;
    if (this.leftFlipper) {
      this.leftFlipper.targetAngle = this.leftFlipper.restAngle;
    }
    if (this.rightFlipper) {
      this.rightFlipper.targetAngle = this.rightFlipper.restAngle;
    }

    this.isP2LeftFlipperDown = false;
    this.isP2RightFlipperDown = false;
    this.p2LeftFlipperHoldTimer = 0;
    this.p2RightFlipperHoldTimer = 0;
    if (this.topFlipperLeft) {
      this.topFlipperLeft.targetAngle = this.topFlipperLeft.restAngle;
    }
    if (this.topFlipperRight) {
      this.topFlipperRight.targetAngle = this.topFlipperRight.restAngle;
    }
  }

  public setLeftFlipper(isDown: boolean, isAi: boolean = false) {
    if (this.gameMode === 'team' && !isAi) return; // In team mode, user cannot control flippers
    if (this.isLeftFlipperDown !== isDown && isDown) {
      soundEffects.playFlipper();
    }
    this.isLeftFlipperDown = isDown;
    if (!isDown) this.leftFlipperHoldTimer = 0;
    if (this.leftFlipper) {
      this.leftFlipper.targetAngle = isDown ? this.leftFlipper.activeAngle : this.leftFlipper.restAngle;
    }
  }

  public setRightFlipper(isDown: boolean, isAi: boolean = false) {
    if (this.gameMode === 'team' && !isAi) return; // In team mode, user cannot control flippers
    if (this.isRightFlipperDown !== isDown && isDown) {
      soundEffects.playFlipper();
    }
    this.isRightFlipperDown = isDown;
    if (!isDown) this.rightFlipperHoldTimer = 0;
    if (this.rightFlipper) {
      this.rightFlipper.targetAngle = isDown ? this.rightFlipper.activeAngle : this.rightFlipper.restAngle;
    }
  }

  public setP2LeftFlipper(isDown: boolean, fromAi: boolean = false) {
    if (this.isP2Cpu && !fromAi) return;
    if (this.isP2LeftFlipperDown !== isDown && isDown) {
      soundEffects.playFlipper();
    }
    this.isP2LeftFlipperDown = isDown;
    if (!isDown) this.p2LeftFlipperHoldTimer = 0;
    if (this.topFlipperLeft) {
      this.topFlipperLeft.targetAngle = isDown ? this.topFlipperLeft.activeAngle : this.topFlipperLeft.restAngle;
    }
  }

  public setP2RightFlipper(isDown: boolean, fromAi: boolean = false) {
    if (this.isP2Cpu && !fromAi) return;
    if (this.isP2RightFlipperDown !== isDown && isDown) {
      soundEffects.playFlipper();
    }
    this.isP2RightFlipperDown = isDown;
    if (!isDown) this.p2RightFlipperHoldTimer = 0;
    if (this.topFlipperRight) {
      this.topFlipperRight.targetAngle = isDown ? this.topFlipperRight.activeAngle : this.topFlipperRight.restAngle;
    }
  }

  // ==========================================
  // POINTER & DRAG-AND-DROP TACTICAL PLACEMENT
  // ==========================================
  private onWindowBlur = () => {
    this.resetFlippers();
  };

  private setupPointerEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('blur', this.onWindowBlur);
  }

  private teardownPointerEvents() {
    const dom = this.renderer.domElement;
    if (dom) {
      dom.removeEventListener('pointerdown', this.onPointerDown);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('blur', this.onWindowBlur);
  }

  private getRaycastIntersection(clientX: number, clientY: number): {
    point: THREE.Vector3 | null;
    clickedPlayer: PlayerCharacter | null;
    clickedKeeper: boolean;
    clickedBall: boolean;
  } {
    if (!this.container) return { point: null, clickedPlayer: null, clickedKeeper: false, clickedBall: false };
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { point: null, clickedPlayer: null, clickedKeeper: false, clickedBall: false };

    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    const camera: THREE.PerspectiveCamera = this.gameplayCamera;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);

    // 1. Check ground plane intersection
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    const hitGround = raycaster.ray.intersectPlane(plane, point);

    // 2. Check if clicked near or directly on the ball
    let clickedBall = false;
    if (this.ballMesh && this.isBallInPlay) {
      const ballHits = raycaster.intersectObject(this.ballMesh);
      if (ballHits.length > 0) {
        clickedBall = true;
      } else if (hitGround) {
        const dBall = Math.hypot(point.x - this.ballPos.x, point.z - this.ballPos.z);
        if (dBall < this.ballRadius * 3.5) { // ~1.33m generous touch / click radius
          clickedBall = true;
        }
      }
    }

    // 3. Check if clicked near any player or goalkeeper
    let clickedPlayer: PlayerCharacter | null = null;
    let clickedKeeper = false;
    if (hitGround) {
      for (const p of this.fieldPlayers) {
        const d = new THREE.Vector2(p.group.position.x, p.group.position.z).distanceTo(
          new THREE.Vector2(point.x, point.z)
        );
        if (d < 1.35) {
          clickedPlayer = p;
          break;
        }
      }
      if (!clickedPlayer && this.keeperGroup) {
        const dKeeper = new THREE.Vector2(this.keeperPos.x, this.keeperPos.z).distanceTo(
          new THREE.Vector2(point.x, point.z)
        );
        if (dKeeper < 1.7) {
          clickedKeeper = true;
        }
      }
    }

    return { point: hitGround ? point : null, clickedPlayer, clickedKeeper, clickedBall };
  }

  public smashBallFromClick(clickPoint?: THREE.Vector3 | null) {
    if (!this.isBallInPlay) return;

    let launchDir = new THREE.Vector2(0, -1);

    if (clickPoint) {
      // Vector from click point toward ball center: acts like mallet hitting puck!
      const dx = this.ballPos.x - clickPoint.x;
      const dz = this.ballPos.z - clickPoint.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.08) {
        launchDir.set(dx / dist, dz / dist);
      } else {
        // Clicked directly on center of ball: launch towards opponent goal with chaotic spread
        const forwardZ = this.ballPos.z > 0 ? -1.0 : 1.0;
        launchDir.set((Math.random() - 0.5) * 0.75, forwardZ).normalize();
      }
    } else {
      const forwardZ = this.ballPos.z > 0 ? -1.0 : 1.0;
      launchDir.set((Math.random() - 0.5) * 0.75, forwardZ).normalize();
    }

    // Ensure forward momentum towards opponent net
    if (this.gameMode === 'two_player') {
      if (this.ballPos.z > 0 && launchDir.y > -0.2) {
        launchDir.y = -0.75;
        launchDir.normalize();
      } else if (this.ballPos.z < 0 && launchDir.y < 0.2) {
        launchDir.y = 0.75;
        launchDir.normalize();
      }
    } else {
      if (launchDir.y > -0.25) {
        launchDir.y = -0.75;
        launchDir.normalize();
      }
    }

    // Fast & chaotic air hockey smash speed (24.0 - 29.0 m/s!)
    const strikeSpeed = 24.5 + Math.random() * 4.5;
    this.ballVel.x = launchDir.x * strikeSpeed;
    this.ballVel.z = launchDir.y * strikeSpeed;

    // Impart chaotic spin for curving banks
    this.ballSpin = (Math.random() - 0.5) * 22.0;

    // Reset stuck watchdog
    this.stuckTimer = 0;
    this.wasLastShotBank = false;

    // Audio & Visual juice: punchy kick + bumper pop + cyan spark puff + screen shake!
    soundEffects.playKick(1.75);
    soundEffects.playBumper(1.2);
    this.triggerCameraShake(0.32);
    this.createPlacementPuff(this.ballPos.x, this.ballPos.z, 0x00f5ff);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return; // Only left click / touch

    // If on home screen, ignore
    if (this.gameMode === 'home') {
      return;
    }

    // In penalty phase: clicking executes penalty strike!
    if (this.isPenaltyPhase) {
      this.triggerPenaltyShot();
      return;
    }

    // 1. Direct Air Hockey Puck Smack / Reset on Ball Click:
    // If user clicks on or near the ball, immediately smack/reset it with chaotic air-hockey velocity!
    const hit = this.getRaycastIntersection(e.clientX, e.clientY);
    if (this.isBallInPlay && hit.clickedBall) {
      this.smashBallFromClick(hit.point);
      return;
    }

    // In pinball mode: clicking left half flips left flipper, clicking right half flips right flipper
    if (this.gameMode === 'pinball') {
      const rect = this.container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      if (relativeX < rect.width / 2) {
        this.setLeftFlipper(true);
      } else {
        this.setRightFlipper(true);
      }
      return;
    }

    // In two_player mode:
    if (this.gameMode === 'two_player') {
      if (this.isTwoPlayerSetupPhase) {
        if (hit.clickedPlayer) {
          // Strictly prevent controlling or moving CPU opponent's players/bumpers
          if (this.isP2Cpu && (hit.clickedPlayer.team === 'p2' || hit.clickedPlayer.basePos.z < 0)) {
            return;
          }
          this.draggedPlayer = hit.clickedPlayer;
          this.isDraggingPlayer = true;
          this.draggedPlayer.isDragging = true;
          this.draggedPlayer.group.position.y = 0.55;
          soundEffects.playPlayerPickup();
          if (this.renderer?.domElement) {
            this.renderer.domElement.style.cursor = 'grabbing';
          }
          return;
        }
      } else {
        // Active gameplay: Top half = P2, Bottom half = P1
        const rect = this.container.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        if (this.isP2Cpu) {
          // In CPU/Tournament match: player controls bottom flippers across the entire screen
          if (relX < rect.width / 2) {
            this.setLeftFlipper(true);
          } else {
            this.setRightFlipper(true);
          }
          return;
        }
        if (relY < rect.height / 2) {
          if (relX < rect.width / 2) {
            this.setP2LeftFlipper(true);
          } else {
            this.setP2RightFlipper(true);
          }
        } else {
          if (relX < rect.width / 2) {
            this.setLeftFlipper(true);
          } else {
            this.setRightFlipper(true);
          }
        }
        return;
      }
    }

    // 1. If clicking goalkeeper -> Pick up and start dragging goalkeeper!
    if (hit.clickedKeeper) {
      this.isDraggingKeeper = true;
      this.keeperGroup.position.y = 0.55;
      soundEffects.playPlayerPickup();
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      return;
    }

    // 2. If clicking an existing player -> Pick up and start dragging!
    if (hit.clickedPlayer) {
      if (this.isP2Cpu && (hit.clickedPlayer.team === 'p2' || hit.clickedPlayer.basePos.z < 0)) {
        return;
      }
      this.draggedPlayer = hit.clickedPlayer;
      this.isDraggingPlayer = true;
      this.draggedPlayer.isDragging = true;
      this.selectPlayer(hit.clickedPlayer.id);
      this.showTacticalZone(hit.clickedPlayer.role);

      // Lift player off turf slightly
      this.draggedPlayer.group.position.y = 0.55;
      soundEffects.playPlayerPickup();
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      return;
    }

    // 3. If a role is pending from bench/tactics UI -> Place new person!
    if (this.pendingPlacementRole && hit.point) {
      const ok = this.addPlayer(this.pendingPlacementRole, hit.point.x, hit.point.z);
      if (ok) {
        soundEffects.playPlayerPlace();
        this.pendingPlacementRole = null;
        this.hideTacticalZone();
      }
      return;
    }

    // 4. Clicked empty pitch -> deselect player
    if (this.selectedPlayerId) {
      this.selectPlayer(null);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.gameMode === 'home') return;

    if (this.gameMode === 'two_player') {
      if (this.isDraggingPlayer && this.draggedPlayer) {
        const hit = this.getRaycastIntersection(e.clientX, e.clientY);
        if (hit.point) {
          const isP2 = this.draggedPlayer.team === 'p2' || this.draggedPlayer.basePos.z < 0;
          const minZ = isP2 ? -7.0 : 1.0;
          const maxZ = isP2 ? -1.0 : 7.0;
          const clampedX = Math.max(-3.6, Math.min(3.6, hit.point.x));
          const clampedZ = Math.max(minZ, Math.min(maxZ, hit.point.z));
          this.draggedPlayer.group.position.x = clampedX;
          this.draggedPlayer.group.position.z = clampedZ;
          this.draggedPlayer.ringMat.color.setHex(0x00ff88);
          this.draggedPlayer.ringMat.opacity = 0.95;
        }
        if (this.renderer?.domElement) {
          this.renderer.domElement.style.cursor = 'grabbing';
        }
      }
      return;
    }

    // Dynamic aim update
    this.setAimPoint(e.clientX, e.clientY);

    // Dragging goalkeeper
    if (this.isDraggingKeeper) {
      const hit = this.getRaycastIntersection(e.clientX, e.clientY);
      if (hit.point) {
        this.keeperPos.x = Math.max(-2.5, Math.min(2.5, hit.point.x));
        this.keeperPos.z = Math.max(-10.6, Math.min(-7.5, hit.point.z));
        this.keeperGroup.position.x = this.keeperPos.x;
        this.keeperGroup.position.z = this.keeperPos.z;
      }
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      return;
    }

    if (this.isDraggingPlayer && this.draggedPlayer) {
      const hit = this.getRaycastIntersection(e.clientX, e.clientY);
      if (hit.point) {
        const zone = ROLE_TACTICAL_ZONES[this.draggedPlayer.role];
        const clampedX = Math.max(zone.minX, Math.min(zone.maxX, hit.point.x));
        const clampedZ = Math.max(zone.minZ, Math.min(zone.maxZ, hit.point.z));

        this.draggedPlayer.group.position.x = clampedX;
        this.draggedPlayer.group.position.z = clampedZ;

        // Check if cursor is attempting to place outside zone or too close to teammates
        const isOutOfBounds =
          hit.point.x < zone.minX ||
          hit.point.x > zone.maxX ||
          hit.point.z < zone.minZ ||
          hit.point.z > zone.maxZ;
        const hasClumping = this.fieldPlayers.some(
          (p) =>
            p.id !== this.draggedPlayer!.id &&
            !p.isDragging &&
            p.group.position.distanceTo(new THREE.Vector3(clampedX, 0, clampedZ)) <
              SoccerPinballEngine.MIN_PLAYER_SPACING
        );

        if (isOutOfBounds || hasClumping) {
          this.draggedPlayer.ringMat.color.setHex(0xff2222); // Red warning!
          this.draggedPlayer.ringMat.opacity = 1.0;
        } else {
          this.draggedPlayer.ringMat.color.setHex(0x00ff88); // Valid spot!
          this.draggedPlayer.ringMat.opacity = 0.95;
        }
      }
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      return;
    }

    // Cursor hover feedback: Pointer when hovering over clickable ball!
    if (this.isBallInPlay && !this.isDraggingPlayer && !this.isDraggingKeeper) {
      const hitBallCheck = this.getRaycastIntersection(e.clientX, e.clientY);
      if (hitBallCheck.clickedBall && this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }

    // Hover state feedback
    if (this.gameMode === 'pinball') {
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'crosshair';
      }
      return;
    }

    const hit = this.getRaycastIntersection(e.clientX, e.clientY);
    if (this.renderer?.domElement) {
      if (hit.clickedPlayer || hit.clickedKeeper) {
        this.renderer.domElement.style.cursor = 'grab';
      } else {
        this.renderer.domElement.style.cursor = this.pendingPlacementRole ? 'copy' : 'crosshair';
      }
    }
  };

  private onPointerUp = () => {
    if (this.gameMode === 'pinball') {
      this.setLeftFlipper(false);
      this.setRightFlipper(false);
      return;
    }

    if (this.gameMode === 'two_player') {
      if (this.isDraggingPlayer && this.draggedPlayer) {
        const player = this.draggedPlayer;
        player.basePos.copy(player.group.position);
        player.basePos.y = 0;
        player.group.position.y = 0;
        player.isDragging = false;
        this.draggedPlayer = null;
        this.isDraggingPlayer = false;
        this.updatePlayerRingColor(player);
        this.createPlacementPuff(player.basePos.x, player.basePos.z);
        soundEffects.playPlayerPlace();
        this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
        if (this.renderer?.domElement) {
          this.renderer.domElement.style.cursor = 'grab';
        }
      } else {
        this.setLeftFlipper(false);
        this.setRightFlipper(false);
        this.setP2LeftFlipper(false);
        this.setP2RightFlipper(false);
      }
      return;
    }

    if (this.isDraggingKeeper) {
      this.keeperGroup.position.y = 0;
      this.isDraggingKeeper = false;
      soundEffects.playPlayerPlace();
      this.createPlacementPuff(this.keeperPos.x, this.keeperPos.z);
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'crosshair';
      }
    }

    if (this.isDraggingPlayer && this.draggedPlayer) {
      const player = this.draggedPlayer;
      const wasInCenter = Math.abs(player.basePos.x) < 1.0;

      // 1. TACTICAL SWAP: Check if dropped onto or near another teammate (< 1.4m)
      const teammateToSwap = this.fieldPlayers.find(
        (p) =>
          p.id !== player.id &&
          !p.isDragging &&
          p.group.position.distanceTo(player.group.position) < 1.4
      );

      if (teammateToSwap) {
        // Swap positions between player and teammateToSwap!
        const originalPlayerBase = player.basePos.clone();
        const teammateBase = teammateToSwap.basePos.clone();

        player.group.position.copy(teammateBase);
        player.basePos.copy(teammateBase);

        teammateToSwap.group.position.copy(originalPlayerBase);
        teammateToSwap.basePos.copy(originalPlayerBase);

        this.updatePlayerTrajectory(player);
        this.updatePlayerTrajectory(teammateToSwap);

        player.group.position.y = 0;
        player.isDragging = false;
        teammateToSwap.group.position.y = 0;
        this.updatePlayerRingColor(player);
        this.updatePlayerRingColor(teammateToSwap);

        soundEffects.playPlayerPlace();
        this.createPlacementPuff(player.group.position.x, player.group.position.z);
        this.createPlacementPuff(teammateToSwap.group.position.x, teammateToSwap.group.position.z);

        this.callbacks.onPlacementFeedback?.({
          message: `Tactical Swap! Swapped ${player.name} with ${teammateToSwap.name} to avoid power hits!`,
          type: 'success',
        });
      } else {
        // Check if dropped position has spacing conflict (< 2.0m)
        const hasConflict = this.fieldPlayers.some(
          (p) =>
            p.id !== player.id &&
            !p.isDragging &&
            p.group.position.distanceTo(player.group.position) < SoccerPinballEngine.MIN_PLAYER_SPACING
        );

        if (hasConflict) {
          const spot = this.findNearestValidSpotInZone(
            player.role,
            player.group.position.x,
            player.group.position.z,
            player.id
          );
          if (spot) {
            player.group.position.set(spot.x, 0, spot.z);
            player.basePos.set(spot.x, 0, spot.z);
            this.callbacks.onPlacementFeedback?.({
              message: 'Position adjusted to maintain 2m tactical spacing!',
              type: 'warning',
            });
          } else {
            // Revert to original basePos
            player.group.position.copy(player.basePos);
            this.callbacks.onPlacementFeedback?.({
              message: 'Spot occupied! Maintained 2m tactical spacing.',
              type: 'warning',
            });
          }
        } else {
          player.basePos.copy(player.group.position);
          if (wasInCenter && Math.abs(player.basePos.x) >= 1.0) {
            this.callbacks.onPlacementFeedback?.({
              message: `Tactical Move! Moved ${player.name} away from center to safety!`,
              type: 'success',
            });
          }
        }

        player.group.position.y = 0;
        player.isDragging = false;
        this.updatePlayerRingColor(player);
        this.resolvePlayerClustering();

        soundEffects.playPlayerPlace();
        this.createPlacementPuff(player.group.position.x, player.group.position.z);
      }

      this.isDraggingPlayer = false;
      this.draggedPlayer = null;
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = 'crosshair';
      }
      this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
    }
  };

  private createPlacementPuff(x: number, z: number, color: number = 0x48dbfb) {
    const particleCount = 14;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = 0.05;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;

      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 1.5;
      velocities.push(new THREE.Vector3(Math.cos(ang) * spd, 1.2 + Math.random() * 1.5, Math.sin(ang) * spd));
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
    });

    const points = new THREE.Points(geometry, material);
    (points as any).userData = { velocities, life: 0.6, maxLife: 0.6 };
    this.scene.add(points);
    this.dustPuffParticles.push(points);
  }

  private updateDustPuffs(dt: number) {
    for (let i = this.dustPuffParticles.length - 1; i >= 0; i--) {
      const p = this.dustPuffParticles[i];
      const ud = (p as any).userData;
      ud.life -= dt;

      if (ud.life <= 0) {
        this.scene.remove(p);
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
        this.dustPuffParticles.splice(i, 1);
        continue;
      }

      const ratio = ud.life / ud.maxLife;
      (p.material as THREE.PointsMaterial).opacity = ratio;

      const posAttr = p.geometry.attributes.position as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const vels: THREE.Vector3[] = ud.velocities;

      for (let j = 0; j < vels.length; j++) {
        posArr[j * 3] += vels[j].x * dt;
        posArr[j * 3 + 1] += vels[j].y * dt;
        posArr[j * 3 + 2] += vels[j].z * dt;
        vels[j].y -= 9.8 * dt * 0.4; // gravity
      }
      posAttr.needsUpdate = true;
    }
  }

  public setAimPoint(screenX: number, screenY: number) {
    const hit = this.getRaycastIntersection(screenX, screenY);
    if (hit.point) {
      this.aimTarget.copy(hit.point);
    }
  }

  // Distance from ball to a flipper paddle segment
  public getDistanceToFlipper(flipper: Flipper): number {
    if (!flipper) return 999;
    const pivotP = new THREE.Vector2(flipper.pivot.x, flipper.pivot.z);
    const ballP = new THREE.Vector2(this.ballPos.x, this.ballPos.z);
    const dir = new THREE.Vector2(Math.cos(flipper.currentAngle), Math.sin(flipper.currentAngle));
    const flipperToBall = new THREE.Vector2().subVectors(ballP, pivotP);
    const proj = flipperToBall.dot(dir);
    const clampedProj = THREE.MathUtils.clamp(proj, 0, flipper.length);
    const closestP = new THREE.Vector2().copy(pivotP).addScaledVector(dir, clampedProj);
    return ballP.distanceTo(closestP);
  }

  // Returns true ONLY when ball is in the flipper strike zone ("pinball handles")
  public isBallNearFlippers(threshold: number = 2.1): boolean {
    if (!this.isBallInPlay || !this.leftFlipper || !this.rightFlipper) return false;
    // Flipper paddles are stationed between Z = 7.0 and 9.72.
    // If the ball is further upfield (Z < 6.0) or past the drain (Z > 9.85), it cannot be reached
    if (this.ballPos.z < 6.0 || this.ballPos.z > 9.85) return false;

    const dLeft = this.getDistanceToFlipper(this.leftFlipper);
    const dRight = this.getDistanceToFlipper(this.rightFlipper);
    return Math.min(dLeft, dRight) <= threshold;
  }

  // Check if Power Kick action is currently valid and ready to fire
  public checkPowerKickReady(): boolean {
    if (!this.isBallInPlay || this.stats.isPaused || this.stats.isGameOver) return false;
    if (this.gameMode === 'pinball') {
      return this.isBallNearFlippers(2.1);
    }
    if (this.gameMode === 'team') {
      return this.fieldPlayers.some((p) => !p.isStunned && p.group.position.distanceTo(this.ballPos) < 3.2);
    }
    if (this.gameMode === 'two_player') {
      return this.isBallNearFlippers(2.1) || this.fieldPlayers.some((p) => !p.isStunned && p.group.position.distanceTo(this.ballPos) < 3.2);
    }
    return false;
  }

  public triggerActionKick(isAi: boolean = false, source?: 'flipper' | 'team'): boolean {
    if (this.isPenaltyPhase) {
      this.triggerPenaltyShot();
      return true;
    }

    if (!this.isBallInPlay || this.stats.isPaused || this.stats.isGameOver) return false;

    // Flipper Power Kick
    const canFlipper = this.gameMode === 'pinball' || (this.gameMode === 'two_player' && source !== 'team');
    if (canFlipper && (source === 'flipper' || this.isBallNearFlippers(2.1))) {
      if (!this.isBallNearFlippers(2.1)) {
        if (source === 'flipper') return false;
      } else {
        this.isPowerKickActive = true;
        if (this.kickResetTimeout) {
          clearTimeout(this.kickResetTimeout);
          this.kickResetTimeout = null;
        }
        this.setLeftFlipper(true, true);
        this.setRightFlipper(true, true);

        this.kickResetTimeout = setTimeout(() => {
          this.resetFlippers();
        }, 190);

        const targetZ = -10.5;
        const targetX = Math.max(-1.8, Math.min(1.8, this.aimTarget.x || 0));
        const kickDir = new THREE.Vector3(targetX - this.ballPos.x, 0, targetZ - this.ballPos.z).normalize();
        this.ballVel.x = kickDir.x * 30.0;
        this.ballVel.z = Math.min(-20.0, kickDir.z * 30.0);
        soundEffects.playKick(2.2);
        this.createPlacementPuff(this.ballPos.x, this.ballPos.z);
        this.triggerCameraShake(0.55);
        return true;
      }
    }

    // Team Striker Strike
    const canTeam = this.gameMode === 'team' || (this.gameMode === 'two_player' && source !== 'flipper');
    if (canTeam) {
      let closestPlayer: PlayerCharacter | null = null;
      let minDistance = 3.2;

      for (const player of this.fieldPlayers) {
        if (player.isStunned) continue;
        const d = player.group.position.distanceTo(this.ballPos);
        if (d < minDistance) {
          minDistance = d;
          closestPlayer = player;
        }
      }

      if (closestPlayer) {
        this.isPowerKickActive = true;
        this.executePlayerKick(closestPlayer, 1.5);
        this.triggerCameraShake(0.48);
        return true;
      }
    }

    return false;
  }

  // Autonomous Pinball AI for when user chooses Team Mode
  private updatePinballAI(dt: number) {
    if (this.gameMode !== 'team' || !this.isBallInPlay) return;

    if (this.aiKickCooldown > 0) this.aiKickCooldown -= dt;

    const ballX = this.ballPos.x;
    const ballZ = this.ballPos.z;
    const velZ = this.ballVel.z;

    const triggerZ = this.aiDifficulty === 'easy' ? 7.35 : 7.1;
    const holdDuration = this.aiDifficulty === 'hard' ? 0.25 : this.aiDifficulty === 'easy' ? 0.17 : 0.22;
    const cooldownDuration = this.aiDifficulty === 'hard' ? 1.5 : this.aiDifficulty === 'easy' ? 3.2 : 2.2;
    const kickChance = this.aiDifficulty === 'hard' ? 0.55 : this.aiDifficulty === 'easy' ? 0.22 : 0.35;

    // Ball is descending towards flippers (Z > 5.5 and moving downfield)
    if (ballZ > 5.5 && ballZ < 9.6) {
      // Time to reach flipper line (pivotZ ~ 8.80)
      const timeToFlippers = velZ > 0.5 ? (8.80 - ballZ) / velZ : 999;
      const predictedX = ballX + this.ballVel.x * Math.min(timeToFlippers, 0.5);

      // Left flipper region: covers left flank and can reach across center to +0.15m
      if ((predictedX <= 0.15 && predictedX > -2.35) || (ballX <= 0.15 && ballX > -2.35 && ballZ > triggerZ)) {
        if (ballZ > triggerZ && velZ > -0.5 && this.aiLeftHoldTimer <= 0) {
          this.setLeftFlipper(true, true);
          this.aiLeftHoldTimer = holdDuration;
        }
      }

      // Right flipper region: covers right flank and can reach across center to -0.15m
      if ((predictedX >= -0.15 && predictedX < 2.35) || (ballX >= -0.15 && ballX < 2.35 && ballZ > triggerZ)) {
        if (ballZ > triggerZ && velZ > -0.5 && this.aiRightHoldTimer <= 0) {
          this.setRightFlipper(true, true);
          this.aiRightHoldTimer = holdDuration;
        }
      }
    }

    // Release flippers after hold timer expires so handles visibly reset down
    if (this.aiLeftHoldTimer > 0) {
      this.aiLeftHoldTimer -= dt;
      if (this.aiLeftHoldTimer <= 0) {
        this.setLeftFlipper(false, true);
      }
    }
    if (this.aiRightHoldTimer > 0) {
      this.aiRightHoldTimer -= dt;
      if (this.aiRightHoldTimer <= 0) {
        this.setRightFlipper(false, true);
      }
    }

    // AI Pinball power kick: fires a rocket strike back upfield
    if (this.aiKickCooldown <= 0 && ballZ > 6.8 && ballZ < 8.8 && this.ballVel.z < -1.5) {
      if (Math.random() < kickChance) {
        this.triggerActionKick(true);
        this.aiKickCooldown = cooldownDuration;
      }
    }
  }

  // Autonomous CPU Opponent for Top Flippers in Head-to-Head / Tournament Mode
  private updateP2CpuAI(dt: number) {
    if (this.gameMode !== 'two_player' || !this.isP2Cpu || !this.isBallInPlay) return;

    // Flipper release timers
    if (this.p2AiHoldTimerLeft > 0) {
      this.p2AiHoldTimerLeft -= dt;
      if (this.p2AiHoldTimerLeft <= 0) {
        this.setP2LeftFlipper(false, true);
      }
    }
    if (this.p2AiHoldTimerRight > 0) {
      this.p2AiHoldTimerRight -= dt;
      if (this.p2AiHoldTimerRight <= 0) {
        this.setP2RightFlipper(false, true);
      }
    }

    const ballX = this.ballPos.x;
    const ballZ = this.ballPos.z;
    const velZ = this.ballVel.z;
    const velX = this.ballVel.x;

    // Difficulty calibrations
    const triggerZ = this.p2CpuDifficulty === 'easy' ? -6.85 : this.p2CpuDifficulty === 'hard' ? -6.05 : -6.45;
    const holdDuration = this.p2CpuDifficulty === 'hard' ? 0.26 : this.p2CpuDifficulty === 'easy' ? 0.17 : 0.22;
    const kickChance = this.p2CpuDifficulty === 'hard' ? 1.0 : this.p2CpuDifficulty === 'easy' ? 0.78 : 0.92;

    // Ball approaching top flippers (moving toward negative Z, pivot at Z = -8.80)
    if (ballZ < -4.5 && ballZ > -9.6) {
      const timeToFlippers = velZ < -0.3 ? (-8.80 - ballZ) / velZ : 999;
      const predictedX = ballX + velX * Math.min(timeToFlippers, 0.45);

      // Top Left flipper region (pivot at x = -1.98, sweeps inward/downward across to center)
      if ((predictedX <= 0.22 && predictedX > -2.40) || (ballX <= 0.22 && ballX > -2.40 && ballZ < triggerZ)) {
        if (ballZ < triggerZ && velZ < 1.0 && this.p2AiHoldTimerLeft <= 0) {
          if (Math.random() < kickChance) {
            this.setP2LeftFlipper(true, true);
            this.p2AiHoldTimerLeft = holdDuration;
          }
        }
      }

      // Top Right flipper region (pivot at x = 1.98, sweeps inward/downward across to center)
      if ((predictedX >= -0.22 && predictedX < 2.40) || (ballX >= -0.22 && ballX < 2.40 && ballZ < triggerZ)) {
        if (ballZ < triggerZ && velZ < 1.0 && this.p2AiHoldTimerRight <= 0) {
          if (Math.random() < kickChance) {
            this.setP2RightFlipper(true, true);
            this.p2AiHoldTimerRight = holdDuration;
          }
        }
      }
    }

    // Anti-stall nudge: if ball is trapped or rolling lazily in top flipper zone
    if (ballZ < -7.8 && ballZ > -9.3 && Math.abs(velZ) < 0.35) {
      if (ballX < 0 && this.p2AiHoldTimerLeft <= 0) {
        this.setP2LeftFlipper(true, true);
        this.p2AiHoldTimerLeft = 0.20;
      } else if (ballX >= 0 && this.p2AiHoldTimerRight <= 0) {
        this.setP2RightFlipper(true, true);
        this.p2AiHoldTimerRight = 0.20;
      }
    }
  }

  // ==========================================
  // PHYSICS & GAME LOOP
  // ==========================================
  private animate = () => {
    if (this.gameMode === 'home') {
      this.animationFrameId = null;
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const rawDelta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Bullet-time slow-mo decay
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= rawDelta;
      if (this.slowMoTimer <= 0) {
        this.timeScale = 1.0;
      }
    }
    const delta = rawDelta * this.timeScale;

    if (!this.stats.isPaused && !this.stats.isGameOver) {
      this.updatePhysics(delta);
      this.updateFieldPlayers(delta);
      this.updateGoalkeeper(delta);
      this.updateDustPuffs(delta);
      this.updateBallTrail(delta);
    }

    this.updateCameraShake(rawDelta);
    this.renderViewports();
  };

  private updatePhysics(dt: number) {
    if (this.gameMode === 'two_player' && this.isTwoPlayerSetupPhase) {
      this.ballPos.set(0, 0.38, 0);
      this.ballVel.set(0, 0, 0);
      if (this.ballMesh) {
        this.ballMesh.position.set(0, 0.38, 0);
        this.ballMesh.visible = true;
      }
      this.updateFlipper(this.leftFlipper, dt);
      this.updateFlipper(this.rightFlipper, dt);
      this.updateFlipper(this.topFlipperLeft, dt);
      this.updateFlipper(this.topFlipperRight, dt);
      return;
    }

    // 0. Match Timer: 2 minutes max (120 seconds)
    this.matchTimerAccumulator += dt;
    if (this.matchTimerAccumulator >= 1.0) {
      this.matchTimerAccumulator -= 1.0;
      if (this.stats.matchTime > 0) {
        this.stats.matchTime -= 1;
        this.callbacks.onScoreUpdate(this.stats);
        if (this.stats.matchTime <= 0) {
          this.handleFullTime();
          return;
        }
      }
    }

    // 1. Interactive Penalty Phase: Player gets moment to place & aim before timed shot
    if (this.isPenaltyPhase) {
      this.ballVel.set(0, 0, 0); // Ball remains locked on penalty spot
      this.ballPos.y = this.ballRadius;
      this.ballMesh.position.copy(this.ballPos);

      // Update aim guide trajectory line & kicker orientation targeting the Pinball goal (Z = 10.5)
      if (this.penaltyKicker && this.penaltyAimLine) {
        let targetX = 0;
        if (this.gameMode === 'team') {
          // In Team mode: User aims with crosshair directly across the Pinball goal mouth
          targetX = THREE.MathUtils.clamp(this.aimTarget.x, -2.1, 2.1);
        } else {
          // In Pinball mode: AI striker sweeps aim across the flipper gap and corners
          targetX = Math.sin(performance.now() * 0.003) * 1.8;
        }

        const targetZ = 10.5; // Always the Pinball's goal!
        const kickDir = new THREE.Vector3(targetX - this.ballPos.x, 0, targetZ - this.ballPos.z).normalize();

        // Position kicker directly behind ball facing the target Pinball net
        const kickerPos = this.ballPos.clone().addScaledVector(kickDir, -1.35);
        this.penaltyKicker.group.position.set(kickerPos.x, 0, kickerPos.z);
        this.penaltyKicker.group.rotation.y = Math.atan2(kickDir.x, kickDir.z);
        this.penaltyKicker.group.rotation.x = 0;

        // Project laser aim guide line from ball directly into Pinball goal mouth
        const pts = [
          new THREE.Vector3(this.ballPos.x, 0.15, this.ballPos.z),
          new THREE.Vector3(targetX, 0.15, targetZ),
        ];
        this.penaltyAimLine.geometry.setFromPoints(pts);
        this.penaltyAimLine.computeLineDistances();
        (this.penaltyAimLine.material as THREE.LineDashedMaterial).opacity = 0.95;
      }

      // Decrement penalty shot clock
      this.penaltyTimeRemaining -= dt;

      // Broadcast shot clock countdown to UI at ~10Hz
      const now = performance.now();
      if (now - this.penaltyLastEmitTime > 80) {
        this.penaltyLastEmitTime = now;
        this.callbacks.onPenaltyPhaseChange?.({
          isActive: true,
          timeLeft: Math.max(0, this.penaltyTimeRemaining),
          totalTime: this.penaltyTotalTime,
          card: this.penaltyCardType,
          isShooterUser: this.gameMode === 'team',
          kickerName: this.penaltyKicker ? this.penaltyKicker.name : 'Striker',
        });
      }

      // Auto-strike if user/PC runs out of time
      if (this.penaltyTimeRemaining <= 0) {
        this.executePenaltyStrike();
      }

      // Keep flippers animating during penalty setup
      this.updateFlipper(this.leftFlipper, dt);
      this.updateFlipper(this.rightFlipper, dt);
      return;
    }

    if (this.penaltyShotActiveTimer > 0) {
      this.penaltyShotActiveTimer -= dt;
    }

    // 2. Autonomous Pinball AI if user is playing as Team
    if (this.gameMode === 'team') {
      this.updatePinballAI(dt);
    }
    // Autonomous CPU Top Flippers for Tournament & vs CPU
    if (this.gameMode === 'two_player' && this.isP2Cpu) {
      this.updateP2CpuAI(dt);
    }

    // 3. Flipper Physics & Animation (updated before collision checks)
    this.updateFlipper(this.leftFlipper, dt);
    this.updateFlipper(this.rightFlipper, dt);
    if (this.gameMode === 'two_player') {
      this.updateFlipper(this.topFlipperLeft, dt);
      this.updateFlipper(this.topFlipperRight, dt);
    }

    // 4. Air Hockey Glide & Low-Friction Table Cushion
    // Completely FLAT, neutral pitch across ALL modes (Quick Game, Tournament, 2-Player).
    const currentSpeed = this.ballVel.length();
    if (currentSpeed > 0.001) {
      // Stage A: Near-zero air drag (air hockey puck gliding on air cushion)
      const airDrag = Math.exp(-0.012 * dt);
      this.ballVel.multiplyScalar(airDrag);

      // Stage B: Ultra-minimal table friction
      const puckDecel = 0.08 * dt;
      if (currentSpeed <= puckDecel) {
        this.ballVel.set(0, 0, 0);
      } else {
        this.ballVel.multiplyScalar((currentSpeed - puckDecel) / currentSpeed);
      }
    }

    // Velocity ceiling: Air hockey speeds (up to 38 m/s on power kicks!)
    const maxSpeed = this.isPowerKickActive ? 38.0 : 32.0;
    if (this.ballVel.length() > maxSpeed) {
      this.ballVel.setLength(maxSpeed);
    }

    // High-precision physics substepping (8 substeps for zero-tunneling and authentic rebound response)
    const subSteps = 8;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      // Aerodynamic Magnus curve (spin induces curving banana shots!)
      if (Math.abs(this.ballSpin) > 0.05) {
        const magnusStrength = this.ballSpin * 0.16;
        this.ballVel.x += -this.ballVel.z * magnusStrength * subDt;
        this.ballVel.z += this.ballVel.x * magnusStrength * subDt;
        this.ballSpin *= Math.exp(-0.75 * subDt);
      }

      // Step position incrementally
      this.ballPos.x += this.ballVel.x * subDt;
      this.ballPos.z += this.ballVel.z * subDt;

      // Wall Collisions (authoritative elastic reflection)
      this.handleWallCollisions();

      // Flipper-Ball Collisions (True momentum transfer, sweet-spot tip launch & soft cradling)
      this.handleFlipperCollision(this.leftFlipper);
      this.handleFlipperCollision(this.rightFlipper);
      if (this.gameMode === 'two_player') {
        this.handleFlipperCollision(this.topFlipperLeft);
        this.handleFlipperCollision(this.topFlipperRight);
      }

      // Field Player Interactions (Elastic body bumper ricochets + intentional front-cone kicking)
      this.handlePlayerCollisions();

      // Goalkeeper Collision & Saves (not in two_player mode)
      if (this.gameMode !== 'two_player') {
        this.handleGoalkeeperCollision();
      }

      // Safety perimeter containment: Only engage if ball penetrated beyond physical walls
      const maxFieldX = 4.18;
      if (this.ballPos.x > maxFieldX) {
        this.ballPos.x = maxFieldX;
        if (this.ballVel.x > 0) this.ballVel.x = -this.ballVel.x * 0.85;
      } else if (this.ballPos.x < -maxFieldX) {
        this.ballPos.x = -maxFieldX;
        if (this.ballVel.x < 0) this.ballVel.x = -this.ballVel.x * 0.85;
      }

      // Endline containment (outside goal mouth |x| >= 2.05)
      if (this.ballPos.z < -10.5 && Math.abs(this.ballPos.x) >= 2.05) {
        this.ballPos.z = -10.5;
        if (this.ballVel.z < 0) this.ballVel.z = -this.ballVel.z * 0.85;
      } else if (this.gameMode === 'two_player' && this.ballPos.z > 10.5 && Math.abs(this.ballPos.x) >= 2.05) {
        this.ballPos.z = 10.5;
        if (this.ballVel.z > 0) this.ballVel.z = -this.ballVel.z * 0.85;
      }

      // If ball already drained or scored during a sub-step, stop early
      if (!this.isBallInPlay) break;
    }

    // Ball rolling visual rotation
    const speed = this.ballVel.length();
    if (speed > 0.05) {
      const rotAxis = new THREE.Vector3(-this.ballVel.z, 0, this.ballVel.x).normalize();
      const angle = (speed * dt) / this.ballRadius;
      this.ballMesh.rotateOnWorldAxis(rotAxis, angle);
    }
    this.ballMesh.position.x = this.ballPos.x;
    this.ballMesh.position.z = this.ballPos.z;

    // Always clamp height to table surface
    this.ballPos.y = this.ballRadius;
    this.ballMesh.position.y = this.ballRadius;

    // Glowing fiery visual indicator for Power Kick (only power kick knocks down players!)
    if (this.ballMesh && this.ballMesh.material) {
      const mat = this.ballMesh.material as THREE.MeshStandardMaterial;
      if (this.isPowerKickActive) {
        mat.emissive.setHex(0xff3b00);
        mat.emissiveIntensity = 0.95;
      } else {
        this.applySkinBaseEmissive(mat);
      }
    }

    // Anti-stuck watchdog: If ball is virtually stopped (< 0.15 m/s) for over 2.0 seconds
    if (this.isBallInPlay && this.ballVel.length() < 0.15) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 2.0) {
        this.stuckTimer = 0;
        // Air hockey blower puff into active zone
        const tossDirZ = this.ballPos.z > 0 ? -12.0 : 12.0;
        const tossDirX = (Math.random() - 0.5) * 8.0;
        this.ballVel.set(tossDirX, 0, tossDirZ);
        soundEffects.playWhistle();
        soundEffects.playKick(1.4);
        this.createPlacementPuff(this.ballPos.x, this.ballPos.z, 0x00f5ff);
      }
    } else {
      this.stuckTimer = 0;
    }

    // 7. Goal Detection
    if (this.gameMode === 'two_player') {
      if (this.ballPos.z < -9.85 && Math.abs(this.ballPos.x) < 2.05 && this.isBallInPlay) {
        this.handleTwoPlayerGoal('p1');
      } else if (this.ballPos.z > 9.85 && Math.abs(this.ballPos.x) < 2.05 && this.isBallInPlay) {
        this.handleTwoPlayerGoal('p2');
      }
    } else {
      // Top Goal: Scoring in Top Goal!
      if (this.ballPos.z < -10.3 && Math.abs(this.ballPos.x) < 2.05 && this.isBallInPlay) {
        this.handleGoalScored();
      }

      // Bottom Net: Ball slips past flippers
      if (this.ballPos.z > 9.85 && this.isBallInPlay) {
        this.handleBallDrained();
      }
    }

    // 9. Check Power Kick Availability state & notify UI on changes
    const isPowerKickReady = this.checkPowerKickReady();
    if (isPowerKickReady !== this.lastPowerKickReady) {
      this.lastPowerKickReady = isPowerKickReady;
      this.callbacks.onPowerKickAvailabilityChange?.(isPowerKickReady);
    }

    // 10. Safety check: Ensure flippers never remain stuck up
    if (this.isLeftFlipperDown) {
      this.leftFlipperHoldTimer += dt;
      if (this.leftFlipperHoldTimer > 2.0) {
        this.setLeftFlipper(false, true);
      }
    }
    if (this.isRightFlipperDown) {
      this.rightFlipperHoldTimer += dt;
      if (this.rightFlipperHoldTimer > 2.0) {
        this.setRightFlipper(false, true);
      }
    }
  }

  private updateFlipper(flipper: Flipper, dt: number) {
    const diff = flipper.targetAngle - flipper.currentAngle;
    const flipperSpeed = 22.0; // Rapid snapping flipper speed that has a clear visual sweep
    const prevAngle = flipper.currentAngle;

    if (Math.abs(diff) > 0.01) {
      flipper.currentAngle += Math.sign(diff) * Math.min(Math.abs(diff), flipperSpeed * dt);
    } else {
      flipper.currentAngle = flipper.targetAngle;
    }

    flipper.angularVelocity = (flipper.currentAngle - prevAngle) / (dt || 0.016);
    flipper.group.rotation.y = -flipper.currentAngle;
  }

  private handleWallCollisions() {
    const ballP = new THREE.Vector2(this.ballPos.x, this.ballPos.z);

    for (const wall of this.walls) {
      const line = new THREE.Vector2().subVectors(wall.p2, wall.p1);
      const lineLen = line.length();
      const lineDir = line.clone().normalize();

      const toBall = new THREE.Vector2().subVectors(ballP, wall.p1);
      const proj = toBall.dot(lineDir);

      if (proj >= -this.ballRadius && proj <= lineLen + this.ballRadius) {
        const clampedProj = Math.max(0, Math.min(lineLen, proj));
        const closestPoint = new THREE.Vector2().addVectors(wall.p1, lineDir.clone().multiplyScalar(clampedProj));
        const distVec = new THREE.Vector2().subVectors(ballP, closestPoint);
        const dist = distVec.length();

        if (dist < this.ballRadius && dist > 0.0001) {
          const colNormal = distVec.normalize();
          // Push ball outside wall
          const overlap = this.ballRadius - dist;
          this.ballPos.x += colNormal.x * overlap;
          this.ballPos.z += colNormal.y * overlap;

          // Reflect velocity with restitution
          const vel2 = new THREE.Vector2(this.ballVel.x, this.ballVel.z);
          const dot = vel2.dot(colNormal);
          if (dot < 0) {
            const impulse = -(1 + wall.restitution) * dot;
            this.ballVel.x += colNormal.x * impulse;
            this.ballVel.z += colNormal.y * impulse;

            // Retain tangential momentum & impart cushion spin for curling bank shots
            const tang = new THREE.Vector2(-colNormal.y, colNormal.x);
            const vTang = vel2.dot(tang);
            this.ballSpin = THREE.MathUtils.clamp(this.ballSpin - vTang * 0.45, -24.0, 24.0);

            if (Math.abs(dot) > 1.5) {
              soundEffects.playWallBounce(Math.min(1.5, Math.abs(dot) / 7));
            }

            if (Math.abs(dot) > 6.5) {
              this.triggerCameraShake(Math.min(0.35, Math.abs(dot) * 0.025));
              this.createPlacementPuff(this.ballPos.x, this.ballPos.z, 0xffffff);
              if (Math.abs(this.ballPos.z) > 8.5) {
                // Goalpost / crossbar rattle!
                this.triggerSlowMotion(0.32, 0.16);
              }
            }
          }
        }
      }
    }
  }

  private handleFlipperCollision(flipper: Flipper) {
    if (!flipper) return;
    const isTop = flipper.pivot.z < 0;
    const angle = flipper.currentAngle;
    const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const pivot2 = new THREE.Vector2(flipper.pivot.x, flipper.pivot.z);
    const ballP = new THREE.Vector2(this.ballPos.x, this.ballPos.z);

    const toBall = new THREE.Vector2().subVectors(ballP, pivot2);
    const proj = toBall.dot(dir);

    // Segment projection along flipper length [0, flipper.length]
    if (proj >= -this.ballRadius * 0.4 && proj <= flipper.length + this.ballRadius * 0.4) {
      const clampedProj = Math.max(0, Math.min(flipper.length, proj));
      const closestP = new THREE.Vector2().addVectors(pivot2, dir.clone().multiplyScalar(clampedProj));
      const distVec = new THREE.Vector2().subVectors(ballP, closestP);
      const dist = distVec.length();

      // Slightly tapered paddle radius from hub (0.42/2) to tip
      const t = clampedProj / flipper.length;
      const currentRadius = THREE.MathUtils.lerp(flipper.width * 0.5, flipper.width * 0.35, t);
      const collisionRadius = this.ballRadius + currentRadius;

      if (dist < collisionRadius) {
        // Normal pointing away from flipper surface toward ball
        let normal: THREE.Vector2;
        if (dist > 0.0001) {
          normal = distVec.clone().normalize();
          if (!isTop) {
            if (this.ballPos.z <= flipper.pivot.z + 0.3 && normal.y > 0.3) {
              normal.y = -Math.abs(normal.y);
              normal.normalize();
            }
          } else {
            if (this.ballPos.z >= flipper.pivot.z - 0.3 && normal.y < -0.3) {
              normal.y = Math.abs(normal.y);
              normal.normalize();
            }
          }
        } else {
          normal = new THREE.Vector2(flipper.isLeft ? 0.35 : -0.35, isTop ? 1.0 : -1.0).normalize();
        }

        // Push ball cleanly out of paddle geometry
        const overlap = collisionRadius - dist;
        this.ballPos.x += normal.x * overlap;
        this.ballPos.z += normal.y * overlap;

        // Flipper surface linear velocity at contact point: V = w * r perpendicular to dir
        const surfaceVel = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(
          clampedProj * flipper.angularVelocity
        );

        // Relative velocity with respect to moving flipper surface
        const vel2 = new THREE.Vector2(this.ballVel.x, this.ballVel.z);
        const relVel = new THREE.Vector2().subVectors(vel2, surfaceVel);
        const dot = relVel.dot(normal);

        // Check if flipper is actively swinging into the pitch
        const isFlippingActive = isTop
          ? (flipper.isLeft && flipper.angularVelocity > 0.15) || (!flipper.isLeft && flipper.angularVelocity < -0.15)
          : (flipper.isLeft && flipper.angularVelocity < -0.15) || (!flipper.isLeft && flipper.angularVelocity > 0.15);

        if (isFlippingActive) {
          // Dynamic launch on active flip!
          const normProj = clampedProj / Math.max(0.1, flipper.length);

          // Scaled strike speed: sweet-spot tip launch (18.0 m/s near pivot up to 29.5 m/s at the tip)
          const baseSpeed = THREE.MathUtils.lerp(18.0, 29.5, normProj);
          const incomingBoost = Math.min(vel2.length() * 0.35, 6.5);
          const strikeSpeed = baseSpeed + incomingBoost;

          // Paddle normal + forward kick trajectory
          const forwardZ = isTop ? 1.0 : -1.0;
          const launchDir = new THREE.Vector2(
            normal.x * 0.72 + (flipper.isLeft ? 0.32 : -0.32) * normProj,
            normal.y * 0.38 + forwardZ * 0.62
          ).normalize();

          this.ballVel.x = launchDir.x * strikeSpeed;
          this.ballVel.z = launchDir.y * strikeSpeed;

          // Extra punch if super power kick is active
          if (this.isPowerKickActive) {
            this.ballVel.multiplyScalar(1.24);
          }

          // Impart authentic curve spin based on tangential impact:
          const sliceSpin = (flipper.isLeft ? 1 : -1) * THREE.MathUtils.lerp(6.0, 24.0, normProj);
          this.ballSpin = sliceSpin;

          soundEffects.playKick(1.25 + normProj * 0.5);
          this.addScore(50);
          this.consecutiveKnockouts = 0;
          this.createPlacementPuff(this.ballPos.x, this.ballPos.z);
          this.triggerCameraShake(0.20 + normProj * 0.16);
        } else {
          // Air hockey paddle deflection when resting or held UP:
          if (dot < 0) {
            const paddleRestitution = 0.82; // lively bounce maintains pace
            const impulse = -(1 + paddleRestitution) * dot;
            this.ballVel.x += normal.x * impulse;
            this.ballVel.z += normal.y * impulse;
            soundEffects.playWallBounce(0.55);
          }
        }
      }
    }
  }

  // ==========================================
  // FIELD PLAYER INTERACTION & AI KICKING
  // ==========================================
  private handlePlayerCollisions() {
    // If penalty kick is active or penalty shot is in flight, other field players CANNOT kick or deflect!
    if (this.isPenaltyPhase || this.penaltyShotActiveTimer > 0) {
      return;
    }

    for (const player of this.fieldPlayers) {
      if (player.isStunned || player.isDragging) continue;

      const pPos = player.group.position;
      const dist = pPos.distanceTo(this.ballPos);

      // 1. ONLY POWER SHOT KNOCKS THEM DOWN!
      if (this.isPowerKickActive && dist < 1.20) {
        this.stunPlayer(player);
        this.addScore(250);
        soundEffects.playBumper(1.5);
        this.createPlacementPuff(pPos.x, pPos.z, 0xff3300);
        player.knockoutCount += 1;

        // Retain momentum with slight ricochet & expend the power shot on this knockdown
        this.ballVel.z = Math.min(-10.0, this.ballVel.z * 0.88);
        this.ballVel.x += (this.ballPos.x - pPos.x) * 3.5;
        this.isPowerKickActive = false;

        if (player.knockoutCount === 1) {
          this.callbacks.onPlacementFeedback?.({
            message: `⚠️ ${player.name} knocked down by Power Shot! (1 hit warning: swap position to avoid cards!)`,
            type: 'warning',
          });
        } else if (player.knockoutCount === 2) {
          player.hasYellowCard = true;
          this.attachCardToPlayer(player, 'yellow');
          this.callbacks.onPlacementFeedback?.({
            message: `🟨 YELLOW CARD! ${player.name} knocked down 2 times by Power Shot! Swap away or next hit is RED CARD!`,
            type: 'warning',
          });
          this.awardPenaltyKick('yellow', player);
        } else if (player.knockoutCount >= 3) {
          this.callbacks.onPlacementFeedback?.({
            message: `🟥 RED CARD EJECTION! ${player.name} took 3 power hits and leaves the game! Team playing with -1 player!`,
            type: 'error',
          });
          this.awardPenaltyKick('red', player);
          this.ejectPlayer(player);
        }

        this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
        continue;
      }

      // 2. PHYSICAL PLAYER COLLISION: Solid Bumper Torso + Intentional Front-Cone Kicking!
      const playerBodyRadius = 0.40;
      const collisionRadius = playerBodyRadius + this.ballRadius; // ~0.78m

      if (dist < collisionRadius) {
        // Vector from player center to ball
        const toBall = new THREE.Vector2(this.ballPos.x - pPos.x, this.ballPos.z - pPos.z);
        const toBallDist = toBall.length();
        const normal = toBallDist > 0.0001 ? toBall.clone().divideScalar(toBallDist) : new THREE.Vector2(0, 1);

        // Separate ball cleanly from player hitbox
        const overlap = collisionRadius - toBallDist;
        this.ballPos.x += normal.x * overlap;
        this.ballPos.z += normal.y * overlap;

        // Player's facing direction vector:
        const facingDir = new THREE.Vector2(
          -Math.sin(player.group.rotation.y),
          -Math.cos(player.group.rotation.y)
        );

        // Check if ball is approaching the player's front kicking cone (~70° half-cone, dot > 0.35)
        const inFrontCone = facingDir.dot(normal) > 0.35;
        const canKick = !player.isKicking && (!player.kickCooldown || player.kickCooldown <= 0);

        if (inFrontCone && canKick) {
          // Ball in front of player's boots and player is ready: STRIKE / KICK!
          player.kickCooldown = 0.20; // Fast reaction time (was 0.55s)
          this.executePlayerKick(player);
          break;
        } else {
          // Ball hit player's side/back, or player kicked recently:
          // BOUNCE SOLIDLY like a crisp elastic pinball bumper / air hockey peg!
          const dotV = this.ballVel.x * normal.x + this.ballVel.z * normal.y;
          if (dotV < 0) {
            const restitution = 0.94; // hyper-bouncy air hockey bumper (was 0.78)
            this.ballVel.x -= (1 + restitution) * dotV * normal.x;
            this.ballVel.z -= (1 + restitution) * dotV * normal.y;
            soundEffects.playBumper(0.95);
            this.createPlacementPuff(this.ballPos.x, this.ballPos.z);
            this.triggerCameraShake(0.15);
          }
        }
      }
    }
  }

  // Award an interactive penalty kick where the user gets moment to place & shoot on time
  public awardPenaltyKick(forcedCard: 'yellow' | 'red' = 'yellow', punishedPlayer?: PlayerCharacter) {
    // Show card (Yellow or Red)
    const card: 'yellow' | 'red' = forcedCard;
    this.penaltyCardType = card;
    this.callbacks.onPenaltyCard?.(card);
    soundEffects.playWhistle();

    this.isPenaltyPhase = true;
    const isShooterUser = this.gameMode === 'team';
    // When CPU plays as Team (user is Pinball), CPU takes 2.2s aiming before striking automatically.
    // When user plays as Team, give full 6.0s tactical shot clock.
    this.penaltyTotalTime = isShooterUser ? 6.0 : 2.2;
    this.penaltyTimeRemaining = this.penaltyTotalTime;

    // Spot the ball on the penalty mark in the penalty box area (Z = 5.2, facing Pinball flippers and goal at Z = 10.5)
    const penaltyBallX = 0;
    const penaltyBallZ = 5.2;
    this.ballPos.set(penaltyBallX, 0.38, penaltyBallZ);
    this.ballVel.set(0, 0, 0);
    this.ballMesh.position.copy(this.ballPos);
    this.createPlacementPuff(penaltyBallX, penaltyBallZ);

    // Show penalty spot ring at Z = 5.2
    if (this.penaltySpotRing) {
      this.penaltySpotRing.position.set(penaltyBallX, 0.04, penaltyBallZ);
      (this.penaltySpotRing.material as THREE.MeshBasicMaterial).opacity = 0.85;
    }

    // Pick EXACTLY ONE unstunned, non-ejected player to take the penalty (Striker first, then Cannon, Midfielder, Defender)
    const rolePriority: PlayerRole[] = ['striker', 'cannon', 'midfielder', 'defender'];
    let kicker: PlayerCharacter | null = null;
    for (const r of rolePriority) {
      const found = this.fieldPlayers.find((p) => !p.isStunned && !p.isEjected && (punishedPlayer ? p.id !== punishedPlayer.id : true) && p.role === r);
      if (found) {
        kicker = found;
        break;
      }
    }
    if (!kicker) {
      kicker = this.fieldPlayers.find((p) => !p.isStunned && !p.isEjected && (punishedPlayer ? p.id !== punishedPlayer.id : true)) ||
               this.fieldPlayers.find((p) => !p.isEjected && (punishedPlayer ? p.id !== punishedPlayer.id : true)) ||
               this.fieldPlayers[0] || null;
    }

    // 1. Save original position of ONLY the designated kicker before stepping up to the spot
    this.penaltySavedPlayerPositions.clear();
    if (kicker) {
      this.penaltySavedPlayerPositions.set(kicker.id, kicker.group.position.clone());
      kicker.isStunned = false;
      kicker.stunStars.visible = false;
      kicker.group.rotation.x = 0;
      kicker.group.position.y = 0;
      this.penaltyKicker = kicker;
      // Position ONLY this one player to shoot the penalty!
      kicker.group.position.set(penaltyBallX, 0, penaltyBallZ - 1.35);
      kicker.group.rotation.y = 0;
      kicker.group.rotation.x = 0;
      this.createPlacementPuff(kicker.group.position.x, kicker.group.position.z);
      this.selectPlayer(kicker.id);
    }

    // All other field players stay strictly in their tactical positions - none are moved out of position!
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());

    this.callbacks.onPenaltyPhaseChange?.({
      isActive: true,
      timeLeft: this.penaltyTimeRemaining,
      totalTime: this.penaltyTotalTime,
      card,
      isShooterUser,
      kickerName: kicker ? kicker.name : 'Striker',
      punishedPlayerName: punishedPlayer ? punishedPlayer.name : undefined,
      cardReason: card === 'yellow' ? '2ND POWER KNOCKOUT' : 'POWER HIT EJECTION (-1 PLAYER)',
    });
  }

  // Restore the kicker back to their position after penalty resolution
  private restorePlayerPositionsAfterPenalty() {
    if (this.penaltySavedPlayerPositions.size === 0) return;

    this.penaltySavedPlayerPositions.forEach((savedPos, id) => {
      const player = this.fieldPlayers.find((p) => p.id === id);
      if (player && !player.isDragging) {
        player.group.position.copy(savedPos);
        player.basePos.copy(savedPos);
        player.group.rotation.x = 0;
        player.group.rotation.y = player.facingAngle;
        this.createPlacementPuff(savedPos.x, savedPos.z);
      }
    });
    this.penaltySavedPlayerPositions.clear();
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());
  }

  // Trigger penalty shot (can be fired on time or early by user)
  public triggerPenaltyShot = () => {
    if (!this.isPenaltyPhase) return;
    this.executePenaltyStrike();
  };

  private executePenaltyStrike() {
    this.isPenaltyPhase = false;
    this.penaltyShotActiveTimer = 2.0; // In-flight immunity: only the 1 penalty kicker kicks!

    if (this.penaltySpotRing) {
      (this.penaltySpotRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    if (this.penaltyAimLine) {
      (this.penaltyAimLine.material as THREE.LineDashedMaterial).opacity = 0;
    }

    soundEffects.playWhistle();
    soundEffects.playKick(2.0);

    let targetX = 0;
    if (this.gameMode === 'team') {
      targetX = THREE.MathUtils.clamp(this.aimTarget.x, -2.1, 2.1);
    } else {
      targetX = Math.sin(performance.now() * 0.003) * 1.8;
    }

    const targetZ = 10.5; // Always the Pinball's net
    const kickDir = new THREE.Vector3(targetX - this.ballPos.x, 0, targetZ - this.ballPos.z).normalize();

    // ONLY the single designated penalty taker strikes the ball!
    if (this.penaltyKicker) {
      this.penaltyKicker.isKicking = true;
      this.penaltyKicker.kickTimer = 0.48;
      this.penaltyKicker.legRight.rotation.x = -1.4;
      this.penaltyKicker.group.rotation.x = 0.45;
      this.penaltyKicker.group.rotation.y = Math.atan2(kickDir.x, kickDir.z);
    }

    // Blast powerful rocket penalty shot straight into Pinball goal!
    const shotSpeed = 28.0;
    this.ballVel.x = kickDir.x * shotSpeed;
    this.ballVel.z = Math.max(22.0, kickDir.z * shotSpeed); // Strict positive guarantee downfield!
    this.isBallInPlay = true;

    this.createPlacementPuff(this.ballPos.x, this.ballPos.z);
    this.callbacks.onPenaltyPhaseChange?.(null);

    // Smoothly restore spectator teammates back to their tactical formation positions
    setTimeout(() => {
      this.restorePlayerPositionsAfterPenalty();
    }, 1200);
  }

  private handleFullTime() {
    this.stats.isGameOver = true;
    this.isBallInPlay = false;
    soundEffects.playWhistle();

    if (this.stats.goals > this.stats.playerGoals) {
      this.stats.winner = 'pinball';
    } else if (this.stats.playerGoals > this.stats.goals) {
      this.stats.winner = 'players';
    } else {
      this.stats.winner = null; // Draw
    }

    this.callbacks.onScoreUpdate(this.stats);
  }

  /**
   * High-IQ geometric wall bank shot calculation off side cushions (X = ±4.15).
   * Calculates incident reflection angles toward target goal (targetNetZ) avoiding obstacles.
   */
  private evaluateWallBankShot(
    origin: THREE.Vector3,
    targetNetZ: number,
    isP1: boolean,
    evalRayClearance: (fromX: number, fromZ: number, toX: number, toZ: number) => { isClear: boolean; minDistance: number }
  ): { viable: boolean; bouncePoint?: THREE.Vector3; kickDir?: THREE.Vector3 } {
    const wallXOptions = [-4.15, 4.15];
    const goalTargetsX = [-1.4, 0.0, 1.4];

    let bestScore = -1;
    let bestBounce: THREE.Vector3 | null = null;
    let bestDir: THREE.Vector3 | null = null;

    for (const wallX of wallXOptions) {
      for (const gx of goalTargetsX) {
        // Virtual goal reflected across wall line X = wallX
        const virtualGoalX = 2 * wallX - gx;
        const denom = virtualGoalX - origin.x;
        if (Math.abs(denom) < 0.001) continue;

        // Intersection t on wall line:
        const t = (wallX - origin.x) / denom;
        if (t <= 0.08 || t >= 0.92) continue;

        const wallZ = origin.z + t * (targetNetZ - origin.z);

        // Physical side wall exists between -8.2 and +8.2
        if (Math.abs(wallZ) > 8.2) continue;

        // Ensure bounce point progresses forward toward target net
        if (isP1 && wallZ >= origin.z - 0.4) continue;
        if (!isP1 && wallZ <= origin.z + 0.4) continue;

        // Leg 1 clearance: origin -> wall bounce point
        const leg1 = evalRayClearance(origin.x, origin.z, wallX, wallZ);
        if (!leg1.isClear) continue;

        // Leg 2 clearance: wall bounce point -> goal target
        const leg2 = evalRayClearance(wallX, wallZ, gx, targetNetZ);
        if (!leg2.isClear) continue;

        const score = leg1.minDistance * 5 + leg2.minDistance * 5;
        if (score > bestScore) {
          bestScore = score;
          bestBounce = new THREE.Vector3(wallX, 0, wallZ);
          bestDir = new THREE.Vector3(wallX - origin.x, 0, wallZ - origin.z).normalize();
        }
      }
    }

    if (bestBounce && bestDir) {
      return { viable: true, bouncePoint: bestBounce, kickDir: bestDir };
    }
    return { viable: false };
  }

  /**
   * Evaluates shooting and passing angles with Soccer IQ:
   * 1. Direct Goal Shot if clear path exists to corners/mouth.
   * 2. High-IQ Wall Bank Shot off side rails if direct path is obstructed.
   * 3. Intentional Pass to open forward teammates, leading them into space.
   * 4. Angled Flank Clearance past defense if heavily marked.
   */
  private computeSmartKickTrajectory(
    kicker: PlayerCharacter,
    isP1: boolean,
    extraPowerMultiplier: number = 1.0
  ): { kickDir: THREE.Vector3; kickSpeed: number } {
    const origin = kicker.group.position;
    const isTwoPlayer = this.gameMode === 'two_player';
    const opponentTeamKey = isTwoPlayer ? (kicker.team === 'p1' ? 'p2' : 'p1') : 'pinball';
    const targetNetZ = isP1 ? -10.5 : 10.5;

    // 1. Gather all active, non-stunned opponents that could block shots
    const activeOpponents = this.fieldPlayers.filter(
      (p) =>
        p.id !== kicker.id &&
        !p.isStunned &&
        !p.isDragging &&
        (isTwoPlayer
          ? p.team === opponentTeamKey
          : isP1
          ? (p.team === 'p2' || p.group.position.z < origin.z - 0.5)
          : (p.team === 'p1' || p.group.position.z > origin.z + 0.5))
    );

    // Multi-segment clearance helper between any two points on the pitch
    const evalRayClearance = (
      fromX: number,
      fromZ: number,
      toX: number,
      toZ: number
    ): { isClear: boolean; minDistance: number } => {
      const rayDir = new THREE.Vector2(toX - fromX, toZ - fromZ);
      const rayLen = rayDir.length();
      if (rayLen < 0.001) return { isClear: true, minDistance: 99 };
      rayDir.normalize();

      let minOpponentDist = 99;
      let isClear = true;

      for (const opp of activeOpponents) {
        const toOpp = new THREE.Vector2(opp.group.position.x - fromX, opp.group.position.z - fromZ);
        const proj = toOpp.dot(rayDir);
        if (proj > 0.35 && proj < rayLen - 0.2) {
          const perpDist = Math.abs(toOpp.x * rayDir.y - toOpp.y * rayDir.x);
          if (perpDist < minOpponentDist) minOpponentDist = perpDist;
          if (perpDist < 1.15) {
            isClear = false;
          }
        }
      }

      // In single player, also check Goalkeeper as shot blocker if shooting toward top goal (Z = -10.5)
      if (this.gameMode !== 'two_player' && isP1 && toZ <= -9.5) {
        const toKeeper = new THREE.Vector2(this.keeperPos.x - fromX, this.keeperPos.z - fromZ);
        const projK = toKeeper.dot(rayDir);
        if (projK > 0.4 && projK < rayLen) {
          const perpDistK = Math.abs(toKeeper.x * rayDir.y - toKeeper.y * rayDir.x);
          if (perpDistK < minOpponentDist) minOpponentDist = perpDistK;
          if (perpDistK < 1.35) {
            isClear = false;
          }
        }
      }

      return { isClear, minDistance: minOpponentDist };
    };

    // Candidate direct goal targets (corners, posts, gap)
    const goalMouthTargets = [
      { x: -1.55, z: targetNetZ, weight: 1.35 },
      { x: 1.55, z: targetNetZ, weight: 1.35 },
      { x: -0.75, z: targetNetZ, weight: 1.1 },
      { x: 0.75, z: targetNetZ, weight: 1.1 },
      { x: 0.0, z: targetNetZ, weight: 1.0 },
    ];

    // Candidate flank channels
    const flankZ = isP1 ? Math.min(origin.z - 4.5, -6.5) : Math.max(origin.z + 4.5, 6.5);
    const flankTargets = [
      { x: -3.2, z: flankZ, weight: 0.95 },
      { x: 3.2, z: flankZ, weight: 0.95 },
    ];

    let chosenTarget = new THREE.Vector3(0, 0, targetNetZ);
    let chosenSpeed = 24.5 * extraPowerMultiplier;
    this.wasLastShotBank = false;

    // Tactical AI Decision Tree
    if (this.gameMode === 'team' && this.aimTarget) {
      // Manual player crosshair aiming in team mode
      chosenTarget.set(THREE.MathUtils.clamp(this.aimTarget.x, -2.1, 2.1), 0, targetNetZ);
      chosenSpeed = 25.5 * extraPowerMultiplier;
    } else {
      // Step A: Evaluate Direct Goal Shots
      let bestDirectScore = -1;
      let bestDirectTarget: { x: number; z: number } | null = null;
      let hasClearDirectShot = false;

      for (const cand of goalMouthTargets) {
        const { isClear, minDistance } = evalRayClearance(origin.x, origin.z, cand.x, cand.z);
        if (isClear) hasClearDirectShot = true;
        const score = (isClear ? 100 : 0) + minDistance * 10 * cand.weight + Math.random() * 2;
        if (score > bestDirectScore) {
          bestDirectScore = score;
          bestDirectTarget = cand;
        }
      }

      const playerIq = kicker.profile?.iq ?? (kicker.role === 'midfielder' ? 94 : kicker.role === 'striker' ? 90 : 85);
      const playerPower = kicker.profile?.power ?? (kicker.role === 'cannon' ? 95 : kicker.role === 'striker' ? 90 : 82);
      const isBankMaster = kicker.profile?.specialTrait === 'bank_master' || playerIq >= 94;

      if (hasClearDirectShot && bestDirectTarget && !isBankMaster) {
        // Direct shot is open! Drill it into the corner!
        chosenTarget.set(bestDirectTarget.x, 0, bestDirectTarget.z);
        chosenSpeed = (20.0 + (playerPower / 100) * 11.5 + Math.random() * 2.0) * extraPowerMultiplier;
        soundEffects.playKick(playerPower > 92 ? 1.9 : 1.5);
      } else {
        // Direct shot is blocked or kicker is Bank Master: CALCULATE INTENTIONAL WALL BANK SHOT!
        const bankShot = this.evaluateWallBankShot(origin, targetNetZ, isP1, evalRayClearance);

        if (bankShot.viable && bankShot.bouncePoint && (playerIq >= 70 || isBankMaster)) {
          // Intentional wall bank shot off cushion!
          chosenTarget.copy(bankShot.bouncePoint);
          chosenSpeed = (20.5 + (playerPower / 100) * 8.5) * extraPowerMultiplier;
          this.wasLastShotBank = true;
          soundEffects.playKick(1.65);
          this.callbacks.onPlacementFeedback?.({
            message: `📐 ${kicker.name} calculated Wall Bank Shot!`,
            type: 'success',
          });
        } else if (kicker.role === 'midfielder' || kicker.role === 'defender') {
          // Bank shot blocked: Check for open forward teammate pass!
          const forwardTeammates = this.fieldPlayers.filter(
            (p) =>
              p.id !== kicker.id &&
              !p.isStunned &&
              !p.isDragging &&
              (isTwoPlayer ? p.team === kicker.team : true) &&
              (isP1 ? p.group.position.z < origin.z - 1.2 : p.group.position.z > origin.z + 1.2)
          );

          let bestTeammate: PlayerCharacter | null = null;
          let bestTeammateScore = -1;

          for (const tm of forwardTeammates) {
            const { isClear, minDistance } = evalRayClearance(origin.x, origin.z, tm.group.position.x, tm.group.position.z);
            if (isClear) {
              const closenessToGoal = isP1 ? -tm.group.position.z : tm.group.position.z;
              const score = minDistance * 10 + closenessToGoal;
              if (score > bestTeammateScore) {
                bestTeammateScore = score;
                bestTeammate = tm;
              }
            }
          }

          if (bestTeammate) {
            // Intentional pass to open teammate leading them into space!
            chosenTarget.copy(bestTeammate.group.position);
            chosenTarget.z += isP1 ? -0.6 : 0.6;
            chosenSpeed = 19.5 * extraPowerMultiplier;
            soundEffects.playKick(1.35);
            this.callbacks.onComboPass?.(this.stats.combo, kicker.name);
          } else {
            // Teammates blocked: Angled Flank Clearance
            let bestFlankScore = -1;
            const allCandidates = [...flankTargets, ...goalMouthTargets];
            for (const cand of allCandidates) {
              const { isClear, minDistance } = evalRayClearance(origin.x, origin.z, cand.x, cand.z);
              const score = (isClear ? 100 : 0) + minDistance * 10 * cand.weight + Math.random() * 2;
              if (score > bestFlankScore) {
                bestFlankScore = score;
                chosenTarget.set(cand.x, 0, cand.z);
              }
            }
            chosenSpeed = 20.0 * extraPowerMultiplier;
            soundEffects.playKick(1.4);
          }
        } else {
          // Striker direct contested shot
          if (bestDirectTarget) {
            chosenTarget.set(bestDirectTarget.x, 0, bestDirectTarget.z);
          }
          chosenSpeed = 24.5 * extraPowerMultiplier;
          soundEffects.playKick(1.55);
        }
      }
    }

    // Direction vector towards chosen target
    const kickDir = new THREE.Vector3().subVectors(chosenTarget, origin).normalize();

    // Ensure forward progression towards opponent's goal without ruining shallow bank shot angles
    if (isP1) {
      if (kickDir.z > -0.10) {
        kickDir.z = -0.22;
        kickDir.normalize();
      }
    } else {
      if (kickDir.z < 0.10) {
        kickDir.z = 0.22;
        kickDir.normalize();
      }
    }

    return { kickDir, kickSpeed: chosenSpeed };
  }

  private executePlayerKick(player: PlayerCharacter, extraPowerMultiplier: number = 1.0) {
    player.isKicking = true;
    const speedStat = player.profile?.speed ?? 80;
    player.kickTimer = Math.max(0.12, 0.42 - (speedStat / 100) * 0.22);

    // Dramatic kick leg windup & body lean so the kick is unmistakably visible
    player.legRight.rotation.x = -1.4; // Windup backswing
    player.group.rotation.x = 0.45;    // Torso lunges boldly forward into the kick!

    // Flash and pulse target ring under player
    player.targetRing.scale.set(2.2, 2.2, 2.2);
    player.ringMat.opacity = 1.0;

    // Dust impact shockwave on grass at player's boots
    this.createPlacementPuff(player.group.position.x, player.group.position.z);

    // Correct goal orientation: P1 attacks top net (-10.5), P2 attacks bottom net (+10.5)
    const isP1 = player.team ? player.team === 'p1' : player.group.position.z >= 0;
    const { kickDir, kickSpeed } = this.computeSmartKickTrajectory(player, isP1, extraPowerMultiplier);

    // Position ball cleanly in front of player's foot without teleportation
    const sep = this.ballRadius + 0.38;
    this.ballPos.x = player.group.position.x + kickDir.x * sep;
    this.ballPos.z = player.group.position.z + kickDir.z * sep;

    this.ballVel.x = kickDir.x * kickSpeed;
    this.ballVel.z = kickDir.z * kickSpeed;

    // Impart natural slice spin for banana curve
    this.ballSpin = (Math.random() - 0.5) * 14.0;

    // Player faces kick direction immediately and animates kicking leg
    player.group.rotation.y = Math.atan2(-kickDir.x, -kickDir.z);
    player.legRight.rotation.x = 1.35;

    this.stats.shots += 1;
  }

  private stunPlayer(player: PlayerCharacter) {
    player.isStunned = true;
    player.stunTimer = 3.5;
    player.stunStars.visible = true;

    // Fall down backwards on grass (like video frame 00:17!)
    player.group.rotation.x = -Math.PI / 2;
    player.group.position.y = 0.2;

    soundEffects.playStunned();
  }

  private updateFieldPlayers(dt: number) {
    const cam = this.gameplayCamera;

    for (const player of this.fieldPlayers) {
      // Decrement kick cooldown timer
      if (player.kickCooldown && player.kickCooldown > 0) {
        player.kickCooldown -= dt;
      }

      // Animate Kicking Leg & Body Lunge
      if (player.isKicking) {
        player.kickTimer -= dt;
        // Fast snap forward with high-velocity follow-through
        player.legRight.rotation.x = THREE.MathUtils.lerp(player.legRight.rotation.x, 1.35, dt * 22);
        player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, 0, dt * 10);
        if (player.kickTimer <= 0) {
          player.isKicking = false;
          player.legRight.rotation.x = 0;
          player.group.rotation.x = 0;
          player.targetRing.scale.set(1.0, 1.0, 1.0);
        }
      }

      // Animate Stunned State
      if (player.isStunned) {
        player.stunTimer -= dt;
        // Rotate spinning stars around head
        player.stunStars.rotation.y += dt * 5.0;

        if (player.stunTimer <= 0) {
          // Get back up!
          player.isStunned = false;
          player.stunStars.visible = false;
          player.group.rotation.x = 0;
          player.group.position.y = 0;
        }
      } else if (!player.isDragging) {
        // Player gently faces ball
        const toBall = new THREE.Vector3().subVectors(this.ballPos, player.group.position);
        toBall.y = 0;
        if (toBall.length() > 0.1) {
          const targetAng = Math.atan2(-toBall.x, -toBall.z);
          player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, targetAng, dt * 4);
        }

        // Pulse selection ring
        const s = 1.0 + Math.sin(performance.now() * 0.006) * 0.08;
        player.targetRing.scale.set(s, s, s);
      }

      // Keep role badge facing camera billboarding
      if (player.roleBadgeMesh) {
        player.roleBadgeMesh.quaternion.copy(cam.quaternion);
      }

      // Keep 3D yellow card facing camera billboarding
      if (player.cardMesh) {
        player.cardMesh.quaternion.copy(cam.quaternion);
        player.cardMesh.rotation.z = -0.15;
      }
    }
  }

  // ==========================================
  // GOALKEEPER AI & DIVING ANIMATION
  // ==========================================
  private triggerGoalkeeperReaction(targetX: number) {
    this.keeperTargetX = Math.max(-1.8, Math.min(1.8, targetX));
    // Dive if shot is fast
    if (Math.abs(this.keeperTargetX - this.keeperPos.x) > 0.5) {
      this.isKeeperDiving = true;
      this.keeperDiveTimer = 0.7;
    }
  }

  private updateGoalkeeper(dt: number) {
    if (this.isKeeperDiving) {
      this.keeperDiveTimer -= dt;
      // Dive lateral translation and body tilt
      this.keeperPos.x = THREE.MathUtils.lerp(this.keeperPos.x, this.keeperTargetX, dt * 9.0);
      const diveSign = Math.sign(this.keeperTargetX - this.keeperPos.x);
      this.keeperGroup.rotation.z = THREE.MathUtils.lerp(this.keeperGroup.rotation.z, diveSign * 1.2, dt * 10);
      this.keeperGroup.position.y = THREE.MathUtils.lerp(this.keeperGroup.position.y, 0.4, dt * 8);

      if (this.keeperDiveTimer <= 0) {
        this.isKeeperDiving = false;
      }
    } else {
      // Natural patrol & tracking ball X (leaves corners accessible for skilled flipper shots)
      const desiredX = Math.max(-1.35, Math.min(1.35, this.ballPos.x * 0.45));
      const keeperSpeed = this.aiDifficulty === 'hard' ? 3.3 : this.aiDifficulty === 'easy' ? 1.9 : 2.5;
      this.keeperPos.x = THREE.MathUtils.lerp(this.keeperPos.x, desiredX, dt * keeperSpeed);
      this.keeperGroup.rotation.z = THREE.MathUtils.lerp(this.keeperGroup.rotation.z, 0, dt * 5);
      this.keeperGroup.position.y = THREE.MathUtils.lerp(this.keeperGroup.position.y, 0, dt * 5);
    }

    this.keeperGroup.position.x = this.keeperPos.x;
  }

  private handleGoalkeeperCollision() {
    if (this.ballPos.z < -8.8 && this.ballPos.z > -10.5 && this.ballVel.z < 0) {
      // 1. Power Kick blasts past keeper into the net!
      if (this.isPowerKickActive) {
        this.triggerGoalkeeperReaction(this.ballPos.x);
        return; // GOAL! Ball passes freely into the net!
      }

      const dxToKeeper = Math.abs(this.ballPos.x - this.keeperPos.x);
      const kDist = this.keeperGroup.position.distanceTo(this.ballPos);
      const ballSpeed = this.ballVel.length();

      // 2. Corner shots & shots placed out of keeper's reach beat the keeper!
      if (dxToKeeper > 0.62 || (Math.abs(this.ballPos.x) > 0.95 && dxToKeeper > 0.42)) {
        this.triggerGoalkeeperReaction(this.ballPos.x);
        return; // Ball passes keeper and scores!
      }

      // 3. Blistering rocket shots (speed > 21 m/s) beat keeper unless hit straight into gloves
      if (ballSpeed > 21.0 && dxToKeeper > 0.32) {
        this.triggerGoalkeeperReaction(this.ballPos.x);
        return; // Ball beats keeper!
      }

      // 4. Save: Only when ball is hit directly at keeper's gloves / chest
      if (kDist < 0.70 && dxToKeeper <= 0.45) {
        soundEffects.playSave();
        this.triggerCameraShake(0.35);
        this.triggerSlowMotion(0.32, 0.20);
        this.stats.saves += 1;
        this.stats.combo = 1;

        // Punch ball back upfield with high-velocity deflection
        this.ballVel.z = Math.abs(this.ballVel.z) * 0.85 + 10.0;
        this.ballVel.x += (Math.random() - 0.5) * 14.0;
        this.ballSpin = (Math.random() - 0.5) * 18.0;
        this.createPlacementPuff(this.ballPos.x, this.ballPos.z, 0x00b894);

        this.callbacks.onScoreUpdate(this.stats);
      }
    }
  }

  // ==========================================
  // GOALS, DRAINS & RESETS
  // ==========================================
  private handleGoalScored() {
    this.isBallInPlay = false;
    this.isPowerKickActive = false;
    this.resetFlippers();
    this.consecutiveKnockouts = 0;
    this.stats.goals += 1; // Pinball scores at top goal!
    this.stats.score += Math.round(1000 * this.stats.combo * this.scoreMultiplier);
    this.stats.combo += 1;
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
    }

    // High-IQ Bank Shot Bonus Award
    if (this.wasLastShotBank) {
      this.stats.bankShots = (this.stats.bankShots || 0) + 1;
      const bankBonus = Math.round(500 * this.scoreMultiplier);
      this.stats.score += bankBonus;
      this.callbacks.onPlacementFeedback?.({
        message: `🎯 BANK SHOT GOAL! +${bankBonus} PTS!`,
        type: 'success',
      });
      this.wasLastShotBank = false;
    }

    // Sound and score graphic in center circle
    soundEffects.playGoal();
    this.triggerCameraShake(0.75);
    this.triggerSlowMotion(0.25, 0.35);
    this.updateCenterCircleCanvas(this.stats.goals);

    // Confetti burst!
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.35 },
      colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c', '#ffffff'],
    });

    this.callbacks.onGoal('pinball', this.stats);
    this.callbacks.onScoreUpdate(this.stats);

    // Game ends when goals score 5 or score exceeds limit
    if (this.stats.goals >= this.stats.maxGoals || this.stats.score >= this.stats.scoreLimit) {
      this.stats.isGameOver = true;
      this.stats.winner = 'pinball';
      this.callbacks.onScoreUpdate(this.stats);
      return;
    }

    // Pinball Mode: Computer automatically rearranges players on every goal!
    if (this.gameMode === 'pinball') {
      this.rearrangePlayersComputer();
    }

    // Reset ball after celebration
    setTimeout(() => {
      if (this.stats.isGameOver || this.stats.isPaused) return;
      this.launchBall(0, 12.0);
    }, 1800);
  }

  private handleBallDrained() {
    this.isBallInPlay = false;
    this.isPowerKickActive = false;
    this.resetFlippers();
    this.consecutiveKnockouts = 0;
    this.stats.playerGoals += 1; // Players score at bottom goal past flippers!
    this.stats.combo = 1;

    // Sound effects for goal
    soundEffects.playGoal();
    soundEffects.playWhistle();
    this.triggerCameraShake(0.75);
    this.triggerSlowMotion(0.25, 0.35);

    // Pull ball smoothly into bottom net
    this.ballVel.set(0, 0, 4.0);

    // Confetti celebration for goal!
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#f39c12', '#e74c3c', '#ffffff', '#3498db'],
    });

    // In pinball mode, computer rearranges players on every goal / ball out
    if (this.gameMode === 'pinball') {
      this.rearrangePlayersComputer();
    }

    this.callbacks.onGoal('players', this.stats);
    this.callbacks.onScoreUpdate(this.stats);

    // Game ends when player goals reach 5
    if (this.stats.playerGoals >= this.stats.maxGoals) {
      this.stats.isGameOver = true;
      this.stats.winner = 'players';
      this.callbacks.onScoreUpdate(this.stats);
      return;
    }

    setTimeout(() => {
      if (this.stats.isGameOver || this.stats.isPaused) return;
      if (this.gameMode === 'team') {
        // In team mode, launch ball from top goal downfield so PC flippers play it
        this.ballPos.set((Math.random() - 0.5) * 2, 0.38, -6.0);
        this.ballVel.set((Math.random() - 0.5) * 3, 0, 8.5);
        this.isBallInPlay = true;
      } else {
        this.launchBall((Math.random() - 0.5) * 2, 12.0);
      }
    }, 1600);
  }

  public launchBall(xOffset = 0, initialVelZ = 12.0) {
    if (this.gameMode === 'home') return;
    this.ballPos.set(xOffset, 0.38, 4.0);
    this.ballVel.set((Math.random() - 0.5) * 5.0, 0, initialVelZ);
    this.ballSpin = (Math.random() - 0.5) * 12.0;
    this.isBallInPlay = true;
    if (this.ballMesh) this.ballMesh.visible = true;
  }

  public grantSecondChance() {
    this.hasUsedSecondChance = true;
    this.stats.isGameOver = false;
    this.stats.winner = null;

    // Extend match time if it expired
    if (this.stats.matchTime <= 0) {
      this.stats.matchTime = 45;
    }

    // Pull opponent 1 goal back so player has a fighting chance
    if (this.stats.playerGoals >= this.stats.maxGoals) {
      this.stats.playerGoals = Math.max(0, this.stats.maxGoals - 1);
    }
    if (this.stats.goals >= this.stats.maxGoals) {
      this.stats.goals = Math.max(0, this.stats.maxGoals - 1);
    }

    this.isBallInPlay = true;
    this.isPowerKickActive = false;
    this.resetFlippers();

    // Spawn ball on player's side of the pitch with lively speed
    if (this.gameMode === 'team') {
      this.ballPos.set((Math.random() - 0.5) * 2, 0.38, -4.5);
      this.ballVel.set((Math.random() - 0.5) * 3, 0, 8.5);
    } else {
      this.ballPos.set(0, 0.38, 2.0);
      this.ballVel.set((Math.random() - 0.5) * 2.5, 0, 7.5);
    }

    if (this.ballMesh) {
      this.ballMesh.position.copy(this.ballPos);
      this.ballMesh.visible = true;
    }

    // Audio & celebratory fanfare for second chance revival
    soundEffects.playWhistle();
    this.triggerCameraShake(0.5);
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ffd700', '#ff9900', '#ffffff'],
    });

    this.callbacks.onScoreUpdate(this.stats);
  }

  public chargeInstantPowerKick() {
    this.isPowerKickActive = true;
    this.lastPowerKickReady = true;
    this.callbacks.onPowerKickAvailabilityChange?.(true);
    soundEffects.playKick();
    this.triggerCameraShake(0.35);
  }

  public restartGame() {
    this.resetFlippers();
    this.hasUsedSecondChance = false;
    if (this.gameMode === 'home') {
      this.isBallInPlay = false;
      this.ballVel.set(0, 0, 0);
      if (this.ballMesh) this.ballMesh.visible = false;
      return;
    }

    this.stats.score = 0;
    this.stats.goals = 0;
    this.stats.playerGoals = 0;
    this.stats.maxGoals = this.targetMaxGoals;
    this.stats.scoreLimit = 10000;
    this.stats.winner = null;
    this.stats.shots = 0;
    this.stats.saves = 0;
    this.stats.combo = 1;
    this.stats.ballsLeft = 3;
    this.stats.matchTime = 120; // 2 minutes max
    this.stats.isGameOver = false;
    this.stats.isPaused = false;
    this.matchTimerAccumulator = 0;
    this.consecutiveKnockouts = 0;
    this.isPenaltyPhase = false;
    this.lastPowerKickReady = false;
    this.callbacks.onPowerKickAvailabilityChange?.(false);
    this.restorePlayerPositionsAfterPenalty();
    if (this.penaltySpotRing) {
      (this.penaltySpotRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    if (this.penaltyAimLine) {
      (this.penaltyAimLine.material as THREE.LineDashedMaterial).opacity = 0;
    }
    this.callbacks.onPenaltyPhaseChange?.(null);

    this.ejectedRoles.clear();
    this.callbacks.onEjectedRolesChange?.([]);
    for (const p of this.fieldPlayers) {
      p.knockoutCount = 0;
      p.hasYellowCard = false;
      p.isEjected = false;
      if (p.cardMesh) {
        p.group.remove(p.cardMesh);
        p.cardMesh = undefined;
      }
    }
    this.callbacks.onPlayersChanged?.(this.getFieldPlayerConfigs());

    this.updateCenterCircleCanvas(0);
    this.callbacks.onScoreUpdate(this.stats);
    soundEffects.playWhistle();

    if (this.container) {
      this.updateCameraForAspect(this.container.clientWidth / this.container.clientHeight);
    }

    if (this.gameMode === 'two_player') {
      this.isTwoPlayerSetupPhase = true;
      this.isP1LockedIn = false;
      this.isP2LockedIn = false;
      this.twoPlayerCountdown = null;
      if (this.twoPlayerCountdownInterval) {
        clearInterval(this.twoPlayerCountdownInterval);
        this.twoPlayerCountdownInterval = null;
      }
      this.ballPos.set(0, 0.38, 0);
      this.ballVel.set(0, 0, 0);
      this.isBallInPlay = false;
      if (this.ballMesh) {
        this.ballMesh.position.set(0, 0.38, 0);
        this.ballMesh.visible = true;
      }
      this.spawnInitialTwoPlayerTeams();
      this.notifyTwoPlayerPhase();
    } else if (this.gameMode === 'team') {
      this.ballPos.set((Math.random() - 0.5) * 2, 0.38, -4.5);
      this.ballVel.set((Math.random() - 0.5) * 3, 0, 9.5);
      this.isBallInPlay = true;
      if (this.ballMesh) this.ballMesh.visible = true;
    } else {
      this.launchBall(0, 7.5);
    }
  }

  // Clear end-game state when user returns to Home screen
  public resetGameOver() {
    this.stats.isGameOver = false;
    this.stats.isPaused = true;
    this.stats.winner = null;
    this.isBallInPlay = false;
    this.ballVel.set(0, 0, 0);
    if (this.ballMesh) {
      this.ballMesh.visible = false;
    }
    this.isPenaltyPhase = false;
    this.restorePlayerPositionsAfterPenalty();
    if (this.penaltySpotRing) {
      (this.penaltySpotRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    if (this.penaltyAimLine) {
      (this.penaltyAimLine.material as THREE.LineDashedMaterial).opacity = 0;
    }
    this.callbacks.onPenaltyPhaseChange?.(null);
    this.callbacks.onScoreUpdate(this.stats);
    this.renderViewports();
  }

  public setScoreMultiplier(multiplier: number) {
    this.scoreMultiplier = Math.max(1.0, multiplier);
  }

  private addScore(pts: number) {
    const boosted = Math.round(pts * this.scoreMultiplier);
    this.stats.score += boosted;
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
    }
    this.callbacks.onScoreUpdate(this.stats);
  }

  // ==========================================
  // VIEWPORT RENDERING (SPLIT / GAMEPLAY / ENGINE)
  // ==========================================
  public setViewMode(mode: CameraViewMode) {
    this.viewMode = mode;
    this.onResize();
  }

  private renderViewports() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.renderer.clear();

    // Direct clean full screen gameplay with calibrated stadium perspective
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.render(this.scene, this.gameplayCamera);
  }

  public onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.renderer.setSize(width, height);
    this.updateCameraForAspect(width / height);
  };

  public destroy() {
    if (this.unsubscribeRoster) {
      this.unsubscribeRoster();
      this.unsubscribeRoster = undefined;
    }
    this.cancelGhostPlacement();
    if (this.kickResetTimeout) {
      clearTimeout(this.kickResetTimeout);
      this.kickResetTimeout = null;
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.teardownPointerEvents();
    window.removeEventListener('resize', this.onResize);
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
