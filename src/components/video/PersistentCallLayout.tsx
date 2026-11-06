import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  Minimize2,
  Maximize2,
  PhoneOff,
  Settings,
  Shield,
  Volume2,
  VolumeX,
  MoreVertical,
  UserX,
  Radio,
  Check,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Tv,
  Palette,
  Gamepad2,
  Copy,
  Sparkles,
  Users
} from 'lucide-react';
import type { Participant, CallLayoutMode, CameraHealthStatus } from '../../types/index.ts';
import { mediaService, type MediaDeviceState } from '../../services/mediaService.ts';
import { SpatialHangoutHub } from '../hangout/SpatialHangoutHub.tsx';

interface PersistentCallLayoutProps {
  participants: Participant[];
  currentParticipantId: string;
  isHost: boolean;
  layoutMode: CallLayoutMode;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  roomCode?: string;
  onLayoutChange: (mode: CallLayoutMode) => void;
  onSelectActivity?: (activity: 'watch' | 'skribbl' | 'games') => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeaveCall: () => void;
  onKickParticipant?: (id: string) => void;
}

// -----------------------------------------------------------------------------
// Live Circular Participant Video Bubble (In-Game / Call Bar Strip - Requirement 4 & Part B)
// -----------------------------------------------------------------------------
interface ParticipantVideoBubbleProps {
  participant: Participant;
  isLocal: boolean;
  localStream: MediaStream | null;
  mediaVersion: number;
  isSelected?: boolean;
  onClick?: () => void;
  cameraHealth?: CameraHealthStatus;
}

const ParticipantVideoBubble: React.FC<ParticipantVideoBubbleProps> = ({
  participant,
  isLocal,
  localStream,
  mediaVersion,
  isSelected,
  onClick,
  cameraHealth,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteStream = !isLocal ? mediaService.getRemoteVideoStream(participant.id) : null;
  const remoteMediaEntry = !isLocal ? mediaService.remoteStreams.get(participant.id) : null;

  useEffect(() => {
    if (!videoRef.current) return;
    const targetStream = isLocal ? localStream : remoteStream;
    const cleanup = mediaService.attachVideoElement(videoRef.current, targetStream, isLocal);
    return cleanup;
  }, [isLocal, localStream, remoteStream, mediaVersion]);

  const hasLiveVideo = isLocal
    ? !participant.isVideoOff && Boolean(localStream)
    : !participant.isVideoOff && Boolean(remoteStream) && !remoteMediaEntry?.isVideoMuted;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${participant.name}${isLocal ? ' (You)' : ''}${participant.isSpeaking ? ' • Speaking' : ''}${participant.isDisconnected ? ' • Reconnecting...' : ''}${isLocal && cameraHealth === 'recovering' ? ' • Recovering camera...' : ''}`}
      className={`relative w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full overflow-hidden shrink-0 transition-transform hover:scale-110 active:scale-95 cursor-pointer border-2 select-none flex items-center justify-center ${
        participant.isSpeaking
          ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
          : participant.isDisconnected
          ? 'border-amber-400/80 ring-1 ring-amber-400/40 opacity-70'
          : isSelected
          ? 'border-indigo-400 ring-2 ring-indigo-400/60'
          : 'border-white/20 hover:border-white/50'
      }`}
      style={{ backgroundColor: participant.color || '#1e1b4b' }}
    >
      {/* Live Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover rounded-full ${isLocal ? 'scale-x-[-1]' : ''} ${
          hasLiveVideo ? 'opacity-100' : 'opacity-0 absolute inset-0'
        }`}
      />

      {/* Avatar Fallback when camera is off or loading */}
      {!hasLiveVideo && (
        <div className="w-full h-full flex items-center justify-center text-xs sm:text-sm font-bold select-none text-white">
          <span>{participant.avatar || '👤'}</span>
        </div>
      )}

      {/* Mic Muted Badge */}
      {participant.isAudioMuted && (
        <span className="absolute bottom-0 right-0 bg-red-600 text-white rounded-full p-0.5 shadow-sm border border-[#10121d]">
          <MicOff size={7} />
        </span>
      )}

      {/* Camera Off Indicator Dot */}
      {participant.isVideoOff && !participant.isAudioMuted && (
        <span className="absolute top-0 right-0 bg-slate-700 text-slate-300 rounded-full p-0.5 border border-[#10121d]">
          <VideoOff size={7} />
        </span>
      )}

      {/* Reconnecting Badge */}
      {participant.isDisconnected && (
        <span className="absolute inset-0 bg-black/60 flex items-center justify-center text-[8px] text-amber-300 font-bold">
          ⚡
        </span>
      )}

      {/* Camera Recovering Pulse */}
      {isLocal && cameraHealth === 'recovering' && (
        <span 
          title="Recovering camera..."
          className="absolute inset-0 bg-indigo-950/70 flex items-center justify-center text-[8px] text-amber-300 font-bold animate-pulse"
        >
          ⚡
        </span>
      )}

      {/* Camera Stalled Warning */}
      {isLocal && cameraHealth === 'failed' && (
        <span
          title="Camera stalled. Tap to recover"
          className="absolute inset-0 bg-red-950/80 flex items-center justify-center text-[8px] text-white font-bold"
        >
          ⚠️
        </span>
      )}
    </button>
  );
};

