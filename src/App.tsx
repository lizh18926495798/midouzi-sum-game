/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Timer, 
  RotateCcw, 
  Play, 
  Pause, 
  ChevronRight, 
  AlertCircle,
  Zap,
  Target,
  Home
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const COLS = 6;
const ROWS = 10;
const INITIAL_ROWS = 3;
const TARGET_MIN = 10;
const TARGET_MAX = 25;
const BLOCK_MIN = 1;
const BLOCK_MAX = 9;
const TIME_MODE_INTERVAL = 8000; // 8 seconds per row in time mode

type GameMode = 'classic' | 'time';

interface Block {
  id: string;
  value: number;
  isSelected: boolean;
}

type Grid = (Block | null)[][];

// --- Components ---

const BlockComponent = ({ 
  block, 
  onClick, 
  isClearing 
}: { 
  block: Block; 
  onClick: () => void;
  isClearing?: boolean;
}) => {
  const colors: Record<number, string> = {
    1: 'bg-red-100 text-red-700 border-red-200',
    2: 'bg-green-100 text-green-700 border-green-200',
    3: 'bg-blue-100 text-blue-700 border-blue-200',
    4: 'bg-amber-100 text-amber-700 border-amber-200',
    5: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    6: 'bg-rose-100 text-rose-700 border-rose-200',
    7: 'bg-sky-100 text-sky-700 border-sky-200',
    8: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    9: 'bg-violet-100 text-violet-700 border-violet-200',
  };

  return (
    <motion.button
      layout
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isClearing ? 1.2 : 1, 
        opacity: isClearing ? 0 : 1,
        y: 0
      }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(220,38,38,0.2)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "w-full aspect-square rounded-xl border-2 flex items-center justify-center text-3xl font-black transition-all duration-200 shadow-sm backdrop-blur-sm",
        colors[block.value] || 'bg-white',
        block.isSelected && "ring-4 ring-red-500 ring-offset-2 ring-offset-white scale-105 z-10 shadow-[0_0_20px_rgba(220,38,38,0.3)]",
        isClearing && "brightness-125"
      )}
    >
      {block.value}
    </motion.button>
  );
};

