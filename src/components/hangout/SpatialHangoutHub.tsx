import React, { useState } from 'react';
import { 
  Tv, 
  Palette, 
  Gamepad2, 
  Sparkles, 
  Play, 
  ArrowRight, 
  Copy, 
  Check, 
  Users, 
  Flame,
  Radio,
  Share2
} from 'lucide-react';
import type { Participant, ActivityType } from '../../types/index.ts';

interface SpatialHangoutHubProps {
  roomCode: string;
  participants: Participant[];
  currentParticipantId: string;
  isHost: boolean;
  onSelectActivity: (activity: 'watch' | 'skribbl' | 'games') => void;
}

export const SpatialHangoutHub: React.FC<SpatialHangoutHubProps> = ({
  roomCode,
  participants,
  currentParticipantId,
  isHost,
  onSelectActivity,
}) => {
  const [copied, setCopied] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [cardTilts, setCardTilts] = useState<Record<string, { rotateX: number; rotateY: number }>>({});

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePointerMove = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Normalize tilt between -8deg and 8deg
    const rotateY = ((x - centerX) / centerX) * 8;
    const rotateX = -((y - centerY) / centerY) * 8;
    
    setCardTilts(prev => ({
      ...prev,
      [id]: { rotateX, rotateY },
    }));
  };

  const handlePointerLeave = (id: string) => {
    setHoveredCard(null);
    setCardTilts(prev => ({
      ...prev,
      [id]: { rotateX: 0, rotateY: 0 },
    }));
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto min-h-full perspective-1500 select-none">
      {/* Cinematic Room Introduction Header */}
      <div className="text-center max-w-xl mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-6 duration-700">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold tracking-wider mb-3 shadow-xl backdrop-blur-md">
          <Sparkles size={13} className="text-indigo-400 animate-spin" />
          <span>VIRTUAL LOUNGE • ROOM #{roomCode}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
          What are we getting into tonight?
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto">
          Stream movies synchronously, play skribbl.io drawing battles, or party in voice & video without call drops.
        </p>

        {/* Quick Invite Strip */}
        <div className="mt-4 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-1.5 text-xs text-slate-300 shadow-lg">
          <span className="text-slate-400">Share Link:</span>
          <span className="font-mono text-indigo-300 font-semibold">{window.location.origin}/?room={roomCode}</span>
          <button
            onClick={handleCopyInvite}
            type="button"
            className="p-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold ml-1"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Floating 3D Spatial Activity Cards Stage */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 preserve-3d">
        {/* CARD 1: Watch Together (FrameX TV) */}
        <div
          onPointerMove={(e) => handlePointerMove('watch', e)}
          onPointerEnter={() => setHoveredCard('watch')}
          onPointerLeave={() => handlePointerLeave('watch')}
          style={{
            transform: cardTilts['watch']
              ? `perspective(1000px) rotateX(${cardTilts['watch'].rotateX}deg) rotateY(${cardTilts['watch'].rotateY}deg) translateZ(${hoveredCard === 'watch' ? '20px' : '0px'})`
              : undefined,
          }}
          className="relative rounded-3xl bg-gradient-to-b from-[#151329] via-[#0f101d] to-[#0a0b14] border border-pink-500/30 p-5 sm:p-6 shadow-2xl transition-all duration-300 preserve-3d cursor-pointer group hover:border-pink-500/60 hover:shadow-[0_20px_50px_rgba(236,72,153,0.2)] animate-levitate-a"
          onClick={() => onSelectActivity('watch')}
        >
          {/* Neon Rim Illumination */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/30 transition-all" />

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-600/30">
              <Tv size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-pink-500/10 border border-pink-500/30 text-pink-300">
              Cinema Sync
            </span>
          </div>

          <h3 className="text-lg font-black text-white group-hover:text-pink-200 transition-colors mb-1.5 flex items-center gap-1.5">
            <span>Watch Together</span>
            <ArrowRight size={16} className="text-pink-400 transition-transform group-hover:translate-x-1" />
          </h3>

          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Synchronized FrameX TV cinema streaming, YouTube sync, 3-2-1 countdown cue, and host screen share.
          </p>

          {/* Interactive Feature Tags */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              🎬 1080p Player
            </span>
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              ⏱️ Sync Cue
            </span>
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              🖥️ Screen Share
            </span>
          </div>

          <button
            type="button"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-pink-600/25 transition-all btn-tactile-3d flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play size={13} />
            <span>Launch Cinema Room</span>
          </button>
        </div>

        {/* CARD 2: Scribble Multiplayer Drawing Game */}
        <div
          onPointerMove={(e) => handlePointerMove('skribbl', e)}
          onPointerEnter={() => setHoveredCard('skribbl')}
          onPointerLeave={() => handlePointerLeave('skribbl')}
          style={{
            transform: cardTilts['skribbl']
              ? `perspective(1000px) rotateX(${cardTilts['skribbl'].rotateX}deg) rotateY(${cardTilts['skribbl'].rotateY}deg) translateZ(${hoveredCard === 'skribbl' ? '20px' : '0px'})`
              : undefined,
          }}
          className="relative rounded-3xl bg-gradient-to-b from-[#141832] via-[#0e1223] to-[#0a0b14] border border-indigo-500/35 p-5 sm:p-6 shadow-2xl transition-all duration-300 preserve-3d cursor-pointer group hover:border-indigo-500/70 hover:shadow-[0_20px_50px_rgba(99,102,241,0.25)] animate-levitate-b"
          onClick={() => onSelectActivity('skribbl')}
        >
          {/* Neon Rim Illumination */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/35 transition-all" />

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Palette size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              Art Attack
            </span>
          </div>

          <h3 className="text-lg font-black text-white group-hover:text-indigo-200 transition-colors mb-1.5 flex items-center gap-1.5">
            <span>Scribble Game</span>
            <ArrowRight size={16} className="text-indigo-400 transition-transform group-hover:translate-x-1" />
          </h3>

          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Real-time drawing canvas, live guessing chat, instant scoring, synchronized leaderboard & final Top 3 podium.
          </p>

          {/* Interactive Feature Tags */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              🎨 22 Colors
            </span>
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              🏆 Live Ranks
            </span>
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              🥇 Top 3 Podium
            </span>
          </div>

          <button
            type="button"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all btn-tactile-3d flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play size={13} />
            <span>Enter Drawing Board</span>
          </button>
        </div>

        {/* CARD 3: Party Games Hub */}
        <div
          onPointerMove={(e) => handlePointerMove('games', e)}
          onPointerEnter={() => setHoveredCard('games')}
          onPointerLeave={() => handlePointerLeave('games')}
          style={{
            transform: cardTilts['games']
              ? `perspective(1000px) rotateX(${cardTilts['games'].rotateX}deg) rotateY(${cardTilts['games'].rotateY}deg) translateZ(${hoveredCard === 'games' ? '20px' : '0px'})`
              : undefined,
          }}
          className="relative rounded-3xl bg-gradient-to-b from-[#18152c] via-[#100e1f] to-[#0a0b14] border border-amber-500/30 p-5 sm:p-6 shadow-2xl transition-all duration-300 preserve-3d cursor-pointer group hover:border-amber-500/60 hover:shadow-[0_20px_50px_rgba(245,158,11,0.2)] animate-levitate-c"
          onClick={() => onSelectActivity('games')}
        >
          {/* Neon Rim Illumination */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/30 transition-all" />

          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center text-white shadow-lg shadow-amber-600/30">
              <Gamepad2 size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Casual Party
            </span>
          </div>

          <h3 className="text-lg font-black text-white group-hover:text-amber-200 transition-colors mb-1.5 flex items-center gap-1.5">
            <span>Games Hub</span>
            <ArrowRight size={16} className="text-amber-400 transition-transform group-hover:translate-x-1" />
          </h3>

          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Multi-player Quick Trivia, Would You Rather dilemmas, Truth or Dare, and interactive Tic-Tac-Toe.
          </p>

          {/* Interactive Feature Tags */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              🎲 Trivia
            </span>
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              🔥 Truth/Dare
            </span>
            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
              ⚡ Tic-Tac-Toe
            </span>
          </div>

          <button
            type="button"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold text-xs shadow-lg shadow-amber-600/25 transition-all btn-tactile-3d flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play size={13} />
            <span>Open Games Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
};
