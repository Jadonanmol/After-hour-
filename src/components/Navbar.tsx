import React, { useState } from 'react';
import { 
  Tv, 
  Palette, 
  Gamepad2, 
  MessageSquare, 
  Copy, 
  Check, 
  Lock, 
  Unlock, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Users, 
  Sparkles,
  Maximize2,
  Vote,
  Crown
} from 'lucide-react';
import type { TabType, ActivityType, ActivityVoteSession, Participant, CallLayoutMode } from '../types/index.ts';

interface NavbarProps {
  roomCode: string;
  roomName: string;
  isLocked: boolean;
  isHost: boolean;
  activeTab: TabType;
  activeActivity: ActivityType;
  voteSession: ActivityVoteSession | null;
  participants: Participant[];
  currentParticipantId: string;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  callLayout: CallLayoutMode;
  unreadChatCount: number;
  isChatOpen: boolean;
  connectionStatus?: string | null;
  onOpenActivityHub: () => void;
  onTabChange: (tab: TabType) => void;
  onToggleLock: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleChat: () => void;
  onExpandCall: () => void;
}

const ACTIVITY_SHORT_NAMES: Record<ActivityType, string> = {
  hangout: 'Hangout Lounge',
  watch: 'Watch Together',
  skribbl: 'Skribbl Game',
  trivia: 'Quick Trivia',
  truth_or_dare: 'Truth or Dare',
  would_you_rather: 'Would You Rather',
  tic_tac_toe: 'Tic-Tac-Toe',
};

export const Navbar: React.FC<NavbarProps> = ({
  roomCode,
  roomName,
  isLocked,
  isHost,
  activeTab,
  activeActivity,
  voteSession,
  participants,
  currentParticipantId,
  isAudioMuted,
  isVideoOff,
  callLayout,
  unreadChatCount,
  isChatOpen,
  connectionStatus,
  onOpenActivityHub,
  onTabChange,
  onToggleLock,
  onToggleAudio,
  onToggleVideo,
  onToggleChat,
  onExpandCall,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyRoomCode = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Copy strictly only the room code (no https://, domain, paths, or query parameters)
    const cleanCode = (roomCode || '').trim();
    navigator.clipboard.writeText(cleanCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const isVotingActive = Boolean(voteSession?.isActive);

  return (
    <header className="h-13 sm:h-14 border-b border-white/10 bg-[#090b10]/95 backdrop-blur-md px-2.5 sm:px-4 md:px-6 flex items-center justify-between z-40 sticky top-0 shrink-0">
      {/* Brand & Room Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xs sm:text-sm tracking-wider shrink-0">
            AH
          </div>
          <div>
            <h1 className="font-bold text-xs sm:text-sm tracking-wide text-white flex items-center gap-1.5">
              <span>AFTERHOURS</span>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" title="Room live" />
            </h1>
          </div>
        </div>

        {/* Room Code & Copy Button */}
        <div className="relative flex items-center gap-1 sm:gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-mono">
          <span className="text-slate-400 text-[10px] sm:text-xs">ROOM:</span>
          <span className="text-indigo-300 font-bold">{roomCode}</span>
          <button
            onClick={handleCopyRoomCode}
            aria-label="Copy room code"
            title={copiedCode ? "Room code copied!" : "Copy room code"}
            className="ml-0.5 sm:ml-1 text-slate-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer flex items-center"
          >
            {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
          {copiedCode && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#121526] border border-emerald-500/40 text-emerald-300 text-[10px] font-sans font-bold px-2 py-0.5 rounded-md shadow-xl animate-in fade-in z-50 flex items-center gap-1">
              <Check size={11} className="text-emerald-400" />
              <span>Room code copied!</span>
            </div>
          )}
        </div>

        {/* Subtle Connection Quality Feedback */}
        {connectionStatus === 'reconnecting' && (
          <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-0.5 text-[10px] text-amber-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Reconnecting audio/video...</span>
          </div>
        )}

        {/* Host lock button */}
        {isHost && (
          <button
            onClick={onToggleLock}
            title={isLocked ? 'Room is locked to new guests' : 'Room is unlocked'}
            aria-label={isLocked ? 'Unlock room' : 'Lock room'}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all cursor-pointer ${
              isLocked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
            <span className="hidden md:inline text-[11px]">{isLocked ? 'Locked' : 'Unlocked'}</span>
          </button>
        )}
      </div>

      {/* Center: Activity Hub Button & Active Indicator */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenActivityHub}
          aria-label="Open Activity Hub"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/30 to-violet-600/30 hover:from-indigo-600/40 hover:to-violet-600/40 border border-indigo-500/40 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
        >
          <Vote size={15} className="text-indigo-400" />
          <span className="hidden md:inline">Activity Hub</span>
          <span className="text-[11px] font-normal text-indigo-200 hidden lg:inline">
            • {ACTIVITY_SHORT_NAMES[activeActivity] || activeActivity}
          </span>

          {isVotingActive && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-black font-mono font-bold text-[10px] animate-pulse">
              VOTE {voteSession?.timeLeft}s
            </span>
          )}
        </button>

        {/* Quick Activity View switcher for active sections */}
        <nav aria-label="Lounge activities" className="hidden xl:flex items-center bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
          <button
            onClick={() => onTabChange('hangout')}
            aria-label="Hangout lounge"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'hangout'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Sparkles size={13} />
            <span>Hangout</span>
          </button>

          <button
            onClick={() => onTabChange('watch')}
            aria-label="Watch Together"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'watch'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Tv size={13} />
            <span>Watch</span>
          </button>

          <button
            onClick={() => onTabChange('skribbl')}
            aria-label="Skribbl drawing game"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'skribbl'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Palette size={13} />
            <span>Skribbl</span>
          </button>

          <button
            onClick={() => onTabChange('games')}
            aria-label="Games hub"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'games'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Gamepad2 size={13} />
            <span>Games</span>
          </button>
        </nav>
      </div>

      {/* Right Controls: Quick Call Toggles & Chat */}
      <div className="flex items-center gap-2">
        {/* If call is minimized, show quick mute/camera toggles directly in navbar */}
        {callLayout === 'minimized' && (
          <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            <button
              onClick={onToggleAudio}
              aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
              title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`p-1.5 rounded-md text-xs cursor-pointer ${
                isAudioMuted ? 'bg-red-500/20 text-red-400' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {isAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={onToggleVideo}
              aria-label={isVideoOff ? 'Enable camera' : 'Disable camera'}
              title={isVideoOff ? 'Enable camera' : 'Disable camera'}
              className={`p-1.5 rounded-md text-xs cursor-pointer ${
                isVideoOff ? 'bg-red-500/20 text-red-400' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
            </button>
            <button
              onClick={onExpandCall}
              aria-label="Expand video call"
              title="Expand video call"
              className="p-1.5 rounded-md text-xs text-indigo-300 hover:bg-white/10 cursor-pointer"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        )}

        {/* Participant Count Badge */}
        <div 
          className="flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10"
          title={`${participants.length} connected in room`}
        >
          <Users size={13} className="text-indigo-400" />
          <span className="font-mono font-medium">{participants.length}</span>
        </div>

        {/* Live Chat Drawer Toggle */}
        <button
          onClick={onToggleChat}
          aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
          className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
            isChatOpen
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <MessageSquare size={16} />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