export default function App() {
  const [grid, setGrid] = useState<Grid>([]);
  const [target, setTarget] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [mode, setMode] = useState<GameMode>('classic');
  const [timeLeft, setTimeLeft] = useState(TIME_MODE_INTERVAL);
  const [isPaused, setIsPaused] = useState(false);
  const [clearingIds, setClearingIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Helpers ---
  const generateBlock = useCallback((): Block => ({
    id: Math.random().toString(36).substring(2, 11),
    value: Math.floor(Math.random() * (BLOCK_MAX - BLOCK_MIN + 1)) + BLOCK_MIN,
    isSelected: false,
  }), []);

  const generateTarget = useCallback(() => {
    setTarget(Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN);
  }, []);

  const initGrid = useCallback(() => {
    const newGrid: Grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    // Fill bottom rows
    for (let r = ROWS - INITIAL_ROWS; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        newGrid[r][c] = generateBlock();
      }
    }
    setGrid(newGrid);
    generateTarget();
    setScore(0);
    setIsGameOver(false);
    setSelectedIds(new Set());
    setTimeLeft(TIME_MODE_INTERVAL);
    setIsProcessing(false);
  }, [generateBlock, generateTarget]);

  const addRow = useCallback(() => {
    setGrid(prev => {
      // Check if top row (index 0) has blocks
      if (prev[0].some(cell => cell !== null)) {
        return prev;
      }

      const nextGrid = prev.map((row, i) => {
        if (i === ROWS - 1) return Array.from({ length: COLS }, () => generateBlock());
        return prev[i + 1];
      });

      return nextGrid;
    });
    setTimeLeft(TIME_MODE_INTERVAL);
  }, [generateBlock]);

  // Separate check for game over to avoid side effects in setGrid
  useEffect(() => {
    if (grid.length > 0 && grid[0].some(cell => cell !== null)) {
      setIsGameOver(true);
    }
  }, [grid]);

  // --- Effects ---
  useEffect(() => {
    const saved = localStorage.getItem('sumstack-highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('sumstack-highscore', score.toString());
    }
  }, [score, highScore]);

  useEffect(() => {
    if (gameStarted && mode === 'time' && !isGameOver && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 100) {
            addRow();
            return TIME_MODE_INTERVAL;
          }
          return prev - 100;
        });
      }, 100);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameStarted, mode, isGameOver, isPaused, addRow]);

  // --- Handlers ---
  const handleBlockClick = (block: Block) => {
    if (isGameOver || isPaused || clearingIds.has(block.id) || isProcessing) return;

    const newSelected = new Set<string>(selectedIds);
    if (newSelected.has(block.id)) {
      newSelected.delete(block.id);
    } else {
      newSelected.add(block.id);
    }

    // Calculate sum
    let currentSum = 0;
    grid.flat().forEach(b => {
      if (b && newSelected.has(b.id)) {
        currentSum += b.value;
      }
    });

    if (currentSum === target) {
      handleSuccess(newSelected);
    } else if (currentSum > target) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(newSelected);
    }
  };

  const handleSuccess = (ids: Set<string>) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setClearingIds(ids);
    setScore(prev => prev + ids.size * 10);
    
    setTimeout(() => {
      setGrid(prev => {
        const nextGrid = prev.map(row => 
          row.map(cell => cell && ids.has(cell.id) ? null : cell)
        );

        // Gravity: blocks fall down
        for (let c = 0; c < COLS; c++) {
          const colBlocks = [];
          for (let r = ROWS - 1; r >= 0; r--) {
            if (nextGrid[r][c]) colBlocks.push(nextGrid[r][c]);
          }
          for (let r = ROWS - 1; r >= 0; r--) {
            const block = colBlocks[ROWS - 1 - r];
            nextGrid[r][c] = block || null;
          }
        }

        return nextGrid;
      });

      setClearingIds(new Set());
      setSelectedIds(new Set());
      generateTarget();
      setIsProcessing(false);
      
      if (mode === 'classic') {
        addRow();
      }

      if (ids.size >= 4) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      }
    }, 300);
  };

  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setGameStarted(true);
    initGrid();
  };

  const resetGame = () => {
    initGrid();
  };

  // --- Render ---
  if (!gameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="christmas-pattern" />
        <div className="santa-center" />
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full text-center space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] border border-red-500/30 shadow-[0_0_50px_rgba(220,38,38,0.1)]"
        >
          <div className="space-y-2">
            <h1 className="text-6xl font-black tracking-tighter text-slate-900 font-display">
              数字<span className="text-red-600">堆叠</span>
            </h1>
            <p className="text-slate-500 font-medium">掌握数学，消除堆叠。</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => startGame('classic')}
              className="group relative flex items-center justify-between p-6 bg-white/60 rounded-3xl border-2 border-slate-200 hover:border-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)] transition-all duration-300 text-left"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900">经典模式</h3>
                <p className="text-sm text-slate-500">每次消除后新增一行。节奏稳定，考验策略。</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors text-red-600">
                <Play size={24} fill="currentColor" />
              </div>
            </button>

            <button 
              onClick={() => startGame('time')}
              className="group relative flex items-center justify-between p-6 bg-white/60 rounded-3xl border-2 border-slate-200 hover:border-green-600 hover:shadow-[0_0_20px_rgba(5,150,105,0.2)] transition-all duration-300 text-left"
            >
              <div>
                <h3 className="text-xl font-bold text-slate-900">计时模式</h3>
                <p className="text-sm text-slate-500">每8秒自动新增一行。反应要快！</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors text-green-600">
                <Timer size={24} />
              </div>
            </button>
          </div>

          <div className="pt-8 flex items-center justify-center gap-8 text-slate-400">
            <div className="flex flex-col items-center">
              <Trophy size={20} className="mb-1" />
              <span className="text-xs font-bold uppercase tracking-widest">最高分</span>
              <span className="text-lg font-mono text-slate-900">{highScore}</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      <div className="christmas-pattern" />
      <div className="santa-center" />
      {/* Header */}
      <div className="w-full max-w-lg flex flex-col gap-6 mb-8 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-red-500/10 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white">
              <Target size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">目标值</p>
              <p className="text-2xl font-black font-display leading-none text-red-600">{target}</p>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="bg-white/60 px-6 py-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">得分</p>
              <p className="text-xl font-mono font-bold text-slate-900">{score}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setGameStarted(false)}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="回到主菜单"
            >
              <Home size={20} />
            </button>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
            </button>
            <button 
              onClick={resetGame}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>

        {/* Progress Bar for Time Mode */}
        {mode === 'time' && (
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={false}
              animate={{ width: `${(timeLeft / TIME_MODE_INTERVAL) * 100}%` }}
              className={cn(
                "h-full transition-colors duration-300",
                timeLeft < 3000 ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)]" : "bg-green-600"
              )}
            />
          </div>
        )}
      </div>

      {/* Game Board */}
      <div className="relative w-full max-w-lg aspect-[6/10] bg-white/60 backdrop-blur-sm rounded-[2rem] shadow-2xl border-8 border-white/80 p-3 overflow-hidden">
        {/* Grid Background Lines */}
        <div className="absolute inset-0 grid grid-cols-6 pointer-events-none opacity-[0.05]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-r border-slate-900 h-full" />
          ))}
        </div>

        <div className="grid grid-cols-6 gap-2 h-full">
          <AnimatePresence mode="popLayout">
            {grid.map((row, r) => 
              row.map((cell, c) => (
                <div key={`${r}-${c}`} className="relative">
                  {cell && (
                    <BlockComponent 
                      block={{...cell, isSelected: selectedIds.has(cell.id)}}
                      onClick={() => handleBlockClick(cell)}
                      isClearing={clearingIds.has(cell.id)}
                    />
                  )}
                </div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Danger Zone Indicator */}
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/20" />
        <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-rose-500/5 to-transparent pointer-events-none" />

        {/* Pause Overlay */}
        <AnimatePresence>
          {isPaused && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center"
            >
              <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 flex flex-col items-center gap-6">
                <Pause size={48} className="text-slate-400" />
                <h2 className="text-3xl font-black font-display">已暂停</h2>
                <button 
                  onClick={() => setIsPaused(false)}
                  className="px-8 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  继续游戏
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {isGameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-xs shadow-2xl space-y-8">
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                  </div>
                  <h2 className="text-4xl font-black font-display text-slate-900">游戏结束</h2>
                  <p className="text-slate-500 font-medium">方块堆积到顶部了！</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">得分</p>
                    <p className="text-2xl font-mono font-bold text-slate-900">{score}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">最高分</p>
                    <p className="text-2xl font-mono font-bold text-slate-900">{highScore}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={resetGame}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={20} />
                    再试一次
                  </button>
                  <button 
                    onClick={() => setGameStarted(false)}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    返回主菜单
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions / Footer */}
      <div className="mt-8 max-w-lg w-full">
        <div className="bg-white/80 p-6 rounded-3xl border border-red-500/10 shadow-sm flex items-start gap-4 backdrop-blur-md">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-900">游戏玩法</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              点击数字使其相加等于 <span className="font-bold text-red-600">目标值</span>。
              消除方块以防止堆叠到顶部！
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

