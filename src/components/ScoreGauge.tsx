'use client';

import React from 'react';

interface ScoreGaugeProps {
  score: number;
  balance: 'optimal' | 'anxiety' | 'depression' | 'neutral' | string;
  adultRatio: number;
  childRatio: number;
  restRatio: number;
}

export default function ScoreGauge({
  score,
  balance,
  adultRatio,
  childRatio,
  restRatio
}: ScoreGaugeProps) {
  const getBalanceEmoji = () => {
    if (balance === 'optimal') return '✨';
    if (balance === 'anxiety') return '😰';
    if (balance === 'depression') return '😔';
    return '🤯';
  };

  return (
    <div className="flex items-center gap-2 bg-[#1e293b]/70 backdrop-blur-md py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-full border border-slate-700/50 score-glow relative overflow-hidden group">
      {/* Glow Highlight on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* SVG Rings */}
      <div className="relative w-[44px] h-[44px] sm:w-[48px] sm:h-[44px] flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full transform -rotate-90 scale-90" viewBox="0 0 54 54">
          {/* Track Backings */}
          <circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="27" cy="27" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="27" cy="27" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />

          {/* Active Tracks */}
          {/* Outer Ring: Adult (Blue) */}
          <circle 
            cx="27" cy="27" r="23" 
            fill="none" 
            stroke="#3b82f6" 
            strokeWidth="3.2" 
            strokeLinecap="round"
            className="concentric-ring-circle ring-glow-blue"
            strokeDasharray="144.5"
            strokeDashoffset={144.5 * (1 - adultRatio)}
          />
          {/* Middle Ring: Child (Pink) */}
          <circle 
            cx="27" cy="27" r="18" 
            fill="none" 
            stroke="#ec4899" 
            strokeWidth="3.2" 
            strokeLinecap="round"
            className="concentric-ring-circle ring-glow-pink"
            strokeDasharray="113.1"
            strokeDashoffset={113.1 * (1 - childRatio)}
          />
          {/* Inner Ring: Rest (Green) */}
          <circle 
            cx="27" cy="27" r="13" 
            fill="none" 
            stroke="#10b981" 
            strokeWidth="3.2" 
            strokeLinecap="round"
            className="concentric-ring-circle ring-glow-green"
            strokeDasharray="81.7"
            strokeDashoffset={81.7 * (1 - restRatio)}
          />
        </svg>
        {/* Central balance emoji */}
        <span className="text-base z-10 select-none transform group-hover:scale-110 transition-transform duration-200 cursor-default" role="img" aria-label="mood">
          {getBalanceEmoji()}
        </span>
      </div>

      {/* Score numbers and rating label */}
      <div className="flex flex-col justify-center leading-none z-10 pr-1">
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm sm:text-base font-black text-white tracking-tight">{score}</span>
          <span className="text-[8px] font-bold text-slate-500">/100</span>
        </div>
        <span className="text-[7px] font-black uppercase tracking-widest text-indigo-400 group-hover:text-indigo-300 transition-colors mt-0.5">
          {balance}
        </span>
      </div>
    </div>
  );
}
