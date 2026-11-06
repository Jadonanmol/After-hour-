import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Tv, 
  Palette, 
  Gamepad2, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  ArrowRight, 
  ShieldCheck, 
  Lock,
  Play,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { mediaService } from '../../services/mediaService.ts';
import { MediaPermissionModal } from '../common/MediaPermissionModal.tsx';
import { CinematicPortal } from '../portal/CinematicPortal.tsx';
import { extractRoomCodeFromUrl, normalizeRoomCode, validateRoomCode } from '../../game/roomCode.ts';
import type { MediaErrorInfo } from '../../types/index.ts';

interface LandingPageProps {
  initialRoomCode?: string;
  externalError?: string | null;
  onJoinRoom: (roomCode: string, name: string, avatar: string, muted: boolean, videoOff: boolean, isCreate?: boolean) => void;
}

const AVATARS = ['🦊', '🐼', '🦁', '🚀', '⚡', '🌙', '🎨', '🍿'];

export const LandingPage: React.FC<LandingPageProps> = ({ initialRoomCode, externalError, onJoinRoom }) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [roomCodeInput, setRoomCodeInput] = useState<string>(() => {
    if (initialRoomCode) {
      return normalizeRoomCode(initialRoomCode);
    }
    return extractRoomCodeFromUrl().code;
  });
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<MediaErrorInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  // 3D Cinematic Portal state & concurrent setup tracking
  const [portalState, setPortalState] = useState<{
    active: boolean;
    roomCode: string;
    isReady: boolean;
    error?: string | null;
  } | null>(null);
  const pendingJoinRef = useRef<(() => void) | null>(null);
  const traverseCompletedRef = useRef<boolean>(false);
  const setupReadyRef = useRef<boolean>(false);
  const hasJoinedRef = useRef<boolean>(false);
  const joinAttemptRef = useRef<number>(0);
  
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync external socket errors into local form error
  useEffect(() => {
    if (externalError) {
      setFormError(externalError);
      setIsCreating(false);
      setIsJoining(false);
    }
  }, [externalError]);

  // Synchronize roomCodeInput whenever initialRoomCode prop changes
  useEffect(() => {
    if (initialRoomCode) {
      const clean = normalizeRoomCode(initialRoomCode);
      setRoomCodeInput(clean);
    }
  }, [initialRoomCode]);

  // Check URL room code existence and validation on load
  useEffect(() => {
    const urlInfo = extractRoomCodeFromUrl();
    if (urlInfo.hasParam) {
      if (urlInfo.isMalformed || !urlInfo.code) {
        setFormError('The invitation link contains an invalid room code. Please enter a valid 6-character room code below.');
        return;
      }
      const cleanCode = urlInfo.code;
      fetch(`/api/rooms/${cleanCode}`)
        .then((res) => {
          if (!res.ok) {
            setFormError(`Room "${cleanCode}" was not found or has expired. You can edit the code or create a new lounge below.`);
          }
        })
        .catch(() => {
          // Ignore offline check error on initial load
        });
    } else if (initialRoomCode) {
      const cleanCode = normalizeRoomCode(initialRoomCode);
      if (cleanCode.length < 4) {
        setFormError('The invitation room code is invalid. Please enter a valid room code below.');
      } else {
        fetch(`/api/rooms/${cleanCode}`)
          .then((res) => {
            if (!res.ok) {
              setFormError(`Room "${cleanCode}" was not found or has expired. You can edit the code or create a new lounge below.`);
            }
          })
          .catch(() => {});
      }
    }
  }, [initialRoomCode]);

  // Initialize preview media gracefully
  useEffect(() => {
    mediaService.initLocalMedia(true, true).then((res) => {
      setPreviewStream(res.stream);
      if (res.videoError) {
        setIsVideoOff(true);
      }
      if (res.audioError) {
        setIsAudioMuted(true);
      }
      if (videoPreviewRef.current && res.stream) {
        videoPreviewRef.current.srcObject = res.stream;
      }
    });

    return () => {
      // Don't kill media if transitioning into room
    };
  }, []);

  const handleToggleMic = async () => {
    if (isAudioMuted) {
      const result = await mediaService.toggleMicrophone(false);
      if (result.success) {
        setIsAudioMuted(false);
        setMediaError(null);
      } else {
        setIsAudioMuted(true);
        if (result.error) setMediaError(result.error);
      }
    } else {
      await mediaService.toggleMicrophone(true);
      setIsAudioMuted(true);
    }
  };

  const handleToggleCam = async () => {
    if (isVideoOff) {
      const result = await mediaService.toggleCamera(false);
      if (result.success) {
        setIsVideoOff(false);
        setMediaError(null);
        setPreviewStream(result.stream);
        if (videoPreviewRef.current && result.stream) {
          videoPreviewRef.current.srcObject = result.stream;
        }
      } else {
        setIsVideoOff(true);
        if (result.error) setMediaError(result.error);
      }
    } else {
      await mediaService.toggleCamera(true);
      setIsVideoOff(true);
    }
  };

  // Create room flow: launches 3D portal, creates room on shared backend, traverses into lounge
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Please enter your display name to create a lounge.');
      nameInputRef.current?.focus();
      return;
    }

    if (isCreating || isJoining) return;

    const attemptId = ++joinAttemptRef.current;
    hasJoinedRef.current = false;
    traverseCompletedRef.current = false;
    setupReadyRef.current = false;
    pendingJoinRef.current = null;

    setIsCreating(true);

    // Launch 3D portal animation immediately
    setPortalState({
      active: true,
      roomCode: 'NEW',
      isReady: false,
      error: null,
    });

    // Start room creation and network preparation immediately and concurrently
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: cleanName }),
      });

      // If user canceled during fetch, discard late response
      if (joinAttemptRef.current !== attemptId) return;

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server returned an error while creating the room.');
      }

      const data = await res.json();
      if (joinAttemptRef.current !== attemptId) return;

      if (!data.success || !data.room?.code) {
        throw new Error('Invalid server response during room creation.');
      }

      const createdCode = data.room.code;

      // Define single join execution guard
      const executeJoinOnce = () => {
        if (joinAttemptRef.current !== attemptId || hasJoinedRef.current) return;
        hasJoinedRef.current = true;
        pendingJoinRef.current = null;
        onJoinRoom(createdCode, cleanName, selectedAvatar, isAudioMuted, isVideoOff, true);
      };

      pendingJoinRef.current = executeJoinOnce;
      setupReadyRef.current = true;
      setPortalState(prev => (prev && joinAttemptRef.current === attemptId) ? { ...prev, roomCode: createdCode, isReady: true } : null);

      // If portal traversal already finished, transition into hangout immediately
      if (traverseCompletedRef.current) {
        executeJoinOnce();
      }
    } catch (err: any) {
      if (joinAttemptRef.current !== attemptId) return;
      console.error('Room creation failed:', err);
      const msg = err.message || 'Unable to connect to the backend server. Please verify your connection.';
      setFormError(msg);
      setPortalState(prev => prev ? { ...prev, error: msg } : null);
      setIsCreating(false);
    }
  };

  // Join room flow: validates code format, opens 3D portal, verifies backend, and connects
  const handleJoinWithCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Please enter your display name before joining.');
      nameInputRef.current?.focus();
      return;
    }

    const cleanCode = normalizeRoomCode(roomCodeInput);
    if (!cleanCode) {
      setFormError('Please enter a room code.');
      return;
    }

    if (cleanCode.length < 4) {
      setFormError('Room codes are 6 alphanumeric characters (e.g. ABC123).');
      return;
    }

    if (isCreating || isJoining) return;

    const attemptId = ++joinAttemptRef.current;
    hasJoinedRef.current = false;
    traverseCompletedRef.current = false;
    setupReadyRef.current = false;
    pendingJoinRef.current = null;

    setIsJoining(true);

    // Launch 3D portal animation immediately with the entered code
    setPortalState({
      active: true,
      roomCode: cleanCode,
      isReady: false,
      error: null,
    });

    // Start room verification concurrently
    try {
      const res = await fetch(`/api/rooms/${cleanCode}`);
      if (joinAttemptRef.current !== attemptId) return;

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Room "${cleanCode}" was not found. Please check the code with your host.`);
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Unable to join room "${cleanCode}".`);
      }

      const data = await res.json();
      if (joinAttemptRef.current !== attemptId) return;

      if (data.isLocked) {
        throw new Error(`Room "${cleanCode}" is locked by the host.`);
      }

      // Room verified! Register single join execution
      const executeJoinOnce = () => {
        if (joinAttemptRef.current !== attemptId || hasJoinedRef.current) return;
        hasJoinedRef.current = true;
        pendingJoinRef.current = null;
        onJoinRoom(cleanCode, cleanName, selectedAvatar, isAudioMuted, isVideoOff, false);
      };

      pendingJoinRef.current = executeJoinOnce;
      setupReadyRef.current = true;
      setPortalState(prev => (prev && joinAttemptRef.current === attemptId) ? { ...prev, isReady: true } : null);

      // If portal traversal already finished, transition into hangout immediately
      if (traverseCompletedRef.current) {
        executeJoinOnce();
      }
    } catch (err: any) {
      if (joinAttemptRef.current !== attemptId) return;
      console.error('Room verification failed:', err);
      const msg = err.message || 'Could not connect to the room. Please check your connection.';
      setFormError(msg);
      setPortalState(prev => prev ? { ...prev, error: msg } : null);
      setIsJoining(false);
    }
  };

  const handlePortalTraverseComplete = () => {
    traverseCompletedRef.current = true;
    if (setupReadyRef.current && pendingJoinRef.current) {
      pendingJoinRef.current();
    }
  };

  const handleCancelPortal = () => {
    // Invalidate current attempt counter so late responses cannot trigger join
    joinAttemptRef.current++;
    hasJoinedRef.current = false;
    pendingJoinRef.current = null;
    traverseCompletedRef.current = false;
    setupReadyRef.current = false;
    setPortalState(null);
    setIsJoining(false);
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen bg-[#08090f] text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30">
      {/* Top Lounge Brand Bar */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-white/5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-black text-sm tracking-wider">
            AH
          </div>
          <span className="font-black text-base tracking-wider text-white">
            AFTERHOURS
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Lounge Online</span>
        </div>
      </header>

      {/* Main Hero & Room Entrance */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Brand & Video Preview */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Sparkles size={13} />
              <span>Real-Time Lounge & Cinema</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Hang out, play & watch movies together.
            </h1>

            <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-md">
              Persistent WebRTC video calls that stay active while you play Skribbl, watch FrameX TV, and challenge friends in games.
            </p>

            {/* Camera & Mic Preview Box with mirrored self-view video */}
            <div className="relative w-full max-w-sm mx-auto lg:mx-0 aspect-video rounded-3xl overflow-hidden bg-[#121422] border border-white/10 shadow-2xl flex items-center justify-center group">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : 'block'}`}
              />

              {isVideoOff && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-3xl">
                    {selectedAvatar}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Camera is Off</span>
                </div>
              )}

              {/* In-Preview Controls - completely unmirrored */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10">
                <span className="text-[11px] font-semibold text-slate-300 truncate">
                  {name || 'Choose your name'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleMic}
                    type="button"
                    aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      isAudioMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {isAudioMuted ? <MicOff size={13} /> : <Mic size={13} />}
                  </button>
                  <button
                    onClick={handleToggleCam}
                    type="button"
                    aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {isVideoOff ? <VideoOff size={13} /> : <Video size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Join / Create Card */}
          <div className="lg:col-span-6 bg-[#111320] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Enter Afterhours</h2>
              <p className="text-xs text-slate-400">
                Join as a guest instantly. No sign-up or credit card required.
              </p>
            </div>

            {/* Error Message Alert */}
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-red-300 animate-in fade-in duration-150">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{formError}</div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Name Input */}
            <div>
              <label htmlFor="display-name" className="block text-xs font-semibold text-slate-300 mb-2">
                Your Display Name <span className="text-indigo-400">*</span>
              </label>
              <input
                id="display-name"
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (roomCodeInput.trim()) {
                      handleJoinWithCode();
                    } else {
                      handleCreateRoom(e);
                    }
                  }
                }}
                placeholder="e.g. Alex, Sam, CyberKnight"
                maxLength={20}
                className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            {/* Avatar Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Pick Your Lounge Avatar
              </label>
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                      selectedAvatar === av
                        ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/10 w-full" />

            {/* Unified Room Join & Create Section */}
            <div className="space-y-4">
              {/* Optional invitation banner when visiting with a room code */}
              {(initialRoomCode || extractRoomCodeFromUrl().hasParam) && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl text-xs text-indigo-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400 shrink-0" />
                    <span>
                      Room Invitation: <strong className="font-mono text-white tracking-wider">{roomCodeInput || initialRoomCode}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Editable below</span>
                </div>
              )}

              {/* Room Code Entry & Join Form */}
              <form onSubmit={handleJoinWithCode} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="room-code-input" className="block text-xs font-semibold text-slate-300">
                      Room Code
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">6 alphanumeric chars</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="room-code-input"
                      type="text"
                      value={roomCodeInput}
                      onChange={(e) => {
                        const nextCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setRoomCodeInput(nextCode);
                        if (formError) setFormError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleJoinWithCode();
                        }
                      }}
                      placeholder="Enter 6-char room code"
                      maxLength={8}
                      className="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-slate-500 outline-none uppercase tracking-wider transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={isJoining}
                      className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                    >
                      {isJoining ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Joining...</span>
                        </>
                      ) : (
                        <>
                          <span>Join</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Prominent Join Lounge Action button if code is prefilled or typed */}
                {roomCodeInput.trim().length >= 4 && (
                  <button
                    type="submit"
                    disabled={isJoining}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Verifying & Joining...</span>
                      </>
                    ) : (
                      <>
                        <span>Join Lounge #{roomCodeInput.trim()}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </form>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#111320] px-3 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                  OR CREATE A NEW LOUNGE
                </span>
              </div>

              <form onSubmit={handleCreateRoom}>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Creating Private Lounge...</span>
                    </>
                  ) : (
                    <>
                      <span>Create New Private Lounge</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Feature Badges */}
      <footer className="px-6 py-6 border-t border-white/5 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
            <span className="text-xs font-semibold text-white block mb-0.5">Persistent Video</span>
            <span className="text-[11px] text-slate-400">Call never drops when switching tabs</span>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
            <span className="text-xs font-semibold text-white block mb-0.5">FrameX TV</span>
            <span className="text-[11px] text-slate-400">Watch together with 3-2-1 sync</span>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
            <span className="text-xs font-semibold text-white block mb-0.5">Skribbl Multiplayer</span>
            <span className="text-[11px] text-slate-400">350+ words with 3 difficulty levels</span>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
            <span className="text-xs font-semibold text-white block mb-0.5">7 Party Games</span>
            <span className="text-[11px] text-slate-400">Trivia, dilemmas, whiteboard & more</span>
          </div>
        </div>
      </footer>

      {/* Permission & Device Recovery Modal */}
      {mediaError && (
        <MediaPermissionModal
          error={mediaError}
          onRetry={() => {
            if (mediaError.kind === 'camera') {
              handleToggleCam();
            } else {
              handleToggleMic();
            }
          }}
          onDismiss={() => setMediaError(null)}
        />
      )}

      {/* 3D Cinematic Portal Gateway */}
      {portalState?.active && (
        <CinematicPortal
          roomCode={portalState.roomCode}
          isJoining={isJoining || isCreating}
          isReady={portalState.isReady}
          error={portalState.error || externalError}
          onTraverseComplete={handlePortalTraverseComplete}
          onCancel={handleCancelPortal}
        />
      )}
    </div>
  );
};
