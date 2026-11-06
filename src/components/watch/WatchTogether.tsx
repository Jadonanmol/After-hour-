import React, { useState } from 'react';
import { 
  Tv, 
  ExternalLink, 
  Share2, 
  Play, 
  Pause, 
  RefreshCw, 
  Info, 
  Sparkles, 
  Volume2, 
  Sliders,
  ShieldCheck,
  Radio,
  ArrowLeft
} from 'lucide-react';
import type { WatchPartyState, Participant } from '../../types/index.ts';

interface WatchTogetherProps {
  watchParty: WatchPartyState;
  isHost: boolean;
  participants: Participant[];
  screenSharingParticipant?: Participant;
  screenStream: MediaStream | null;
  onSetMedia: (title: string, url: string) => void;
  onTriggerSyncCue: () => void;
  onToggleStatus: (status: 'playing' | 'paused') => void;
  onStartScreenShare: () => void;
  onReturnToHangout: () => void;
  onHostReturnToHangout?: () => void;
}

export const WatchTogether: React.FC<WatchTogetherProps> = ({
  watchParty,
  isHost,
  participants,
  screenSharingParticipant,
  screenStream,
  onSetMedia,
  onTriggerSyncCue,
  onToggleStatus,
  onStartScreenShare,
  onReturnToHangout,
  onHostReturnToHangout,
}) => {
  const [targetUrl, setTargetUrl] = useState(watchParty.url || 'https://framextv.xyz/');
  const [iframeKey, setIframeKey] = useState(0);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [showSyncInfo, setShowSyncInfo] = useState(false);

  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

  const handleOpenExternal = () => {
    window.open('https://framextv.xyz/', '_blank', 'noopener,noreferrer');
  };

  const handleReloadIframe = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onSetMedia('FrameX TV', targetUrl);
    setIsEditingUrl(false);
  };

  const handleClickReturn = () => {
    if (isHost) {
      setShowReturnConfirm(true);
    } else {
      onReturnToHangout();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07080d] overflow-hidden relative">
      {/* Top Theater Header & Watch Party Cues */}
      <div className="h-14 border-b border-white/10 bg-[#0e101b]/90 backdrop-blur-md px-4 md:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={handleClickReturn}
            aria-label="Return to Hangout lounge"
            title="Return to Hangout (keeps video call active)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Return to Hangout</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Tv size={16} />
            </span>
            <div>
              <h2 className="text-xs md:text-sm font-bold text-white tracking-wide truncate flex items-center gap-2">
                FrameX TV
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                  Watch Together
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Action Controls & Sync Beacons */}
        <div className="flex items-center gap-2">
          {/* Synchronized Launch / Countdown Button */}
          <button
            onClick={onTriggerSyncCue}
            aria-label="Broadcast 3-2-1 play countdown"
            title="Broadcast 3-2-1 Countdown to all friends"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Radio size={13} className="animate-pulse" />
            <span className="hidden sm:inline">Sync Countdown (3-2-1)</span>
            <span className="sm:hidden">Sync</span>
          </button>

          {/* Open FrameX TV in New Tab Button */}
          <button
            onClick={handleOpenExternal}
            aria-label="Open FrameX TV in a new tab"
            title="Open https://framextv.xyz in separate tab"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <ExternalLink size={13} />
            <span className="hidden md:inline">Open in Tab</span>
          </button>

          {/* Screen Share Alternative Button */}
          <button
            onClick={onStartScreenShare}
            aria-label="Share movie screen"
            title="Screen share your FrameX tab directly to friends"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <Share2 size={13} />
            <span className="hidden md:inline">Screen Share</span>
          </button>

          {/* Info toggle */}
          <button
            onClick={() => setShowSyncInfo(!showSyncInfo)}
            aria-label="Watch party integration details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <Info size={15} />
          </button>
        </div>
      </div>

      {/* Sync Countdown Banner Overlay */}
      {watchParty.countdown !== null && (
        <div className="absolute top-16 inset-x-0 z-30 flex justify-center pointer-events-none animate-in fade-in zoom-in duration-150">
          <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 text-white px-6 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20">
            <Radio size={18} className="animate-ping" />
            <div className="text-center">
              <span className="text-xs uppercase tracking-widest font-semibold block text-indigo-100">
                Synchronized Watch Cue
              </span>
              <span className="text-2xl font-black font-mono">
                {watchParty.countdown > 0 ? `START IN ${watchParty.countdown}...` : 'PLAY NOW!'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Synchronization & Integration Notice Modal */}
      {showSyncInfo && (
        <div className="bg-[#121524] border-b border-indigo-500/20 px-6 py-3 text-xs text-slate-300 flex items-start justify-between gap-4 z-20">
          <div className="space-y-1">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              FrameX TV Official Embedding & Watch Party Guide
            </p>
            <p className="text-slate-400">
              AFTERHOURS embeds <span className="text-indigo-300 font-mono">https://framextv.xyz/</span> directly in this viewport.
              Because FrameX TV does not expose cross-origin programmatic control hooks (Same-Origin Policy), AFTERHOURS provides synchronized 3-2-1 countdown beacons and browser tab screen-sharing so your group can watch seamlessly together.
            </p>
            <p className="text-slate-400">
              💡 <strong>Audio isolation:</strong> Your microphone and the movie playback audio are completely independent. You can talk freely with friends while listening to movie audio.
            </p>
          </div>
          <button
            onClick={() => setShowSyncInfo(false)}
            aria-label="Dismiss notice"
            className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area: Embedded FrameX TV or Live Screen Share Presentation */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {screenSharingParticipant && screenStream ? (
          /* Live Screen Share View */
          <div className="w-full h-full relative flex items-center justify-center bg-black">
            <video
              ref={(el) => {
                if (el && el.srcObject !== screenStream) {
                  el.srcObject = screenStream;
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white flex items-center gap-2 shadow-lg">
              <Share2 size={14} className="text-indigo-400" />
              <span>Streaming from {screenSharingParticipant.name}'s screen</span>
            </div>
          </div>
        ) : (
          /* Real Embedded FrameX TV Viewport */
          <div className="w-full h-full relative flex flex-col">
            <iframe
              key={iframeKey}
              src={watchParty.url || 'https://framextv.xyz/'}
              title="FrameX TV Watch Together Player"
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />

            {/* Quick Helper Floating Bar at the bottom of the player */}
            <div className="absolute bottom-3 left-4 right-4 md:right-auto md:w-auto bg-[#0d0f1a]/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex items-center gap-3 text-xs text-slate-300 shadow-xl pointer-events-auto">
              <span className="text-[11px] font-mono text-slate-400">Source: https://framextv.xyz/</span>
              <button
                onClick={handleReloadIframe}
                title="Reload player"
                aria-label="Reload FrameX TV player"
                className="p-1 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={handleOpenExternal}
                className="text-indigo-300 hover:text-indigo-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Pop Out</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Return to Hangout Confirmation Modal */}
      {showReturnConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#131524] border border-white/10 rounded-3xl p-6 shadow-2xl text-center">
            <h3 className="text-base font-bold text-white mb-1">Return to Hangout?</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              As Host, choose whether to return the entire room to the Hangout video lounge or step back just for yourself.
              <strong className="block text-indigo-300 mt-1">Your video call will remain connected!</strong>
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowReturnConfirm(false);
                  if (onHostReturnToHangout) onHostReturnToHangout();
                  else onReturnToHangout();
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                Return Entire Room to Hangout
              </button>
              <button
                onClick={() => {
                  setShowReturnConfirm(false);
                  onReturnToHangout();
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Return Just for Me
              </button>
              <button
                onClick={() => setShowReturnConfirm(false)}
                className="w-full py-2 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
