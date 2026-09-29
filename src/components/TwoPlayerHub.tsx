import React, { useState } from 'react';
import {
  Users,
  ArrowLeft,
  Swords,
  Gamepad2,
  Zap,
  Shield,
  Target,
  Trophy,
  Play,
  Flame,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TwoPlayerSettings } from '../types';

interface TwoPlayerHubProps {
  settings: TwoPlayerSettings;
  onUpdateSettings: (settings: TwoPlayerSettings) => void;
  onStartMatch: () => void;
  onBackToHome: () => void;
}

export const TwoPlayerHub: React.FC<TwoPlayerHubProps> = ({
  settings,
  onUpdateSettings,
  onStartMatch,
  onBackToHome,
}) => {
  // Progressive Step Flow: 1 (Stakes / Rules) -> 2 (Fighter Battle Stations)
  const [step, setStep] = useState<1 | 2>(1);
  const [p1Ready, setP1Ready] = useState(true);
  const [p2Ready, setP2Ready] = useState(true);
  const [p1Kit, setP1Kit] = useState<'sky' | 'amber'>('sky');
  const [p2Kit, setP2Kit] = useState<'purple' | 'rose'>('purple');

  const handleSelectGoals = (goals: number) => {
    onUpdateSettings({
      ...settings,
      targetGoals: goals,
    });
  };

  return (
    <div
      id="two-player-hub-page"
      className="absolute inset-0 z-40 flex flex-col bg-neutral-900 text-white select-none overflow-hidden font-sans"
    >
      {/* 1. High-Contrast Neo-Primitive Header */}
      <header className="w-full border-b-[3px] border-black bg-purple-500 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shrink-0 z-30 shadow-[0_4px_0_#000]">
        {/* Back to Lobby Button */}
        <button
          id="btn-twoplayer-back"
          type="button"
          onClick={onBackToHome}
          className="group flex items-center gap-1.5 px-3 py-1.5 bg-white text-black font-black text-xs uppercase border-2 border-black rounded-xl shadow-[0_2.5px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] transition-all cursor-pointer touch-manipulation"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>LOBBY</span>
        </button>

        {/* Center: Title Badge (Circled in blue in user diagram, now with ample breathing room!) */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[0_2px_0_#000] shrink-0">
            <Swords size={18} className="text-purple-600" />
          </div>
          <div className="flex flex-col text-left">
            <h1 className="text-xs sm:text-sm md:text-base font-black italic tracking-tight uppercase leading-none text-white">
              2-PLAYER VERSUS ARENA
            </h1>
            <span className="text-[9px] text-white/90 font-black uppercase tracking-wider mt-0.5">
              1 KEYBOARD • HEAD-TO-HEAD
            </span>
          </div>
        </div>

        {/* Right: Target Goals Quick Badge */}
        <div className="hidden xs:flex items-center gap-1 px-2.5 py-1 bg-black/30 border-2 border-black rounded-xl text-[10px] font-black uppercase text-amber-300">
          <Trophy size={12} className="text-amber-400" />
          <span>FIRST TO {settings.targetGoals}</span>
        </div>
      </header>

      {/* 2. Main Progressive Body (Zero Scroll Layout) */}
      <main className="flex-1 flex flex-col px-3 sm:px-5 py-2 max-w-5xl w-full mx-auto justify-between overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            /* STEP 1: MATCH RULES & GOAL LIMIT (Streamlined & fits fully without any vertical squeeze!) */
            <motion.div
              key="step-rules"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.16 }}
              className="flex-1 flex flex-col justify-between items-center text-center overflow-hidden min-h-0 py-1"
            >
              {/* Header Title & Prompt */}
              <div className="shrink-0 my-1">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-white leading-tight">
                  CHOOSE YOUR GOAL TARGET
                </h2>
                <p className="text-[11px] sm:text-xs font-bold text-neutral-300 mt-0.5 max-w-md mx-auto">
                  First player to reach the target goals claims ultimate bragging rights!
                </p>
              </div>

              {/* 3 Tactile Cards: Always 3-column side-by-side to guarantee Zero-Scroll on all screen heights */}
              <div className="flex-1 flex flex-col justify-center w-full max-w-4xl py-1 min-h-0">
                <div className="grid grid-cols-3 gap-2 sm:gap-3.5 text-left w-full">
                  {/* Option A: 3 Goals */}
                  <button
                    type="button"
                    onClick={() => handleSelectGoals(3)}
                    className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border-[3px] border-black transition-all cursor-pointer flex flex-col justify-between space-y-1.5 sm:space-y-3 relative select-none touch-manipulation ${
                      settings.targetGoals === 3
                        ? 'bg-sky-400 text-black shadow-[0_4px_0_#000] ring-2 ring-white -translate-y-0.5'
                        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-750 shadow-[0_3px_0_#000]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[0_1.5px_0_#000]">
                        <Zap size={18} className="text-black fill-black" />
                      </div>
                      {settings.targetGoals === 3 && (
                        <span className="px-1.5 sm:px-2 py-0.5 bg-black text-sky-300 text-[8px] sm:text-[9px] font-black uppercase rounded">
                          PICK
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base sm:text-xl font-black uppercase leading-tight">
                        3 GOALS
                      </h3>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block opacity-80 mt-0.5">
                        BLITZ SHOOTOUT
                      </span>
                    </div>
                  </button>

                  {/* Option B: 5 Goals (Standard) */}
                  <button
                    type="button"
                    onClick={() => handleSelectGoals(5)}
                    className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border-[3px] border-black transition-all cursor-pointer flex flex-col justify-between space-y-1.5 sm:space-y-3 relative select-none touch-manipulation ${
                      settings.targetGoals === 5
                        ? 'bg-amber-400 text-black shadow-[0_4px_0_#000] ring-2 ring-white -translate-y-0.5'
                        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-750 shadow-[0_3px_0_#000]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[0_1.5px_0_#000]">
                        <Trophy size={18} className="text-amber-600 fill-amber-500" />
                      </div>
                      <span className="px-1.5 sm:px-2 py-0.5 bg-black text-amber-300 text-[8px] sm:text-[9px] font-black uppercase rounded">
                        PRO
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base sm:text-xl font-black uppercase leading-tight">
                        5 GOALS
                      </h3>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block opacity-80 mt-0.5">
                        CLASSIC DUEL
                      </span>
                    </div>
                  </button>

                  {/* Option C: 7 Goals */}
                  <button
                    type="button"
                    onClick={() => handleSelectGoals(7)}
                    className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border-[3px] border-black transition-all cursor-pointer flex flex-col justify-between space-y-1.5 sm:space-y-3 relative select-none touch-manipulation ${
                      settings.targetGoals === 7
                        ? 'bg-rose-500 text-white shadow-[0_4px_0_#000] ring-2 ring-white -translate-y-0.5'
                        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-750 shadow-[0_3px_0_#000]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[0_1.5px_0_#000]">
                        <Flame size={18} className="text-rose-600 fill-rose-500" />
                      </div>
                      {settings.targetGoals === 7 && (
                        <span className="px-1.5 sm:px-2 py-0.5 bg-black text-rose-300 text-[8px] sm:text-[9px] font-black uppercase rounded">
                          PICK
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base sm:text-xl font-black uppercase leading-tight">
                        7 GOALS
                      </h3>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block opacity-80 mt-0.5">
                        MARATHON
                      </span>
                    </div>
                  </button>
                </div>

                {/* Selected Mode Tactical Description Banner */}
                <div className="mt-2 sm:mt-3.5 bg-neutral-950 border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[0_3px_0_#000] text-left max-w-4xl mx-auto w-full">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <p className="text-[11px] sm:text-xs text-neutral-200 font-bold leading-relaxed">
                      {settings.targetGoals === 3 && (
                        <>⚡ <strong className="text-sky-300">BLITZ SHOOTOUT:</strong> Rapid reflex battle. Ideal for swift rematches and high-adrenaline clutch saves.</>
                      )}
                      {settings.targetGoals === 5 && (
                        <>🏆 <strong className="text-amber-300">CLASSIC DUEL:</strong> The premier tournament standard. Full tactical play for striker positioning and flipper trickshots.</>
                      )}
                      {settings.targetGoals === 7 && (
                        <>🔥 <strong className="text-rose-300">MARATHON SHOWDOWN:</strong> Grudge match endurance mode. Tests consistency, card discipline, and clutch rocket kicks.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* DOCKED AT THE BOTTOM: PROGRESS STEP INDICATOR BUTTONS (MOVED HERE AS REQUESTED) + ACTION BUTTONS */}
              <div className="w-full shrink-0 pt-2 flex flex-col items-center gap-2 max-w-xl mx-auto">
                {/* Progress Step Selector Buttons Docked Right Here */}
                <div className="flex items-center justify-center gap-2 bg-neutral-950/80 p-1 rounded-xl border-2 border-black shadow-[0_2px_0_#000] w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-1 px-3 rounded-lg font-black text-[11px] sm:text-xs uppercase transition-all bg-amber-400 text-black border-2 border-black shadow-[0_1.5px_0_#000]"
                  >
                    1. RULES
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-1 px-3 rounded-lg font-black text-[11px] sm:text-xs uppercase transition-all text-white/70 hover:text-white hover:bg-neutral-800"
                  >
                    2. STATIONS
                  </button>
                </div>

                {/* Primary Action Buttons Row */}
                <div className="w-full flex flex-row items-stretch justify-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={onBackToHome}
                    className="flex-none py-2.5 sm:py-3 px-4 sm:px-6 bg-neutral-800 hover:bg-neutral-700 text-white font-black text-xs sm:text-sm uppercase border-[2.5px] border-black rounded-2xl shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation whitespace-nowrap"
                  >
                    <ArrowLeft size={16} />
                    <span>LOBBY</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-2.5 sm:py-3 px-4 sm:px-6 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl border-[3px] border-black shadow-[0_4px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] transition-all cursor-pointer flex items-center justify-center gap-2 touch-manipulation whitespace-nowrap"
                  >
                    <span>OPEN BATTLE STATIONS</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* STEP 2: FIGHTER STATIONS & CONTROLS */
            <motion.div
              key="step-stations"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="flex-1 flex flex-col justify-between items-center overflow-hidden min-h-0 py-1"
            >
              {/* Target Banner */}
              <div className="flex items-center justify-center gap-2 shrink-0 my-1">
                <span className="px-2.5 py-0.5 bg-amber-400 text-black text-[11px] sm:text-xs font-black uppercase rounded-lg border-2 border-black shadow-[0_2px_0_#000]">
                  STATION READY
                </span>
                <span className="text-[11px] sm:text-xs font-black text-neutral-200 uppercase tracking-wide">
                  TARGET: FIRST TO {settings.targetGoals} GOALS
                </span>
              </div>

              {/* Main Content: Side-by-Side Arena Clash */}
              <div className="flex-1 flex flex-col justify-center w-full py-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-11 gap-2 sm:gap-3 items-center w-full">
                  {/* PLAYER 1: BOTTOM PINBALL WIZARD (5 Cols) */}
                  <div
                    className={`md:col-span-5 border-[3px] border-black rounded-2xl p-2.5 sm:p-3.5 shadow-[0_4px_0_#000] flex flex-col space-y-2 transition-colors ${
                      p1Kit === 'sky' ? 'bg-sky-400 text-black' : 'bg-amber-400 text-black'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b-2 border-black/20 pb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[0_2px_0_#000] shrink-0">
                          <Gamepad2 size={18} className="text-black" />
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-black/70 block leading-none">
                            PLAYER 1 (BOTTOM)
                          </span>
                          <h2 className="text-xs sm:text-sm font-black uppercase leading-tight mt-0.5">
                            PINBALL WIZARD
                          </h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setP1Ready(!p1Ready)}
                        className={`px-2.5 py-1 rounded-xl border-2 border-black font-black text-[10px] sm:text-xs uppercase flex items-center gap-1 cursor-pointer transition-transform touch-manipulation ${
                          p1Ready
                            ? 'bg-emerald-400 text-black shadow-[0_2px_0_#000]'
                            : 'bg-white text-black'
                        }`}
                      >
                        {p1Ready && <CheckCircle2 size={13} />}
                        <span>{p1Ready ? 'READY' : 'CLICK READY'}</span>
                      </button>
                    </div>

                    <p className="text-[10px] sm:text-[11px] font-bold leading-tight opacity-90">
                      Defends bottom goal. Arranges bottom bumpers & controls bottom flippers.
                    </p>

                    {/* Keycap Blueprint */}
                    <div className="bg-black/15 p-1.5 sm:p-2 rounded-xl border-2 border-black space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-wider block text-black/80">
                        CONTROLS BLUEPRINT:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 text-center">
                        <div>
                          <div className="w-full py-1 bg-white text-black font-black font-mono text-[10px] border-2 border-black rounded-lg shadow-[0_1.5px_0_#000]">
                            A KEY
                          </div>
                          <span className="text-[8px] font-black uppercase mt-0.5 block">
                            LEFT FLIPPER
                          </span>
                        </div>
                        <div>
                          <div className="w-full py-1 bg-white text-black font-black font-mono text-[10px] border-2 border-black rounded-lg shadow-[0_1.5px_0_#000]">
                            D KEY
                          </div>
                          <span className="text-[8px] font-black uppercase mt-0.5 block">
                            RIGHT FLIPPER
                          </span>
                        </div>
                      </div>
                      <div className="text-[8px] font-black uppercase text-center text-black/70 pt-0.5">
                        OR TAP BOTTOM-LEFT / BOTTOM-RIGHT SCREEN
                      </div>
                    </div>

                    {/* Crest Color Switcher */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[9px] font-black uppercase text-black/80">
                        KIT:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setP1Kit('sky')}
                          className={`px-2 py-0.5 rounded-lg border-2 border-black font-black text-[9px] uppercase cursor-pointer touch-manipulation ${
                            p1Kit === 'sky'
                              ? 'bg-white text-black shadow-[0_1.5px_0_#000]'
                              : 'bg-black/10 text-black'
                          }`}
                        >
                          CYBER SKY
                        </button>
                        <button
                          type="button"
                          onClick={() => setP1Kit('amber')}
                          className={`px-2 py-0.5 rounded-lg border-2 border-black font-black text-[9px] uppercase cursor-pointer touch-manipulation ${
                            p1Kit === 'amber'
                              ? 'bg-white text-black shadow-[0_1.5px_0_#000]'
                              : 'bg-black/10 text-black'
                          }`}
                        >
                          VOLT GOLD
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CENTER: VS BADGE (1 Col) */}
                  <div className="md:col-span-1 flex flex-col items-center justify-center my-0">
                    <motion.div
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                      className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-400 border-[3px] border-black flex items-center justify-center shadow-[0_3px_0_#000]"
                    >
                      <span className="text-xs sm:text-base font-black italic text-black tracking-tighter">
                        VS
                      </span>
                    </motion.div>
                  </div>

                  {/* PLAYER 2: TOP PINBALL WIZARD (5 Cols) */}
                  <div
                    className={`md:col-span-5 border-[3px] border-black rounded-2xl p-2.5 sm:p-3.5 shadow-[0_4px_0_#000] flex flex-col space-y-2 transition-colors ${
                      p2Kit === 'purple' ? 'bg-purple-500 text-white' : 'bg-rose-500 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b-2 border-black/20 pb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[0_2px_0_#000] shrink-0">
                          <Gamepad2 size={18} className="text-black" />
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-white/70 block leading-none">
                            PLAYER 2 (TOP)
                          </span>
                          <h2 className="text-xs sm:text-sm font-black uppercase leading-tight text-white mt-0.5">
                            PINBALL WIZARD
                          </h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setP2Ready(!p2Ready)}
                        className={`px-2.5 py-1 rounded-xl border-2 border-black font-black text-[10px] sm:text-xs uppercase flex items-center gap-1 cursor-pointer transition-transform touch-manipulation ${
                          p2Ready
                            ? 'bg-emerald-400 text-black shadow-[0_2px_0_#000]'
                            : 'bg-white text-black'
                        }`}
                      >
                        {p2Ready && <CheckCircle2 size={13} />}
                        <span>{p2Ready ? 'READY' : 'CLICK READY'}</span>
                      </button>
                    </div>

                    <p className="text-[10px] sm:text-[11px] font-bold leading-tight text-white/90">
                      Defends top goal. Arranges top bumpers & controls top flippers.
                    </p>

                    {/* Keycap Blueprint */}
                    <div className="bg-black/20 p-1.5 sm:p-2 rounded-xl border-2 border-black space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-wider block text-white/80">
                        CONTROLS BLUEPRINT:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 text-center text-black">
                        <div>
                          <div className="w-full py-1 bg-white text-black font-black font-mono text-[10px] border-2 border-black rounded-lg shadow-[0_1.5px_0_#000]">
                            &larr; KEY
                          </div>
                          <span className="text-[8px] font-black uppercase mt-0.5 block text-white">
                            LEFT FLIPPER
                          </span>
                        </div>
                        <div>
                          <div className="w-full py-1 bg-white text-black font-black font-mono text-[10px] border-2 border-black rounded-lg shadow-[0_1.5px_0_#000]">
                            &rarr; KEY
                          </div>
                          <span className="text-[8px] font-black uppercase mt-0.5 block text-white">
                            RIGHT FLIPPER
                          </span>
                        </div>
                      </div>
                      <div className="text-[8px] font-black uppercase text-center text-white/80 pt-0.5">
                        OR TAP TOP-LEFT / TOP-RIGHT SCREEN
                      </div>
                    </div>

                    {/* Crest Color Switcher */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[9px] font-black uppercase text-white/80">
                        KIT:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setP2Kit('purple')}
                          className={`px-2 py-0.5 rounded-lg border-2 border-black font-black text-[9px] uppercase cursor-pointer touch-manipulation ${
                            p2Kit === 'purple'
                              ? 'bg-white text-black shadow-[0_1.5px_0_#000]'
                              : 'bg-black/20 text-white'
                          }`}
                        >
                          ROYAL
                        </button>
                        <button
                          type="button"
                          onClick={() => setP2Kit('rose')}
                          className={`px-2 py-0.5 rounded-lg border-2 border-black font-black text-[9px] uppercase cursor-pointer touch-manipulation ${
                            p2Kit === 'rose'
                              ? 'bg-white text-black shadow-[0_1.5px_0_#000]'
                              : 'bg-black/20 text-white'
                          }`}
                        >
                          CRIMSON
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DOCKED AT THE BOTTOM: STEP PROGRESS PILLS + SIDE-BY-SIDE BUTTONS */}
              <div className="w-full shrink-0 pt-2 flex flex-col items-center gap-2 max-w-xl mx-auto">
                {/* Progress Step Selector Buttons Docked Right Here */}
                <div className="flex items-center justify-center gap-2 bg-neutral-950/80 p-1 rounded-xl border-2 border-black shadow-[0_2px_0_#000] w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-1 px-3 rounded-lg font-black text-[11px] sm:text-xs uppercase transition-all text-white/70 hover:text-white hover:bg-neutral-800"
                  >
                    1. RULES
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-1 px-3 rounded-lg font-black text-[11px] sm:text-xs uppercase transition-all bg-amber-400 text-black border-2 border-black shadow-[0_1.5px_0_#000]"
                  >
                    2. STATIONS
                  </button>
                </div>

                {/* Primary Action Buttons Row */}
                <div className="w-full flex flex-row items-stretch justify-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-none py-2.5 sm:py-3 px-4 sm:px-6 bg-neutral-800 hover:bg-neutral-700 text-white font-black text-xs sm:text-sm uppercase border-[2.5px] border-black rounded-2xl shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000] flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation whitespace-nowrap"
                  >
                    <ArrowLeft size={16} />
                    <span>RULES</span>
                  </button>

                  <button
                    id="btn-start-twoplayer-match"
                    type="button"
                    onClick={onStartMatch}
                    className="flex-1 py-2.5 sm:py-3 px-5 sm:px-8 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 active:shadow-[0_1px_0_#000] border-[3px] border-black rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_4px_0_#000] transition-all cursor-pointer select-none touch-manipulation whitespace-nowrap text-black"
                  >
                    <Play size={18} className="fill-black" />
                    <span>KICK OFF!</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