export const PersistentCallLayout: React.FC<PersistentCallLayoutProps> = ({
  participants,
  currentParticipantId,
  isHost,
  layoutMode,
  localStream,
  screenStream,
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  roomCode = '',
  onLayoutChange,
  onSelectActivity,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveCall,
  onKickParticipant,
}) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedMenuParticipantId, setSelectedMenuParticipantId] = useState<string | null>(null);
  const [selectedBubbleParticipantId, setSelectedBubbleParticipantId] = useState<string | null>(null);
  const [hideSelfPreview, setHideSelfPreview] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceState>({
    audioInputs: [],
    videoInputs: [],
    selectedAudioInputId: '',
    selectedVideoInputId: '',
  });

  const [remoteMediaVersion, setRemoteMediaVersion] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(mediaService.audioPlaybackBlocked);
  const [cameraHealth, setCameraHealth] = useState<CameraHealthStatus>(mediaService.cameraHealth);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [copiedRoomCodeOnly, setCopiedRoomCodeOnly] = useState(false);

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedRoomCode(true);
      setTimeout(() => setCopiedRoomCode(false), 2000);
    });
  };

  const handleCopyRoomCodeOnly = () => {
    const cleanCode = (roomCode || '').trim();
    navigator.clipboard.writeText(cleanCode).then(() => {
      setCopiedRoomCodeOnly(true);
      setTimeout(() => setCopiedRoomCodeOnly(false), 2000);
    });
  };

  useEffect(() => {
    mediaService.getDevices().then(setDevices);
    mediaService.onDevicesChanged = () => {
      mediaService.getDevices().then(setDevices);
    };
    mediaService.onRemoteStreamsChange = () => {
      setRemoteMediaVersion(v => v + 1);
    };
    mediaService.onAudioPlaybackBlockedChange = (blocked) => {
      setAudioBlocked(blocked);
    };
    mediaService.onCameraHealthChange = (status) => {
      setCameraHealth(status);
    };
  }, []);

  // Floating position & state for draggable floating call bar
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompactPill, setIsCompactPill] = useState(false);
  const [showFloatingVideoPiP, setShowFloatingVideoPiP] = useState(false);
  const floatingBarRef = useRef<HTMLDivElement>(null);
  const currentParticipant = participants.find(p => p.id === currentParticipantId);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // Keep floating bar bounded inside viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setFloatingPos((prev) => {
        if (!prev) return null;
        const barWidth = floatingBarRef.current?.offsetWidth || 340;
        const barHeight = floatingBarRef.current?.offsetHeight || 56;
        return {
          x: Math.max(10, Math.min(window.innerWidth - barWidth - 10, prev.x)),
          y: Math.max(56, Math.min(window.innerHeight - barHeight - 10, prev.y)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFloatingPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If the click is inside an interactive element, let the button handle it
    if ((e.target as HTMLElement).closest('button, input, select, a, [role="button"]')) {
      return;
    }
    const barEl = floatingBarRef.current;
    if (!barEl) return;
    const rect = barEl.getBoundingClientRect();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: rect.left,
      initY: rect.top,
    };
  };

  const handleFloatingPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current || !floatingBarRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const barWidth = floatingBarRef.current.offsetWidth || 340;
    const barHeight = floatingBarRef.current.offsetHeight || 56;

    // Bounds clamping:
    // Min X: 10px from left edge
    // Max X: window.innerWidth - barWidth - 10px
    // Min Y: 56px (below the top navigation bar)
    // Max Y: window.innerHeight - barHeight - 10px
    const newX = Math.max(10, Math.min(window.innerWidth - barWidth - 10, dragStartRef.current.initX + deltaX));
    const newY = Math.max(56, Math.min(window.innerHeight - barHeight - 10, dragStartRef.current.initY + deltaY));

    setFloatingPos({ x: newX, y: newY });
  };

  const handleFloatingPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFloatingPos(null);
  };

  // Find active speaker or current participant for picture-in-picture preview
  const activeSpeaker = participants.find(p => p.isSpeaking && !p.isAudioMuted) || currentParticipant;

  // ---------------------------------------------------------------------------
  // Floating Mode (Draggable Call Bar over Games / Activities)
  // ---------------------------------------------------------------------------
  if (layoutMode === 'minimized') {
    const floatingStyle: React.CSSProperties = floatingPos
      ? {
          left: `${floatingPos.x}px`,
          top: `${floatingPos.y}px`,
          right: 'auto',
          bottom: 'auto',
        }
      : {
          right: '20px',
          bottom: '20px',
        };

    return (
      <div
        ref={floatingBarRef}
        role="region"
        aria-label="Active call floating overlay"
        style={floatingStyle}
        onPointerDown={handleFloatingPointerDown}
        onPointerMove={handleFloatingPointerMove}
        onPointerUp={handleFloatingPointerUp}
        onPointerCancel={handleFloatingPointerUp}
        className={`fixed z-50 flex flex-col items-end select-none transition-shadow duration-150 ${
          isDragging ? 'cursor-grabbing scale-[1.01]' : 'cursor-default'
        }`}
      >
        {/* Expanded Participant Preview popover when a bubble is clicked */}
        {selectedBubbleParticipantId && (() => {
          const selectedParticipant = participants.find(p => p.id === selectedBubbleParticipantId);
          if (!selectedParticipant) return null;

          return (
            <div className="mb-2 w-64 bg-[#10121d] border border-indigo-500/40 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs">{selectedParticipant.avatar}</span>
                  <span className="text-[11px] font-semibold text-slate-200 truncate">
                    {selectedParticipant.name} {selectedParticipant.id === currentParticipantId && '(You)'}
                  </span>
                  {selectedParticipant.isSpeaking && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
                <button
                  onClick={() => setSelectedBubbleParticipantId(null)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="h-36 bg-black flex items-center justify-center relative">
                <VideoTile
                  participant={selectedParticipant}
                  isLocal={selectedParticipant.id === currentParticipantId}
                  localStream={selectedParticipant.id === currentParticipantId ? localStream : null}
                  screenStream={selectedParticipant.isScreenSharing && selectedParticipant.id === currentParticipantId ? screenStream : null}
                  isHostViewer={isHost}
                  mediaVersion={remoteMediaVersion}
                  cameraHealth={cameraHealth}
                />
              </div>





              
              <div className="p-1.5 bg-black/40 text-center flex items-center justify-between px-3">
                <span className="text-[10px] text-slate-400">
                  {selectedParticipant.isVideoOff ? 'Camera Off' : 'Live Camera'}
                </span>
                <button
                  onClick={() => setSelectedBubbleParticipantId(null)}
                  className="text-[10px] text-indigo-300 hover:text-white font-medium cursor-pointer"
                >
                  ← Close
                </button>
              </div>
            </div>
          );
        })()}

        {/* Main Floating Bar Container */}
        <div
          className={`flex items-center gap-2 bg-[#10121d]/95 border border-indigo-500/35 p-2 rounded-2xl backdrop-blur-xl shadow-2xl transition-all ${
            isDragging
              ? 'ring-2 ring-indigo-500/80 shadow-[0_16px_40px_rgba(99,102,241,0.35)]'
              : 'hover:border-indigo-400/60 hover:shadow-indigo-500/10'
          }`}
        >
          {/* Drag Handle Grip */}
          <div
            title="Drag to float anywhere • Double click to snap to corner"
            onDoubleClick={handleResetPosition}
            className="flex items-center justify-center px-1 py-1 text-slate-400 hover:text-indigo-300 cursor-grab active:cursor-grabbing transition-colors rounded-lg hover:bg-white/5"
          >
            <GripVertical size={16} />
          </div>

          {/* Compact Pill Mode Content vs Full Bar Content */}
          {isCompactPill ? (
            /* Compact Pill View */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-sans">LIVE</span>
                <span className="text-[10px] text-slate-400 font-mono ml-0.5">({participants.length})</span>
              </div>

              <button
                onClick={onToggleAudio}
                aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                {isAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>

              <button
                onClick={onToggleVideo}
                aria-label={isVideoOff ? 'Enable camera' : 'Disable camera'}
                className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLeaveModal(true);
                }}
                aria-label="End call"
                title="End Call"
                className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs cursor-pointer transition-colors"
              >
                <PhoneOff size={13} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCompactPill(false);
                }}
                aria-label="Expand floating call bar"
                title="Expand floating bar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          ) : (
            /* Full Floating Bar Content with Live Circular Video Strip (Requirement 4) */
            <>
              {/* Circular Live Participant Video Bubbles Strip */}
              <div 
                aria-label="Live participant video strip"
                className="flex items-center gap-1.5 overflow-x-auto max-w-[180px] sm:max-w-[280px] md:max-w-md scrollbar-none px-1 py-0.5"
              >
                {participants.map((p) => (
                  <ParticipantVideoBubble
                    key={p.id}
                    participant={p}
                    isLocal={p.id === currentParticipantId}
                    localStream={localStream}
                    mediaVersion={remoteMediaVersion}
                    cameraHealth={cameraHealth}
                    isSelected={selectedBubbleParticipantId === p.id}
                    onClick={() => {
                      if (selectedBubbleParticipantId === p.id) {
                        setSelectedBubbleParticipantId(null);
                      } else {
                        setSelectedBubbleParticipantId(p.id);
                      }
                    }}
                  />
                ))}
              </div>

              {/* Pulsing LIVE Audio / Room Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5 text-xs font-mono text-emerald-400 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-sans font-bold">LIVE</span>
              </div>

              {/* Essential Floating Controls */}
              <div className="flex items-center gap-1 border-l border-white/10 pl-2 shrink-0">
                <button
                  onClick={onToggleAudio}
                  aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                  title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    isAudioMuted
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {isAudioMuted ? <MicOff size={15} /> : <Mic size={15} />}
                </button>

                <button
                  onClick={onToggleVideo}
                  aria-label={isVideoOff ? 'Enable camera' : 'Disable camera'}
                  title={isVideoOff ? 'Enable camera' : 'Disable camera'}
                  className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    isVideoOff
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {isVideoOff ? <VideoOff size={15} /> : <Video size={15} />}
                </button>

                {/* Quick Audio/Video Device Settings */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettingsModal(true);
                  }}
                  aria-label="Device settings"
                  title="Audio & Video Settings"
                  className="p-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  <Settings size={15} />
                </button>

                {/* Return to Full Hangout Call Grid */}
                <button
                  onClick={() => onLayoutChange('full')}
                  aria-label="Expand to full video call grid"
                  title="Expand to full video grid"
                  className="p-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 transition-colors cursor-pointer"
                >
                  <Maximize2 size={15} />
                </button>

                {/* Prominent, Clearly Visible Red End Call Button (Requirement 4) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLeaveModal(true);
                  }}
                  aria-label="End call"
                  title="Leave / End Call"
                  className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30 text-xs transition-all cursor-pointer ml-1"
                >
                  <PhoneOff size={15} />
                </button>

                {/* Collapse to Mini Pill */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCompactPill(true);
                  }}
                  aria-label="Collapse to mini pill"
                  title="Collapse to mini pill"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs transition-colors cursor-pointer"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Device Settings Modal accessible from floating bar */}
        {showSettingsModal && (
          <DeviceSettingsModal
            devices={devices}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Docked Mode (Sidebar alongside Watch Together or Games)
  // ---------------------------------------------------------------------------
  if (layoutMode === 'docked') {
    return (
      <aside 
        aria-label="Active video call panel"
        className="w-full lg:w-80 h-auto lg:h-full bg-[#0d0f18] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col shrink-0 z-30"
      >
        {/* Call Header */}
        <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Live Video Call
            </span>
            <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
              {participants.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onLayoutChange('minimized')}
              aria-label="Float call bar over game"
              title="Float call bar over game"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <Minimize2 size={15} />
            </button>
            <button
              onClick={() => onLayoutChange('full')}
              aria-label="Full screen call grid"
              title="Expand to full screen"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>












        {/* Video Tile List / Grid */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3">
          {participants.map((participant) => (
            <VideoTile
              key={participant.id}
              participant={participant}
              isLocal={participant.id === currentParticipantId}
              localStream={participant.id === currentParticipantId ? localStream : null}
              screenStream={participant.isScreenSharing && participant.id === currentParticipantId ? screenStream : null}
              isHostViewer={isHost}
              onKick={onKickParticipant}
              mediaVersion={remoteMediaVersion}
              cameraHealth={cameraHealth}
            />
          ))}
        </div>














        {/* Call Controls Footer */}
        <CallControlsToolbar
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onToggleScreenShare={onToggleScreenShare}
          onOpenSettings={() => setShowSettingsModal(true)}
          onRequestLeave={() => setShowLeaveModal(true)}
        />

        {showSettingsModal && (
          <DeviceSettingsModal
            devices={devices}
            onClose={() => setShowSettingsModal(false)}
          />
        )}

        {showLeaveModal && (
          <LeaveConfirmationModal
            onConfirm={onLeaveCall}
            onCancel={() => setShowLeaveModal(false)}
          />
        )}
      </aside>
    );
  }

  // ---------------------------------------------------------------------------
  // Full Mode: Responsive Video-Call-First Hangout Room
  // ---------------------------------------------------------------------------
  const localParticipant = participants.find(p => p.id === currentParticipantId);
  const remoteParticipants = participants.filter(p => p.id !== currentParticipantId);
  const remoteCount = remoteParticipants.length;

  return (
    <section 
      aria-label="Live Hangout room"
      className="flex-1 flex flex-col h-full w-full bg-[#060810] text-slate-100 overflow-hidden relative select-none"
    >
      {/* Audio Playback Autoplay Unblock Banner */}
      {audioBlocked && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce border border-amber-300">
          <VolumeX size={16} />
          <span>Sound is muted by your browser autoplay settings</span>
          <button
            onClick={() => mediaService.unblockAudio()}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-xl text-xs font-extrabold cursor-pointer ml-1 shadow"
          >
            Unmute Audio
          </button>
        </div>
      )}

      {/* =========================================================================
          TOP SECTION: LIVE HANGOUT (Remote Participant Video Area ~65-70% height)
          ========================================================================= */}
      <div className="flex-[74] md:flex-[67] min-h-0 flex flex-col p-2.5 sm:p-4 md:p-5 relative overflow-hidden bg-gradient-to-b from-[#090b16] to-[#060810]">
        {/* Live Hangout Section Header */}
        <div className="flex items-center justify-between pb-2 sm:pb-3 shrink-0 border-b border-white/5 mb-2 sm:mb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            <h2 className="font-extrabold text-xs sm:text-sm tracking-widest uppercase text-white flex items-center gap-2">
              <span>Live Hangout</span>
              <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold">
                {remoteCount === 0 ? '1 in room (You)' : `${participants.length} in room`}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              ROOM #{roomCode}
            </span>
            <button
              onClick={() => onLayoutChange('docked')}
              aria-label="Dock call to sidebar"
              title="Dock call to sidebar"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors cursor-pointer border border-white/5"
            >
              <Minimize2 size={12} />
              <span className="hidden sm:inline">Dock to Sidebar</span>
            </button>
          </div>
        </div>

        {/* Remote Video Grid or Attractive Waiting State */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">
          {remoteCount === 0 ? (
            /* Attractive Waiting State when alone in room */
            <div className="max-w-md w-full mx-auto p-6 sm:p-8 rounded-3xl bg-[#0f1222]/90 border border-indigo-500/20 backdrop-blur-xl shadow-2xl text-center flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-violet-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-4 shadow-xl">
                <Users size={28} className="animate-pulse" />
              </div>

              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2">
                You're the first one here!
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
                Share your room code with friends to start the live video call and jump into movies and games together.
              </p>

              <div className="w-full flex flex-col sm:flex-row items-center gap-2">
                <div className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-indigo-300 w-full sm:w-auto relative">
                  <span className="text-slate-500 text-[10px]">ROOM</span>
                  <span className="text-sm tracking-wider text-white font-mono">#{roomCode}</span>
                  <button
                    type="button"
                    onClick={handleCopyRoomCodeOnly}
                    aria-label="Copy room code"
                    title={copiedRoomCodeOnly ? "Room code copied!" : "Copy room code"}
                    className="ml-1 text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer flex items-center"
                  >
                    {copiedRoomCodeOnly ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                  {copiedRoomCodeOnly && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#121526] border border-emerald-500/40 text-emerald-300 text-[10px] font-sans font-bold px-2 py-0.5 rounded-md shadow-xl animate-in fade-in z-50 flex items-center gap-1">
                      <Check size={10} className="text-emerald-400" />
                      <span>Room code copied!</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {copiedRoomCode ? (
                    <>
                      <Check size={14} className="text-emerald-300" />
                      <span>Invite Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Adaptive Responsive Remote Video Grid */
            <div className="w-full h-full min-h-0 relative flex items-center justify-center">
              {remoteCount === 1 ? (
                /* One remote participant: one large centered video tile */
                <div className="w-full h-full max-h-full max-w-5xl mx-auto flex items-center justify-center p-1">
                  <div className="w-full h-full max-h-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl relative">
                    <VideoTile
                      participant={remoteParticipants[0]}
                      isLocal={false}
                      localStream={null}
                      screenStream={null}
                      isHostViewer={isHost}
                      onKick={onKickParticipant}
                      mediaVersion={remoteMediaVersion}
                    />
                  </div>
                </div>
              ) : remoteCount === 2 ? (
                /* Two participants: balanced large tiles side-by-side or stacked on portrait */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full h-full max-h-full max-w-6xl mx-auto p-1">
                  {remoteParticipants.map(participant => (
                    <div
                      key={participant.id}
                      className="w-full h-full min-h-0 min-w-0 rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-xl relative"
                    >
                      <VideoTile
                        participant={participant}
                        isLocal={false}
                        localStream={null}
                        screenStream={null}
                        isHostViewer={isHost}
                        onKick={onKickParticipant}
                        mediaVersion={remoteMediaVersion}
                      />
                    </div>
                  ))}
                </div>
              ) : remoteCount <= 4 ? (
                /* Three or four participants: balanced 2x2 grid */
                <div className="grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3.5 md:gap-4 w-full h-full max-h-full max-w-6xl mx-auto p-1">
                  {remoteParticipants.map(participant => (
                    <div
                      key={participant.id}
                      className="w-full h-full min-h-0 min-w-0 rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-xl relative"
                    >
                      <VideoTile
                        participant={participant}
                        isLocal={false}
                        localStream={null}
                        screenStream={null}
                        isHostViewer={isHost}
                        onKick={onKickParticipant}
                        mediaVersion={remoteMediaVersion}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Five or more participants: adaptive responsive grid with internal scroll */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 w-full h-full max-h-full overflow-y-auto p-1 pr-2">
                  {remoteParticipants.map(participant => (
                    <div
                      key={participant.id}
                      className="min-h-[140px] sm:min-h-[180px] aspect-video rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-lg relative"
                    >
                      <VideoTile
                        participant={participant}
                        isLocal={false}
                        localStream={null}
                        screenStream={null}
                        isHostViewer={isHost}
                        onKick={onKickParticipant}
                        mediaVersion={remoteMediaVersion}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          BOTTOM SECTION: SUBSTANTIAL ACTIVITY & CALL DOCK (~30-35% height)
          ========================================================================= */}
      <div className="flex-[26] md:flex-[33] min-h-0 border-t border-white/10 bg-[#090b14]/98 backdrop-blur-2xl p-2.5 sm:p-3 md:p-5 flex flex-col justify-between shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
        
        {/* DESKTOP VIEW (hidden md:flex): Complete Side-by-Side Composition */}
        <div className="hidden md:flex w-full h-full flex-row gap-4 md:gap-5 min-h-0">
          {/* LEFT — ACTIVITIES (approx 67-70% on desktop) */}
          <div className="w-[67%] lg:w-[70%] flex flex-col min-h-0 pr-4 border-r border-white/10">
            {/* Header: ACTIVITIES */}
            <div className="flex items-center justify-between pb-2 shrink-0">
              <span className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-400" />
                <span>Activities</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Launch synchronized party activity
              </span>
            </div>

            {/* Three Activity Cards in ONE Horizontal Row on desktop */}
            <div className="grid grid-cols-3 gap-3 lg:gap-4 flex-1 min-h-0 items-stretch">
              {/* Card 1: Watch Together */}
              <button
                type="button"
                onClick={() => onSelectActivity?.('watch')}
                className="group relative flex flex-col items-start justify-between p-3.5 rounded-2xl bg-gradient-to-br from-[#121629] via-[#0e1122] to-[#0a0d1a] border border-indigo-500/25 hover:border-indigo-400/80 hover:shadow-[0_0_24px_rgba(99,102,241,0.25)] transition-all duration-200 cursor-pointer text-left overflow-hidden active:scale-[0.98]"
              >
                <div className="flex items-start justify-between w-full mb-1 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                    <Tv size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/80 bg-indigo-500/10 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                    Synced
                  </span>
                </div>
                <div className="min-w-0 w-full">
                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors truncate">
                    Watch Together
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    FrameX TV & YouTube
                  </p>
                </div>
              </button>

              {/* Card 2: Scribble Game */}
              <button
                type="button"
                onClick={() => onSelectActivity?.('skribbl')}
                className="group relative flex flex-col items-start justify-between p-3.5 rounded-2xl bg-gradient-to-br from-[#1b1227] via-[#140c20] to-[#0d0716] border border-pink-500/25 hover:border-pink-400/80 hover:shadow-[0_0_24px_rgba(236,72,153,0.25)] transition-all duration-200 cursor-pointer text-left overflow-hidden active:scale-[0.98]"
              >
                <div className="flex items-start justify-between w-full mb-1 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                    <Palette size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pink-300/80 bg-pink-500/10 px-1.5 py-0.5 rounded-md border border-pink-500/20">
                    Multiplayer
                  </span>
                </div>
                <div className="min-w-0 w-full">
                  <h4 className="text-sm font-bold text-white group-hover:text-pink-200 transition-colors truncate">
                    Scribble Game
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Draw & guess words
                  </p>
                </div>
              </button>

              {/* Card 3: Games Hub */}
              <button
                type="button"
                onClick={() => onSelectActivity?.('games')}
                className="group relative flex flex-col items-start justify-between p-3.5 rounded-2xl bg-gradient-to-br from-[#0e1a21] via-[#09141a] to-[#060e13] border border-emerald-500/25 hover:border-emerald-400/80 hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] transition-all duration-200 cursor-pointer text-left overflow-hidden active:scale-[0.98]"
              >
                <div className="flex items-start justify-between w-full mb-1 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                    <Gamepad2 size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                    7 Games
                  </span>
                </div>
                <div className="min-w-0 w-full">
                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-200 transition-colors truncate">
                    Games Hub
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Trivia, dilemmas & more
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* RIGHT — YOU (approx 30-33% on desktop) */}
          <div className="w-[33%] lg:w-[30%] flex flex-col min-h-0 justify-between">
            {/* Header: YOU */}
            <div className="flex items-center justify-between pb-2 shrink-0">
              <span className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>You</span>
                {localParticipant && (
                  <span className="text-[10px] font-normal text-slate-400 font-mono truncate max-w-[120px]">
                    ({localParticipant.name})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                title="Device Settings"
                aria-label="Device Settings"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Settings size={14} />
              </button>
            </div>

            {/* Local Camera Tile & Controls Stack */}
            <div className="flex flex-col flex-1 min-h-0 justify-between gap-2.5">
              {/* My Camera Preview Tile */}
              <div className="relative flex-1 min-h-0 w-full rounded-2xl overflow-hidden border-2 border-indigo-500/50 bg-[#0e101d] shadow-lg flex items-center justify-center">
                {localParticipant && (
                  <VideoTile
                    participant={localParticipant}
                    isLocal={true}
                    localStream={localStream}
                    screenStream={localParticipant.isScreenSharing ? screenStream : null}
                    isHostViewer={isHost}
                    mediaVersion={remoteMediaVersion}
                    cameraHealth={cameraHealth}
                  />
                )}
              </div>

              {/* Call Controls Row */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onToggleAudio}
                  aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    isAudioMuted
                      ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
                      : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {isAudioMuted ? <MicOff size={14} className="text-red-400 shrink-0" /> : <Mic size={14} className="text-emerald-400 shrink-0" />}
                  <span className="text-xs font-bold">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleVideo}
                  aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    isVideoOff
                      ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
                      : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {isVideoOff ? <VideoOff size={14} className="text-red-400 shrink-0" /> : <Video size={14} className="text-indigo-400 shrink-0" />}
                  <span className="text-xs font-bold">{isVideoOff ? 'Start' : 'Stop'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLeaveModal(true)}
                  aria-label="Leave call"
                  className="py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-red-600/80 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer shadow-md shadow-red-600/20 border border-red-500/40"
                >
                  <PhoneOff size={14} className="shrink-0" />
                  <span className="text-xs font-bold">Leave</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE VIEW (flex md:hidden): Dedicated Compact Arrangement */}
        <div className="flex md:hidden w-full h-full flex-col justify-between gap-1.5 min-h-0">
          {/* Header Row: Activities label */}
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
              <Sparkles size={11} className="text-indigo-400" />
              <span>Activities</span>
            </span>
            <span className="text-[9px] text-slate-500 font-medium">
              Tap to launch party
            </span>
          </div>

          {/* Region 1: Activities Horizontal Scrollable Row with min-w-[135px] */}
          <div className="flex flex-row items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0 px-0.5">
            {/* Watch Together */}
            <button
              type="button"
              onClick={() => onSelectActivity?.('watch')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-950/70 to-indigo-900/50 border border-indigo-500/35 hover:border-indigo-400 text-white shrink-0 min-w-[135px] active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Tv size={15} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[11px] font-bold leading-tight truncate">Watch Together</div>
                <div className="text-[9px] text-indigo-300/80 leading-none truncate mt-0.5">FrameX & YouTube</div>
              </div>
            </button>

            {/* Scribble Game */}
            <button
              type="button"
              onClick={() => onSelectActivity?.('skribbl')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-950/70 to-pink-900/50 border border-pink-500/35 hover:border-pink-400 text-white shrink-0 min-w-[135px] active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                <Palette size={15} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[11px] font-bold leading-tight truncate">Scribble Game</div>
                <div className="text-[9px] text-pink-300/80 leading-none truncate mt-0.5">Draw & guess</div>
              </div>
            </button>

            {/* Games Hub */}
            <button
              type="button"
              onClick={() => onSelectActivity?.('games')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-950/70 to-emerald-900/50 border border-emerald-500/35 hover:border-emerald-400 text-white shrink-0 min-w-[135px] active:scale-95 transition-all cursor-pointer shadow-sm mr-2"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Gamepad2 size={15} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[11px] font-bold leading-tight truncate">Games Hub</div>
                <div className="text-[9px] text-emerald-300/80 leading-none truncate mt-0.5">7 party games</div>
              </div>
            </button>
          </div>

          {/* Region 2: My Camera Preview & Essential Call Controls */}
          <div className="flex items-center gap-2 pt-0.5 shrink-0">
            {/* My Camera Preview Tile */}
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border-2 border-indigo-500/60 bg-[#0e101d] overflow-hidden relative shrink-0 shadow-md">
              {localParticipant && (
                <VideoTile
                  participant={localParticipant}
                  isLocal={true}
                  compact={true}
                  localStream={localStream}
                  screenStream={localParticipant.isScreenSharing ? screenStream : null}
                  isHostViewer={isHost}
                  mediaVersion={remoteMediaVersion}
                  cameraHealth={cameraHealth}
                />
              )}
            </div>

            {/* Essential Call Controls + Settings */}
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={onToggleAudio}
                aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`flex-1 py-2 px-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                  isAudioMuted
                    ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
                    : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                }`}
              >
                {isAudioMuted ? <MicOff size={14} className="text-red-400 shrink-0" /> : <Mic size={14} className="text-emerald-400 shrink-0" />}
                <span className="text-[11px] font-bold">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleVideo}
                aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                className={`flex-1 py-2 px-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                  isVideoOff
                    ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
                    : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                }`}
              >
                {isVideoOff ? <VideoOff size={14} className="text-red-400 shrink-0" /> : <Video size={14} className="text-indigo-400 shrink-0" />}
                <span className="text-[11px] font-bold">{isVideoOff ? 'Start' : 'Stop'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                aria-label="Leave call"
                className="py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bg-red-600/90 hover:bg-red-600 active:scale-95 text-white transition-all cursor-pointer shadow-md shadow-red-600/30 border border-red-500/50 shrink-0"
              >
                <PhoneOff size={14} className="shrink-0" />
                <span className="text-[11px] font-bold">Leave</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                title="Device Settings"
                aria-label="Device Settings"
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer shrink-0 border border-white/10"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {showSettingsModal && (
        <DeviceSettingsModal
          devices={devices}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showLeaveModal && (
        <LeaveConfirmationModal
          onConfirm={onLeaveCall}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}
    </section>
  );
};

// -----------------------------------------------------------------------------
// Individual Video Tile Component
// -----------------------------------------------------------------------------
interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isHostViewer: boolean;
  onKick?: (id: string) => void;
  mediaVersion?: number;
  cameraHealth?: CameraHealthStatus;
  compact?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isLocal,
  localStream,
  screenStream,
  isHostViewer,
  onKick,
  mediaVersion,
  cameraHealth,
  compact = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  const remoteStream = !isLocal ? mediaService.getRemoteVideoStream(participant.id) : null;
  const remoteMediaEntry = !isLocal ? mediaService.remoteStreams.get(participant.id) : null;

  useEffect(() => {
    if (!videoRef.current) return;
    const targetStream = isLocal
      ? (participant.isScreenSharing && screenStream ? screenStream : localStream)
      : remoteStream;
    const cleanup = mediaService.attachVideoElement(videoRef.current, targetStream, isLocal);
    return cleanup;
  }, [isLocal, localStream, screenStream, remoteStream, participant.isScreenSharing, mediaVersion]);

  const hasLiveVideo = isLocal
    ? !participant.isVideoOff && (localStream || (participant.isScreenSharing && screenStream))
    : !participant.isVideoOff && Boolean(remoteStream) && !remoteMediaEntry?.isVideoMuted;

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#131625] border transition-all duration-200 flex items-center justify-center ${
        participant.isSpeaking
          ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)] active-speaker-ring'
          : 'border-white/10 shadow-lg'
      }`}
    >
      {/* Video Element - mirrored for local camera self-view, unmirrored for screen share & remote */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local video playback to eliminate echo
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''
        } ${
          hasLiveVideo ? 'opacity-100' : 'opacity-0 absolute'
        }`}
      />

      {/* Camera Freeze Auto-Recovery Indicator (Part B Requirements 6 & 7) */}
      {isLocal && cameraHealth === 'recovering' && (
        <div className="absolute top-3 left-3 bg-indigo-600/95 border border-indigo-400 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xl backdrop-blur-md animate-pulse z-20">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Recovering camera...</span>
        </div>
      )}

      {/* Camera Freeze Manual Retry Action */}
      {isLocal && cameraHealth === 'failed' && (
        <div className="absolute inset-x-3 top-3 bg-red-950/95 border border-red-500/50 text-red-200 text-xs p-2.5 rounded-xl flex items-center justify-between shadow-2xl backdrop-blur-md z-20">
          <span className="truncate mr-2 font-medium">Camera stalled</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              mediaService.recoverCamera('manual_click', true);
            }}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-[11px] cursor-pointer shrink-0 shadow transition-colors"
          >
            Retry Camera
          </button>
        </div>
      )}

      {/* Fallback Avatar when camera is off */}
      {!hasLiveVideo && (
        <div className={`flex flex-col items-center justify-center select-none ${compact ? 'p-1 gap-0' : 'gap-3 p-4'}`}>
          <div
            className={`rounded-2xl flex items-center justify-center shadow-inner border border-white/10 relative ${
              compact ? 'w-9 h-9 sm:w-10 sm:h-10 text-2xl' : 'w-16 h-16 md:w-20 md:h-20 text-3xl md:text-4xl'
            }`}
            style={{ backgroundColor: participant.color }}
          >
            {participant.avatar}
            {participant.isSpeaking && (
              <span className="absolute -inset-1 rounded-2xl border-2 border-emerald-400 animate-ping opacity-75" />
            )}
          </div>
          {!compact && (
            <p className="text-xs font-semibold text-slate-300 tracking-wide">
              Camera Off
            </p>
          )}
        </div>
      )}

      {/* Screen share badge */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 left-3 bg-indigo-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
          <Share2 size={11} />
          <span>Screen Sharing</span>
        </div>
      )}

      {/* Speaking badge indicator */}
      {participant.isSpeaking && (
        <div className="absolute top-3 right-3 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span>TALKING</span>
        </div>
      )}

      {/* Bottom Namebar and Status */}
      {compact ? (
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between text-[9px] pointer-events-none">
          <span className="bg-black/75 text-indigo-300 font-mono font-bold px-1 rounded border border-indigo-500/40 text-[8px] leading-tight">
            {isLocal ? 'You' : participant.name}
          </span>
          <div className="flex items-center gap-1">
            {participant.isHost && (
              <span className="bg-amber-500 text-black font-extrabold px-1 rounded text-[8px] leading-tight">
                HOST
              </span>
            )}
            {participant.isAudioMuted && (
              <span className="p-0.5 rounded bg-red-500/90 text-white">
                <MicOff size={9} />
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 sm:p-2.5 flex items-center justify-between text-xs gap-1.5 pointer-events-none">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-semibold text-white drop-shadow truncate text-[11px] sm:text-xs">
              {participant.name} {isLocal && '(You)'}
            </span>
            {participant.isHost && (
              <span 
                title="Room Host" 
                className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold shrink-0"
              >
                HOST
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio status badge */}
            <div
              className={`p-1 rounded-md text-xs ${
                participant.isAudioMuted
                  ? 'bg-red-500/80 text-white'
                  : 'bg-black/40 text-slate-300'
              }`}
              title={participant.isAudioMuted ? 'Muted' : 'Microphone Active'}
            >
              {participant.isAudioMuted ? <MicOff size={12} /> : <Mic size={12} />}
            </div>

            {/* Host actions trigger */}
            {isHostViewer && !isLocal && onKick && (
              <div className="relative pointer-events-auto">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  aria-label={`Options for ${participant.name}`}
                  className="p-1 rounded-md bg-black/40 text-slate-300 hover:text-white hover:bg-black/60 cursor-pointer"
                >
                  <MoreVertical size={13} />
                </button>

                {showMenu && (
                  <div className="absolute bottom-full right-0 mb-1 w-36 bg-[#1a1c2d] border border-white/10 rounded-xl shadow-2xl p-1 z-30">
                    <button
                      onClick={() => {
                        onKick(participant.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <UserX size={13} />
                      <span>Remove from Call</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Unified Call Controls Toolbar
// -----------------------------------------------------------------------------
interface CallControlsToolbarProps {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onOpenSettings: () => void;
  onRequestLeave: () => void;
}

const CallControlsToolbar: React.FC<CallControlsToolbarProps> = ({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onOpenSettings,
  onRequestLeave,
}) => {
  return (
    <div className="p-3 border-t border-white/10 flex items-center justify-center gap-2">
      {/* Microphone button */}
      <button
        onClick={onToggleAudio}
        aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        className={`p-3 rounded-2xl transition-all cursor-pointer ${
          isAudioMuted
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
      </button>

      {/* Camera button */}
      <button
        onClick={onToggleVideo}
        aria-label={isVideoOff ? 'Enable camera' : 'Disable camera'}
        title={isVideoOff ? 'Enable camera' : 'Disable camera'}
        className={`p-3 rounded-2xl transition-all cursor-pointer ${
          isVideoOff
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
      </button>

      {/* Screen share button */}
      <button
        onClick={onToggleScreenShare}
        aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        className={`p-3 rounded-2xl transition-all cursor-pointer ${
          isScreenSharing
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        <Share2 size={18} />
      </button>

      {/* Device settings modal trigger */}
      <button
        onClick={onOpenSettings}
        aria-label="Audio and camera settings"
        title="Device Settings"
        className="p-3 rounded-2xl bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
      >
        <Settings size={18} />
      </button>

      {/* Leave call button */}
      <button
        onClick={onRequestLeave}
        aria-label="Leave call"
        title="Leave Call"
        className="p-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer ml-1"
      >
        <PhoneOff size={18} />
      </button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Settings Modal
// -----------------------------------------------------------------------------
interface DeviceSettingsModalProps {
  devices: MediaDeviceState;
  onClose: () => void;
}

const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({ devices, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#131522] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Settings size={18} className="text-indigo-400" />
            Device Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-slate-400 hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Microphone
            </label>
            <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
              {devices.audioInputs.length === 0 ? (
                <option>Default Microphone</option>
              ) : (
                devices.audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.substring(0, 5)}`}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Camera
            </label>
            <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
              {devices.videoInputs.length === 0 ? (
                <option>Default Camera</option>
              ) : (
                devices.videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.substring(0, 5)}`}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">WebRTC Echo Cancellation</p>
            <p>Acoustic echo cancellation, automatic gain control, and noise suppression are active.</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Leave Confirmation Modal
// -----------------------------------------------------------------------------
interface LeaveConfirmationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const LeaveConfirmationModal: React.FC<LeaveConfirmationModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#141624] border border-white/10 rounded-2xl p-6 shadow-2xl text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center mb-3">
          <PhoneOff size={22} />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Leave the Lounge?</h3>
        <p className="text-xs text-slate-400 mb-5">
          Leaving will end your live video and audio connection in this room.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Stay in Call
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-lg shadow-red-600/30"
          >
            Leave Call
          </button>
        </div>
      </div>
    </div>
  );
};
