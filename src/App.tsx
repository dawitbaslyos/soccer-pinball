/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  GameMode,
  GameStats,
  PlayerRole,
  FieldPlayerConfig,
  PenaltyState,
  MatchType,
  TOURNAMENT_ROUNDS,
  ActiveScreen,
  TwoPlayerSettings,
  BracketMatch,
  INITIAL_BRACKET_MATCHES,
  TournamentDifficulty,
  TOURNAMENT_DIFFICULTIES,
} from './types';
import { SoccerPinballEngine } from './game/SoccerPinballEngine';
import { TopBar } from './components/TopBar';
import { HomeScreen } from './components/HomeScreen';
import { TournamentHub, sanitizeTournamentTeam } from './components/TournamentHub';
import { TwoPlayerHub } from './components/TwoPlayerHub';
import { PauseMenu } from './components/PauseMenu';
import { TeamToolbar } from './components/TeamToolbar';
import { FlipperControls } from './components/FlipperControls';
import { GoalFlash } from './components/GoalFlash';
import { GameOverView } from './components/GameOverView';
import { PenaltyBanner } from './components/PenaltyBanner';
import { PenaltyKickOverlay } from './components/PenaltyKickOverlay';
import { TwoPlayerTacticsOverlay } from './components/TwoPlayerTacticsOverlay';
import { TwoPlayerFlipperControls } from './components/TwoPlayerFlipperControls';
import { SecondChanceModal } from './components/SecondChanceModal';
import { ShopScreen } from './components/ShopScreen';
import { ballSkinManager } from './services/BallSkinManager';
import { platformSDK } from './services/PlatformSDK';
import { leaderboardService } from './services/LeaderboardService';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SoccerPinballEngine | null>(null);

  // Active Screen View: 'home' | 'tournament_hub' | 'two_player_hub' | 'gameplay'
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');

  // Core Game Mode: 'home' | 'pinball' | 'team' | 'two_player'
  const [gameMode, setGameMode] = useState<GameMode>('home');
  const [matchType, setMatchType] = useState<MatchType>('quick');
  const [tournamentRoundNumber, setTournamentRoundNumber] = useState<number>(1);
  const [tournamentUserRole, setTournamentUserRole] = useState<'pinball' | 'team'>('pinball');
  const [tournamentDifficulty, setTournamentDifficulty] = useState<TournamentDifficulty>('standard');
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>(INITIAL_BRACKET_MATCHES);
  const [activeTournamentMatch, setActiveTournamentMatch] = useState<BracketMatch | null>(null);
  const [twoPlayerSettings, setTwoPlayerSettings] = useState<TwoPlayerSettings>({
    targetGoals: 5,
    matchDurationSeconds: 120,
  });

  const [showGoalFlash, setShowGoalFlash] = useState<boolean>(false);
  const [goalScorer, setGoalScorer] = useState<'pinball' | 'players'>('pinball');

  const currentTournamentRound = useMemo(() => {
    return (
      TOURNAMENT_ROUNDS.find((r) => r.roundNumber === tournamentRoundNumber) ||
      TOURNAMENT_ROUNDS[0]
    );
  }, [tournamentRoundNumber]);

  // Penalty Card State (referee card banner)
  const [penaltyCard, setPenaltyCard] = useState<{ show: boolean; card: 'yellow' | 'red' }>({
    show: false,
    card: 'yellow',
  });

  // Interactive Penalty Kick Placement & Shot State
  const [penaltyState, setPenaltyState] = useState<PenaltyState | null>(null);

  // Player Placement State (used in 'team' mode)
  const [selectedPlayer, setSelectedPlayer] = useState<FieldPlayerConfig | null>(null);
  const [pendingPlacementRole, setPendingPlacementRole] = useState<PlayerRole | null>(null);
  const [ejectedRoles, setEjectedRoles] = useState<PlayerRole[]>([]);
  const [isPowerKickReady, setIsPowerKickReady] = useState<boolean>(false);
  const [fieldPlayers, setFieldPlayers] = useState<FieldPlayerConfig[]>([]);
  const [twoPlayerPhase, setTwoPlayerPhase] = useState<{
    isSetup: boolean;
    p1Locked: boolean;
    p2Locked: boolean;
    countdown: number | null;
  }>({
    isSetup: true,
    p1Locked: false,
    p2Locked: false,
    countdown: null,
  });
  const [placementFeedback, setPlacementFeedback] = useState<{
    message: string;
    type: 'warning' | 'error' | 'success';
  } | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  // Rewarded Ads & Progression Economy (CrazyGames Phase 2)
  const [showSecondChance, setShowSecondChance] = useState<boolean>(false);
  const matchContextRef = useRef({ matchType, gameMode, tournamentRoundNumber });
  matchContextRef.current = { matchType, gameMode, tournamentRoundNumber };

  // Leaderboard & Player Identity (CrazyGames Phase 3)
  const [leaderboardStats, setLeaderboardStats] = useState(() => leaderboardService.getStats());

  const handleUpdatePlayerName = useCallback((name: string) => {
    leaderboardService.setPlayerName(name);
    setLeaderboardStats(leaderboardService.getStats());
  }, []);

  const handleSelectCountry = useCallback((country: string) => {
    leaderboardService.setPlayerCountry(country);
    setLeaderboardStats(leaderboardService.getStats());
  }, []);

  const handlePlacementFeedback = useCallback(
    (fb: { message: string; type: 'warning' | 'error' | 'success' }) => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
      setPlacementFeedback(fb);
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setPlacementFeedback(null);
      }, 2400);
    },
    []
  );

  // Game Stats (2 minutes max match = 120 seconds)
  const [stats, setStats] = useState<GameStats>({
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
  });

  // Goal celebration flash
  const handleGoal = useCallback((scorer: 'pinball' | 'players', newStats: GameStats) => {
    platformSDK.happytime();
    setGoalScorer(scorer);
    setStats((prev) => ({ ...prev, ...newStats }));
    setShowGoalFlash(true);

    if (scorer === 'pinball') {
      leaderboardService.recordGoalScored();
      setLeaderboardStats(leaderboardService.getStats());
    }

    setTimeout(() => {
      setShowGoalFlash(false);
    }, 1600);
  }, []);

  // Penalty Card trigger
  const handlePenaltyCard = useCallback((card: 'yellow' | 'red') => {
    setPenaltyCard({ show: true, card });
    setTimeout(() => {
      setPenaltyCard((prev) => ({ ...prev, show: false }));
    }, 2200);
  }, []);

  // Initialize 3D Engine & Platform SDK
  useEffect(() => {
    // Initialize CrazyGames SDK v3 (with dev fallback)
    platformSDK.init().catch(console.error);

    // Auto-pause game on tab blur or ad display (CrazyGames requirement)
    const unsubPause = platformSDK.onPauseRequired(() => {
      if (engineRef.current && !engineRef.current.isPaused()) {
        engineRef.current.setPaused(true);
        setStats((prev) => ({ ...prev, isPaused: true }));
        platformSDK.gameplayStop();
      }
    });

    if (!containerRef.current) {
      return () => {
        unsubPause();
      };
    }

    const engine = new SoccerPinballEngine(containerRef.current, {
      onScoreUpdate: (newStats) => {
        setStats((prev) => {
          if (!prev.isGameOver && newStats.isGameOver) {
            const { matchType: curMatchType, gameMode: curGameMode, tournamentRoundNumber: curRound } = matchContextRef.current;
            const isSinglePlayer = curMatchType !== 'two_player';
            const isLoss =
              (curGameMode === 'pinball' && newStats.winner !== 'pinball') ||
              (curGameMode === 'team' && newStats.winner !== 'players') ||
              (curMatchType === 'tournament' && newStats.winner !== 'pinball');

            // Record match result into Leaderboard & Streak tracking
            const isWin = !isLoss;
            if (curMatchType === 'tournament' && isWin && curRound === 3) {
              leaderboardService.recordWorldCupVictory();
            }
            leaderboardService.recordMatchResult(isWin, newStats.score, newStats.goals);
            setLeaderboardStats(leaderboardService.getStats());

            if (isSinglePlayer && isLoss && engineRef.current && !engineRef.current.hasUsedSecondChance) {
              setShowSecondChance(true);
            }
          }
          return { ...prev, ...newStats };
        });
      },
      onGoal: (scorer, newStats) => {
        handleGoal(scorer, newStats);
      },
      onBallLost: () => {
        // Handled in engine stats
      },
      onPlayerSelected: (player) => {
        setSelectedPlayer(player);
      },
      onPenaltyCard: (card) => {
        handlePenaltyCard(card);
      },
      onPenaltyPhaseChange: (penalty) => {
        setPenaltyState(penalty);
      },
      onPowerKickAvailabilityChange: (isReady) => {
        setIsPowerKickReady(isReady);
      },
      onPlayersChanged: (players) => {
        setFieldPlayers(players);
      },
      onEjectedRolesChange: (roles) => {
        setEjectedRoles(roles);
      },
      onPlacementFeedback: (fb) => {
        handlePlacementFeedback(fb);
      },
      onTwoPlayerPhaseChange: (phase) => {
        setTwoPlayerPhase(phase);
      },
    });

    setFieldPlayers(engine.getFieldPlayerConfigs());
    engine.setGameMode('home');
    engine.setBallSkin(ballSkinManager.getActiveSkin().id);
    engineRef.current = engine;

    return () => {
      unsubPause();
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleGoal, handlePenaltyCard]);

  // Mode Selection
  const handleSelectQuickMode = (mode: 'pinball' | 'team') => {
    platformSDK.gameplayStart();
    setShowSecondChance(false);
    setMatchType('quick');
    engineRef.current?.setAiDifficulty('medium');
    engineRef.current?.setMaxGoals(5);
    engineRef.current?.setScoreMultiplier(leaderboardService.getStreakScoreMultiplier());

    setGameMode(mode);
    setActiveScreen('gameplay');
    setPendingPlacementRole(null);
    setSelectedPlayer(null);
    setPenaltyState(null);
    setIsPowerKickReady(false);
    setStats((prev) => ({
      ...prev,
      isGameOver: false,
      isPaused: false,
      winner: null,
      maxGoals: 5,
    }));
    if (engineRef.current) {
      engineRef.current.setGameMode(mode);
      engineRef.current.setPaused(false);
      engineRef.current.restartGame();
    }
  };

  const handleKickoffTournamentMatch = (match: BracketMatch, hasBooster = false) => {
    platformSDK.gameplayStart();
    setShowSecondChance(false);

    const roundNum = match.round;
    setTournamentRoundNumber(roundNum);
    const rd =
      TOURNAMENT_ROUNDS.find((r) => r.roundNumber === roundNum) ||
      TOURNAMENT_ROUNDS[0];

    const isTeamAPlayer = match.teamA.isPlayer;
    const rawOpponent = isTeamAPlayer ? match.teamB : match.teamA;
    const opponentTeam = sanitizeTournamentTeam(rawOpponent, leaderboardStats.playerCountry);

    const sanitizedMatch: BracketMatch = {
      ...match,
      teamA: isTeamAPlayer ? match.teamA : opponentTeam,
      teamB: isTeamAPlayer ? opponentTeam : match.teamB,
    };
    setActiveTournamentMatch(sanitizedMatch);

    const diffConfig = TOURNAMENT_DIFFICULTIES[tournamentDifficulty];
    const resolvedDiff: 'easy' | 'medium' | 'hard' =
      tournamentDifficulty === 'legend'
        ? 'hard'
        : tournamentDifficulty === 'pro'
        ? 'hard'
        : (opponentTeam.difficulty || rd.aiDifficulty || 'medium');

    setMatchType('tournament');
    setGameMode('two_player');
    setActiveScreen('gameplay');
    setPendingPlacementRole(null);
    setSelectedPlayer(null);
    setPenaltyState(null);
    setIsPowerKickReady(false);
    setTwoPlayerPhase({
      isSetup: true,
      p1Locked: false,
      p2Locked: true,
      countdown: null,
    });
    setStats((prev) => ({
      ...prev,
      score: 0,
      goals: 0,
      playerGoals: 0,
      isGameOver: false,
      isPaused: false,
      winner: null,
      maxGoals: match.targetGoals || 5,
    }));
    if (engineRef.current) {
      engineRef.current.setMaxGoals(match.targetGoals || 5);
      const totalMultiplier = leaderboardService.getStreakScoreMultiplier() * diffConfig.scoreMultiplier;
      engineRef.current.setScoreMultiplier(totalMultiplier);
      engineRef.current.setP2Cpu(
        true,
        resolvedDiff,
        opponentTeam.name,
        opponentTeam.badge,
        opponentTeam.colors
      );
      engineRef.current.setGameMode('two_player');
      engineRef.current.setPaused(false);
      if (hasBooster) {
        engineRef.current.chargeInstantPowerKick();
      }
    }
  };

  const handleStartTwoPlayerMatch = () => {
    platformSDK.gameplayStart();
    setShowSecondChance(false);
    setActiveTournamentMatch(null);
    engineRef.current?.setMaxGoals(twoPlayerSettings.targetGoals);
    engineRef.current?.setP2Cpu(false);
    engineRef.current?.setScoreMultiplier(leaderboardService.getStreakScoreMultiplier());
    setMatchType('two_player');
    setGameMode('two_player');
    setActiveScreen('gameplay');
    setPendingPlacementRole(null);
    setSelectedPlayer(null);
    setPenaltyState(null);
    setIsPowerKickReady(false);
    setTwoPlayerPhase({
      isSetup: true,
      p1Locked: false,
      p2Locked: false,
      countdown: null,
    });
    setStats((prev) => ({
      ...prev,
      score: 0,
      goals: 0,
      playerGoals: 0,
      isGameOver: false,
      isPaused: false,
      winner: null,
      maxGoals: twoPlayerSettings.targetGoals,
    }));
    if (engineRef.current) {
      engineRef.current.setGameMode('two_player');
      engineRef.current.setPaused(false);
      engineRef.current.restartGame();
    }
  };

  const updateBracketOnWin = useCallback(() => {
    setBracketMatches((prevMatches) => {
      const updated = [...prevMatches];
      if (tournamentRoundNumber === 1) {
        // QF 1
        const qf1 = updated.findIndex((m) => m.id === 'qf-1');
        if (qf1 !== -1) {
          updated[qf1] = {
            ...updated[qf1],
            status: 'completed',
            winner: 'A',
            teamA: { ...updated[qf1].teamA, score: Math.max(5, stats.goals) },
            teamB: { ...updated[qf1].teamB, score: Math.min(4, stats.playerGoals) },
          };
        }
        // Simulate QF 2
        const qf2 = updated.findIndex((m) => m.id === 'qf-2');
        if (qf2 !== -1) {
          updated[qf2] = {
            ...updated[qf2],
            status: 'completed',
            winner: 'A',
            teamA: { ...updated[qf2].teamA, score: 5 },
            teamB: { ...updated[qf2].teamB, score: 3 },
          };
        }
        // Simulate QF 3
        const qf3 = updated.findIndex((m) => m.id === 'qf-3');
        if (qf3 !== -1) {
          updated[qf3] = {
            ...updated[qf3],
            status: 'completed',
            winner: 'A',
            teamA: { ...updated[qf3].teamA, score: 5 },
            teamB: { ...updated[qf3].teamB, score: 4 },
          };
        }
        // Simulate QF 4
        const qf4 = updated.findIndex((m) => m.id === 'qf-4');
        if (qf4 !== -1) {
          updated[qf4] = {
            ...updated[qf4],
            status: 'completed',
            winner: 'B',
            teamA: { ...updated[qf4].teamA, score: 2 },
            teamB: { ...updated[qf4].teamB, score: 5 },
          };
        }
        // SF 1: YOU vs Germany
        const sf1 = updated.findIndex((m) => m.id === 'sf-1');
        if (sf1 !== -1) {
          updated[sf1] = {
            ...updated[sf1],
            status: 'active',
            teamA: { name: 'YOU', badge: '⭐', isPlayer: true, flag: '⭐' },
            teamB: {
              name: 'Germany',
              badge: '🇩🇪',
              flag: '🇩🇪',
              tactics: 'Die Mannschaft • Physical Midfield & Counter-Press',
              difficulty: 'medium',
              colors: { jersey: 0xffffff, shorts: 0x111111 },
            },
          };
        }
        // SF 2: Brazil vs Argentina
        const sf2 = updated.findIndex((m) => m.id === 'sf-2');
        if (sf2 !== -1) {
          updated[sf2] = {
            ...updated[sf2],
            status: 'upcoming',
            teamA: {
              name: 'Brazil',
              badge: '🇧🇷',
              flag: '🇧🇷',
              tactics: 'Seleção • Explosive Flank Attacks & Joga Bonito',
              difficulty: 'medium',
              colors: { jersey: 0xfed100, shorts: 0x002776 },
            },
            teamB: {
              name: 'Argentina',
              badge: '🇦🇷',
              flag: '🇦🇷',
              tactics: 'La Albiceleste • World Champions • Relentless Defense',
              difficulty: 'hard',
              colors: { jersey: 0x75aadb, shorts: 0x000000 },
            },
          };
        }
      } else if (tournamentRoundNumber === 2) {
        // SF 1
        const sf1 = updated.findIndex((m) => m.id === 'sf-1');
        if (sf1 !== -1) {
          updated[sf1] = {
            ...updated[sf1],
            status: 'completed',
            winner: 'A',
            teamA: { ...updated[sf1].teamA, score: Math.max(5, stats.goals) },
            teamB: { ...updated[sf1].teamB, score: Math.min(4, stats.playerGoals) },
          };
        }
        // Simulate SF 2: Argentina edges Brazil 5 - 4
        const sf2 = updated.findIndex((m) => m.id === 'sf-2');
        if (sf2 !== -1) {
          updated[sf2] = {
            ...updated[sf2],
            status: 'completed',
            winner: 'B',
            teamA: { ...updated[sf2].teamA, score: 4 },
            teamB: { ...updated[sf2].teamB, score: 5 },
          };
        }
        // Cup Final: YOU vs Argentina
        const fin1 = updated.findIndex((m) => m.id === 'fin-1');
        if (fin1 !== -1) {
          updated[fin1] = {
            ...updated[fin1],
            status: 'active',
            teamA: { name: 'YOU', badge: '⭐', isPlayer: true, flag: '⭐' },
            teamB: {
              name: 'Argentina',
              badge: '🇦🇷',
              flag: '🇦🇷',
              tactics: 'La Albiceleste • World Champions • Rapid Reflexes',
              difficulty: 'hard',
              colors: { jersey: 0x75aadb, shorts: 0x000000 },
            },
          };
        }
      } else if (tournamentRoundNumber === 3) {
        const fin1 = updated.findIndex((m) => m.id === 'fin-1');
        if (fin1 !== -1) {
          updated[fin1] = {
            ...updated[fin1],
            status: 'completed',
            winner: 'A',
            teamA: { ...updated[fin1].teamA, score: Math.max(5, stats.goals) },
            teamB: { ...updated[fin1].teamB, score: Math.min(4, stats.playerGoals) },
          };
        }
      }
      return updated;
    });
  }, [tournamentRoundNumber, stats.goals, stats.playerGoals]);

  const handleNextTournamentRound = () => {
    updateBracketOnWin();
    const nextRound = Math.min(3, tournamentRoundNumber + 1);
    setTournamentRoundNumber(nextRound);
    const nextMatch =
      bracketMatches.find(
        (m) =>
          m.round === nextRound &&
          (m.teamA.isPlayer || m.teamB.isPlayer || m.status === 'active')
      ) || bracketMatches[0];

    platformSDK.requestMidgameAd({
      adFinished: () => {
        handleKickoffTournamentMatch(nextMatch);
      },
      adError: () => {
        handleKickoffTournamentMatch(nextMatch);
      },
    });
  };

  const handleViewTournamentBracket = () => {
    const isUserWinner =
      (gameMode === 'pinball' && stats.winner === 'pinball') ||
      (gameMode === 'team' && stats.winner === 'players') ||
      (gameMode === 'two_player' && stats.winner === 'pinball');
    if (isUserWinner) {
      updateBracketOnWin();
      if (tournamentRoundNumber < 3) {
        setTournamentRoundNumber((prev) => prev + 1);
      }
    }
    setActiveScreen('tournament_hub');
  };

  const handleResetTournament = () => {
    setBracketMatches(INITIAL_BRACKET_MATCHES);
    setTournamentRoundNumber(1);
  };

  // Pause toggle
  const handleTogglePause = useCallback(() => {
    if (!engineRef.current) return;
    const isNowPaused = engineRef.current.togglePause();
    setStats((prev) => ({ ...prev, isPaused: isNowPaused }));
    if (isNowPaused) {
      platformSDK.gameplayStop();
    } else {
      platformSDK.gameplayStart();
    }
  }, []);

  // Keyboard Handlers for Flippers, Power Kick & Penalty Strike
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameMode === 'home') return;
      if (e.repeat) return;

      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        handleTogglePause();
        return;
      }

      // If in penalty kick phase: Space strikes the ball immediately on time
      if (penaltyState?.isActive) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          engineRef.current?.triggerPenaltyShot();
          return;
        }
      }

      // 1. Two-Player & Tournament Mode
      if (gameMode === 'two_player') {
        const isTournamentOrCpu = matchType === 'tournament' || engineRef.current?.isP2Cpu;

        if (isTournamentOrCpu) {
          // In Tournament mode (Solo vs CPU): player can use ALL controls (A/D or Arrows or Space)
          if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
            engineRef.current?.setLeftFlipper(true);
          }
          if (e.code === 'KeyD' || e.code === 'ArrowRight') {
            engineRef.current?.setRightFlipper(true);
          }
          if (e.code === 'ArrowDown' || e.code === 'Space') {
            e.preventDefault();
            engineRef.current?.triggerActionKick(false, 'flipper');
          }
          return;
        }

        // Shared keyboard 2-Player Versus:
        // Player 1 (Bottom Flippers & Power Kick): Arrow keys
        if (e.code === 'ArrowLeft') {
          engineRef.current?.setLeftFlipper(true);
        }
        if (e.code === 'ArrowRight') {
          engineRef.current?.setRightFlipper(true);
        }
        if (e.code === 'ArrowDown') {
          engineRef.current?.triggerActionKick(false, 'flipper');
        }

        // Player 2 (Top Flippers / Squad): A / D / Space
        if (e.code === 'KeyA') {
          engineRef.current?.setP2LeftFlipper(true);
        }
        if (e.code === 'KeyD') {
          engineRef.current?.setP2RightFlipper(true);
        }
        if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'KeyS') {
          e.preventDefault();
          engineRef.current?.triggerActionKick(false, 'team');
        }
        return;
      }

      // 2. Team mode: Space triggers Team Power Kick at Pinball!
      if (gameMode === 'team') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          engineRef.current?.triggerActionKick();
        }
        return;
      }

      // 3. Pinball mode: user controls pinball flippers
      if (gameMode === 'pinball') {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
          engineRef.current?.setLeftFlipper(true);
        }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') {
          engineRef.current?.setRightFlipper(true);
        }
        if (e.code === 'Space') {
          e.preventDefault();
          engineRef.current?.triggerActionKick();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gameMode === 'two_player') {
        const isTournamentOrCpu = matchType === 'tournament' || engineRef.current?.isP2Cpu;

        if (isTournamentOrCpu) {
          if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
            engineRef.current?.setLeftFlipper(false);
          }
          if (e.code === 'KeyD' || e.code === 'ArrowRight') {
            engineRef.current?.setRightFlipper(false);
          }
          return;
        }

        if (e.code === 'ArrowLeft') {
          engineRef.current?.setLeftFlipper(false);
        }
        if (e.code === 'ArrowRight') {
          engineRef.current?.setRightFlipper(false);
        }
        if (e.code === 'KeyA') {
          engineRef.current?.setP2LeftFlipper(false);
        }
        if (e.code === 'KeyD') {
          engineRef.current?.setP2RightFlipper(false);
        }
        return;
      }

      if (gameMode === 'pinball') {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
          engineRef.current?.setLeftFlipper(false);
        }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') {
          engineRef.current?.setRightFlipper(false);
        }
        if (e.code === 'Space') {
          engineRef.current?.resetFlippers();
        }
      }
    };

    const handleBlur = () => {
      engineRef.current?.resetFlippers();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameMode, handleTogglePause, penaltyState]);

  // Aim point updates on mouse movement
  const handleMouseMove = (e: React.MouseEvent) => {
    engineRef.current?.setAimPoint(e.clientX, e.clientY);
  };

  // Flipper and kick controls
  const handleLeftFlipperDown = () => engineRef.current?.setLeftFlipper(true);
  const handleLeftFlipperUp = () => engineRef.current?.setLeftFlipper(false);
  const handleRightFlipperDown = () => engineRef.current?.setRightFlipper(true);
  const handleRightFlipperUp = () => engineRef.current?.setRightFlipper(false);
  const handleActionKick = () => engineRef.current?.triggerActionKick();

  // Restart match
  const handleRestart = () => {
    const wasGameOver = stats.isGameOver;

    const executeRestart = () => {
      setShowSecondChance(false);
      setPendingPlacementRole(null);
      setSelectedPlayer(null);
      setPenaltyState(null);
      setEjectedRoles([]);
      setIsPowerKickReady(false);
      setStats((prev) => ({
        ...prev,
        score: 0,
        goals: 0,
        playerGoals: 0,
        isGameOver: false,
        isPaused: false,
        winner: null,
      }));
      platformSDK.gameplayStart();
      engineRef.current?.setScoreMultiplier(leaderboardService.getStreakScoreMultiplier());
      if (matchType === 'tournament') {
        const rd =
          TOURNAMENT_ROUNDS.find((r) => r.roundNumber === tournamentRoundNumber) ||
          TOURNAMENT_ROUNDS[0];
        const opp = activeTournamentMatch
          ? activeTournamentMatch.teamA.isPlayer
            ? activeTournamentMatch.teamB
            : activeTournamentMatch.teamA
          : undefined;
        const resolvedDiff = opp?.difficulty || rd.aiDifficulty || 'medium';

        setTwoPlayerPhase({
          isSetup: true,
          p1Locked: false,
          p2Locked: true,
          countdown: null,
        });
        engineRef.current?.setP2Cpu(
          true,
          resolvedDiff,
          opp?.name,
          opp?.badge,
          opp?.colors
        );
        engineRef.current?.setGameMode('two_player');
        engineRef.current?.restartGame();
      } else if (matchType === 'two_player') {
        engineRef.current?.setP2Cpu(false);
        engineRef.current?.setMaxGoals(twoPlayerSettings.targetGoals);
        engineRef.current?.setGameMode('two_player');
        engineRef.current?.restartGame();
      } else {
        engineRef.current?.restartGame();
      }
    };

    if (wasGameOver) {
      platformSDK.requestMidgameAd({
        adFinished: executeRestart,
        adError: executeRestart,
      });
    } else {
      executeRestart();
    }
  };

  // Rewarded Ad handlers for Second Chance revival
  const handleWatchSecondChanceAd = () => {
    platformSDK.requestRewardedAd({
      adFinished: () => {},
      adError: () => {
        setShowSecondChance(false);
      },
      rewardGranted: () => {
        setShowSecondChance(false);
        engineRef.current?.grantSecondChance();
      },
    });
  };

  const handleDeclineSecondChance = () => {
    setShowSecondChance(false);
  };

  // Switch mode from pause menu
  const handleSwitchMode = (nextMode: GameMode) => {
    setShowSecondChance(false);
    setGameMode(nextMode);
    setPendingPlacementRole(null);
    setSelectedPlayer(null);
    setPenaltyState(null);
    setEjectedRoles([]);
    setIsPowerKickReady(false);
    setStats((prev) => ({
      ...prev,
      isGameOver: false,
      isPaused: false,
      winner: null,
    }));
    if (engineRef.current) {
      engineRef.current.setGameMode(nextMode);
      engineRef.current.setPaused(false);
      platformSDK.gameplayStart();
    }
  };

  // Return to home screen
  const handleGoHome = () => {
    platformSDK.gameplayStop();
    setShowSecondChance(false);
    setActiveScreen('home');
    setGameMode('home');
    setPendingPlacementRole(null);
    setSelectedPlayer(null);
    setPenaltyState(null);
    setEjectedRoles([]);
    setIsPowerKickReady(false);
    setStats((prev) => ({
      ...prev,
      isGameOver: false,
      isPaused: true,
      winner: null,
    }));
    if (engineRef.current) {
      engineRef.current.resetGameOver();
      engineRef.current.setGameMode('home');
    }
  };

  // Team Placement Handlers (for 'team' mode)
  const handleSelectPendingRole = (role: PlayerRole | null) => {
    setPendingPlacementRole(role);
    engineRef.current?.setPendingPlacementRole(role);
  };

  const handleAddPlayer = (role: PlayerRole) => {
    engineRef.current?.addPlayer(role);
  };

  const handleRotatePlayer = (id: string, deltaRad: number) => {
    engineRef.current?.rotatePlayer(id, deltaRad);
  };

  const handleRemovePlayer = (id: string) => {
    engineRef.current?.removePlayer(id);
  };

  const handleClearPlayers = () => {
    engineRef.current?.clearAllPlayers();
  };

  const handleResetDefault = () => {
    engineRef.current?.resetDefaultFormation();
  };

  // 3D Mascot Drag & Drop onto Pitch
  const handleStartDragRole = useCallback(
    (role: PlayerRole, clientX: number, clientY: number) => {
      if (!engineRef.current) return;
      const started = engineRef.current.startGhostPlacement(role, clientX, clientY);
      if (!started) return;

      let hasMoved = false;
      const startX = clientX;
      const startY = clientY;

      const onPointerMove = (e: PointerEvent) => {
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (dist > 8) {
          hasMoved = true;
        }
        engineRef.current?.updateGhostPlacement(e.clientX, e.clientY);
      };

      const onPointerUp = (e: PointerEvent) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);

        if (hasMoved) {
          engineRef.current?.finishGhostPlacement(e.clientX, e.clientY);
        } else {
          // Tap / click without dragging: arm pending placement
          engineRef.current?.cancelGhostPlacement();
          handleSelectPendingRole(role);
        }
      };

      const onPointerCancel = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        engineRef.current?.cancelGhostPlacement();
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    },
    []
  );

  return (
    <main
      id="soccer-pinball-root"
      onMouseMove={handleMouseMove}
      className="relative w-screen h-screen overflow-hidden bg-black font-sans select-none"
    >
      {/* Top Bar: Title, Score, Match Time (2 min max), and Pause Icon (Only during active gameplay - clean appearance on match kickoff) */}
      {activeScreen === 'gameplay' && !(gameMode === 'two_player' && twoPlayerPhase.isSetup) && (
        <TopBar
          score={stats.score}
          goals={stats.goals}
          playerGoals={stats.playerGoals}
          matchTime={stats.matchTime}
          isPaused={stats.isPaused}
          gameMode={gameMode}
          matchType={matchType}
          tournamentRound={currentTournamentRound}
          activeTournamentMatch={activeTournamentMatch}
          playerName={leaderboardStats.playerName}
          playerCountry={leaderboardStats.playerCountry}
          onTogglePause={handleTogglePause}
        />
      )}

      {/* 3D WebGL Canvas */}
      <div
        id="pinball-canvas-container"
        ref={containerRef}
        className="w-full h-full cursor-crosshair"
      />

      {/* Screen 1: Home Screen */}
      {activeScreen === 'home' && (
        <HomeScreen
          onSelectQuickMode={handleSelectQuickMode}
          onOpenTournament={() => setActiveScreen('tournament_hub')}
          onOpenTwoPlayer={handleStartTwoPlayerMatch}
          onOpenShop={() => setActiveScreen('shop')}
          currentStreak={leaderboardStats.currentStreak}
          playerName={leaderboardStats.playerName}
          playerCountry={leaderboardStats.playerCountry}
          onUpdatePlayerName={handleUpdatePlayerName}
          onSelectCountry={handleSelectCountry}
        />
      )}

      {/* Screen 2: Dedicated Tournament Hub Page */}
      {activeScreen === 'tournament_hub' && (
        <TournamentHub
          bracketMatches={bracketMatches}
          currentRoundNumber={tournamentRoundNumber}
          userRole={tournamentUserRole}
          onSelectRole={setTournamentUserRole}
          onKickoffMatch={handleKickoffTournamentMatch}
          onResetTournament={handleResetTournament}
          onBackToHome={handleGoHome}
          playerName={leaderboardStats.playerName}
          playerCountry={leaderboardStats.playerCountry}
          difficulty={tournamentDifficulty}
          onSelectDifficulty={setTournamentDifficulty}
          trophiesWon={leaderboardStats.trophiesWon}
        />
      )}

      {/* Screen 3: Dedicated 2-Player Versus Arena Setup Page */}
      {activeScreen === 'two_player_hub' && (
        <TwoPlayerHub
          settings={twoPlayerSettings}
          onUpdateSettings={setTwoPlayerSettings}
          onStartMatch={handleStartTwoPlayerMatch}
          onBackToHome={handleGoHome}
        />
      )}

      {/* Screen 4: Dedicated Full-Screen World Cup Ball Shop & Armory */}
      {activeScreen === 'shop' && (
        <ShopScreen
          onBackToHome={handleGoHome}
          onSelectSkin={(skinId) => engineRef.current?.setBallSkin(skinId)}
        />
      )}

      {/* Screen 4: Gameplay Overlays & In-Match Controls */}
      {activeScreen === 'gameplay' && (
        <>
          {/* Mode: Team Placement Toolbar (Visible ONLY in 'team' mode) */}
          {gameMode === 'team' &&
            !stats.isPaused &&
            !stats.isGameOver && (
              <TeamToolbar
                fieldPlayers={fieldPlayers}
                selectedPlayer={selectedPlayer}
                pendingPlacementRole={pendingPlacementRole}
                ejectedRoles={ejectedRoles}
                externalFeedback={placementFeedback}
                onSelectPendingRole={handleSelectPendingRole}
                onAddPlayer={handleAddPlayer}
                onRotatePlayer={handleRotatePlayer}
                onRemovePlayer={handleRemovePlayer}
                onClearPlayers={handleClearPlayers}
                onResetDefault={handleResetDefault}
                onPowerKick={() => engineRef.current?.triggerActionKick(false, 'team')}
                isPowerKickReady={isPowerKickReady}
                onStartDragRole={handleStartDragRole}
              />
            )}

          {/* Interactive Flipper & Power Kick Controls (Visible ONLY in classic 'pinball' mode) */}
          {gameMode === 'pinball' &&
            !stats.isPaused &&
            !stats.isGameOver && (
              <FlipperControls
                onLeftFlipperDown={handleLeftFlipperDown}
                onLeftFlipperUp={handleLeftFlipperUp}
                onRightFlipperDown={handleRightFlipperDown}
                onRightFlipperUp={handleRightFlipperUp}
                onActionKick={() => engineRef.current?.triggerActionKick(false, 'flipper')}
                isPowerKickReady={isPowerKickReady}
              />
            )}

          {/* 2-Player Head-to-Head: Tactical Arrangement Phase */}
          {gameMode === 'two_player' &&
            twoPlayerPhase.isSetup &&
            !stats.isPaused &&
            !stats.isGameOver && (
              <TwoPlayerTacticsOverlay
                p1Locked={twoPlayerPhase.p1Locked}
                p2Locked={twoPlayerPhase.p2Locked}
                countdown={twoPlayerPhase.countdown}
                onToggleP1Lock={() => engineRef.current?.toggleTwoPlayerLock('p1')}
                onToggleP2Lock={() => engineRef.current?.toggleTwoPlayerLock('p2')}
                onP1Preset={(preset) => engineRef.current?.setTwoPlayerPreset('p1', preset)}
                onP2Preset={(preset) => engineRef.current?.setTwoPlayerPreset('p2', preset)}
                onQuickStart={() => engineRef.current?.quickStartTwoPlayer()}
                isCpuOpponent={matchType === 'tournament'}
                cpuName={
                  activeTournamentMatch
                    ? activeTournamentMatch.teamA.isPlayer
                      ? activeTournamentMatch.teamB.name
                      : activeTournamentMatch.teamA.name
                    : undefined
                }
                cpuBadge={
                  activeTournamentMatch
                    ? activeTournamentMatch.teamA.isPlayer
                      ? activeTournamentMatch.teamB.badge
                      : activeTournamentMatch.teamA.badge
                    : undefined
                }
                tournamentRoundName={
                  TOURNAMENT_ROUNDS.find((r) => r.roundNumber === tournamentRoundNumber)?.name
                }
              />
            )}

          {/* 2-Player Head-to-Head: Active Dual-Flipper Gameplay Controls */}
          {gameMode === 'two_player' &&
            !twoPlayerPhase.isSetup &&
            !stats.isPaused &&
            !stats.isGameOver && (
              <TwoPlayerFlipperControls
                onP1LeftDown={() => engineRef.current?.setLeftFlipper(true)}
                onP1LeftUp={() => engineRef.current?.setLeftFlipper(false)}
                onP1RightDown={() => engineRef.current?.setRightFlipper(true)}
                onP1RightUp={() => engineRef.current?.setRightFlipper(false)}
                onP2LeftDown={() => engineRef.current?.setP2LeftFlipper(true)}
                onP2LeftUp={() => engineRef.current?.setP2LeftFlipper(false)}
                onP2RightDown={() => engineRef.current?.setP2RightFlipper(true)}
                onP2RightUp={() => engineRef.current?.setP2RightFlipper(false)}
                isCpuOpponent={matchType === 'tournament'}
              />
            )}

          {/* Clean Goal Flash (no background box, pure text) */}
          <GoalFlash show={showGoalFlash} scorer={goalScorer} gameMode={gameMode} />

          {/* Referee Penalty Card Alert (2 consecutive knockouts) */}
          <PenaltyBanner show={penaltyCard.show} card={penaltyCard.card} />

          {/* Interactive Penalty Placement & Timed Shot Overlay */}
          <PenaltyKickOverlay
            penaltyState={penaltyState}
            onShoot={() => engineRef.current?.triggerPenaltyShot()}
          />

          {/* Pause Menu */}
          {stats.isPaused && (
            <PauseMenu
              currentMode={gameMode}
              onResume={handleTogglePause}
              onRestart={handleRestart}
              onSwitchMode={handleSwitchMode}
              onGoHome={handleGoHome}
            />
          )}

          {/* Second Chance Revive Modal (Before full Game Over in single-player) */}
          <SecondChanceModal
            show={showSecondChance}
            onWatchAd={handleWatchSecondChanceAd}
            onDecline={handleDeclineSecondChance}
            isTournament={matchType === 'tournament'}
          />

          {/* Game Over View (only during match, never on home screen, hidden during second chance prompt) */}
          {stats.isGameOver && !showSecondChance && (
            <GameOverView
              score={stats.score}
              goals={stats.goals}
              playerGoals={stats.playerGoals}
              winner={stats.winner}
              gameMode={gameMode}
              matchType={matchType}
              tournamentRound={currentTournamentRound}
              playerName={leaderboardStats.playerName}
              playerCountry={leaderboardStats.playerCountry}
              trophiesWon={leaderboardStats.trophiesWon}
              onNextTournamentRound={handleNextTournamentRound}
              onViewBracket={handleViewTournamentBracket}
              onRestart={handleRestart}
              onHome={handleGoHome}
            />
          )}
        </>
      )}
    </main>
  );
}
