/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Navbar } from './components/Navbar.tsx';
import { PersistentCallLayout } from './components/video/PersistentCallLayout.tsx';
import { WatchTogether } from './components/watch/WatchTogether.tsx';
import { SkribblGame } from './components/games/SkribblGame.tsx';
import { GamesHub } from './components/games/GamesHub.tsx';
import { ChatPanel } from './components/chat/ChatPanel.tsx';
import { LandingPage } from './components/landing/LandingPage.tsx';
import { ActivityHubModal } from './components/activities/ActivityHubModal.tsx';
import { MediaPermissionModal } from './components/common/MediaPermissionModal.tsx';
import { mediaService } from './services/mediaService.ts';
import { sounds } from './services/soundEffects.ts';
import { extractRoomCodeFromUrl } from './game/roomCode.ts';
import type { 
  RoomState, 
  Participant, 
  TabType, 
  ActivityType,
  ActivityVoteSession,
  CallLayoutMode, 
  DrawingStroke, 
  ChatMessage, 
  FloatingReaction,
  MediaErrorInfo
} from './types/index.ts';

export default function App() {
  const [inRoom, setInRoom] = useState(false);
  const [initialRoomCode, setInitialRoomCode] = useState<string>(() => {
    return extractRoomCodeFromUrl().code;
  });
  const [room, setRoom] = useState<RoomState | null>(null);
  const [currentParticipantId, setCurrentParticipantId] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('hangout');
  const [callLayout, setCallLayout] = useState<CallLayoutMode>('full');
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<MediaErrorInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('connected');

  // Chat & Social state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [activityAnnouncement, setActivityAnnouncement] = useState<string | null>(null);

  // Activity Hub Modal state
  const [isActivityHubOpen, setIsActivityHubOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const currentRoomCodeRef = useRef<string | null>(null);
  const currentParticipantIdRef = useRef<string | null>(null);
  const currentParticipantNameRef = useRef<string>('');
  const currentParticipantAvatarRef = useRef<string>('');

  // Stable persistent participant ID generator/retriever
  const getStableParticipantId = useCallback((): string => {
    try {
      const existing = sessionStorage.getItem('ah_participant_id');
      if (existing && existing.trim().length > 3) {
        return existing;
      }
      const newId = `ah_u_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('ah_participant_id', newId);
      return newId;
    } catch {
      return `ah_u_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }, []);

  // Check URL query params for ?room=XYZ
  useEffect(() => {
    const { code } = extractRoomCodeFromUrl();
    if (code) {
      setInitialRoomCode(code);
    }
  }, []);

  // Connect socket
  useEffect(() => {
    const socket = io(window.location.origin, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('> Connected to AFTERHOURS lounge socket');
      // If client was already in a room, automatically recover membership
      if (currentRoomCodeRef.current && currentParticipantIdRef.current) {
        console.log('> Auto-rejoining lounge room after reconnect:', currentRoomCodeRef.current);
        socket.emit('join_room', {
          roomCode: currentRoomCodeRef.current,
          participantName: currentParticipantNameRef.current,
          avatar: currentParticipantAvatarRef.current,
          participantId: currentParticipantIdRef.current,
          isReconnect: true,
        });
      }
    });

    socket.on('error_message', ({ message }: { message: string }) => {
      setErrorMessage(message);
      setJoinError(message);
      setTimeout(() => setErrorMessage(null), 4000);
    });

    socket.on('join_failed', ({ message }: { message: string }) => {
      setJoinError(message);
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 4000);
    });

    socket.on('room_joined', ({ room, currentParticipantId, strokes }: { room: RoomState; currentParticipantId: string; strokes: DrawingStroke[] }) => {
      setRoom(room);
      setCurrentParticipantId(currentParticipantId);
      currentRoomCodeRef.current = room.code;
      currentParticipantIdRef.current = currentParticipantId;
      const me = room.participants.find(p => p.id === currentParticipantId);
      if (me) {
        currentParticipantNameRef.current = me.name;
        currentParticipantAvatarRef.current = me.avatar;
      }
      setActiveTab(room.activeTab || 'hangout');
      setStrokes(strokes || []);
      setInRoom(true);
      setJoinError(null);

      if (room.activeTab === 'hangout') {
        setCallLayout('full');
      } else {
        setCallLayout('docked');
      }

      sounds.playJoinSound();

      // Check LiveKit Cloud token
      fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: room.code,
          participantName: room.participants.find(p => p.id === currentParticipantId)?.name || 'Guest',
          participantId: currentParticipantId,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.configured && data.token && data.url) {
            mediaService.connectLiveKit(data.url, data.token, {
              isAudioMuted,
              isVideoOff,
            });
          }
        })
        .catch(err => {
          console.warn('LiveKit token request error:', err);
        });
    });

    // Authoritative participant sync from server
    socket.on('participants_synced', ({ participants, hostId }: { participants: Participant[]; hostId: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          participants,
          hostId,
        };
      });
    });

    socket.on('participant_joined', (participant: Participant) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          participants: [...prev.participants.filter(p => p.id !== participant.id), participant],
        };
      });
      sounds.playJoinSound();
    });

    socket.on('participant_left', ({ participantId }: { participantId: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          participants: prev.participants.filter(p => p.id !== participantId),
        };
      });
    });

    socket.on('participant_updated', (updated: Participant) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          participants: prev.participants.map(p => p.id === updated.id ? updated : p),
        };
      });
    });

    socket.on('room_lock_changed', ({ isLocked }: { isLocked: boolean }) => {
      setRoom(prev => prev ? { ...prev, isLocked } : null);
    });

    socket.on('tab_changed', ({ tab }: { tab: TabType }) => {
      setActiveTab(tab);
      if (tab === 'hangout') {
        setCallLayout('full');
      } else {
        setCallLayout('docked');
      }
    });

    // Activity Hub & Voting Events
    socket.on('activity_vote_updated', (session: ActivityVoteSession) => {
      setRoom(prev => prev ? { ...prev, activityVoteSession: session } : null);
    });

    socket.on('activity_vote_started', (session: ActivityVoteSession) => {
      setRoom(prev => prev ? { ...prev, activityVoteSession: session } : null);
      sounds.playNotificationSound();
    });

    socket.on('activity_vote_tick', ({ timeLeft }: { timeLeft: number }) => {
      setRoom(prev => {
        if (!prev || !prev.activityVoteSession) return prev;
        return {
          ...prev,
          activityVoteSession: {
            ...prev.activityVoteSession,
            timeLeft,
          },
        };
      });
    });

    socket.on('activity_vote_tied', ({ tiedActivities }: { tiedActivities: ActivityType[] }) => {
      setRoom(prev => {
        if (!prev || !prev.activityVoteSession) return prev;
        return {
          ...prev,
          activityVoteSession: {
            ...prev.activityVoteSession,
            status: 'tied',
            tiedActivities,
          },
        };
      });
      sounds.playTimerWarningSound();
    });

    socket.on('activity_vote_concluded', ({ winner }: { winner: ActivityType }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          activityVoteSession: null,
        };
      });
    });

    socket.on('activity_vote_cancelled', () => {
      setRoom(prev => prev ? { ...prev, activityVoteSession: null } : null);
    });

    socket.on('activity_changed', ({ activity, activeTab: nextTab, announcement }: { activity: ActivityType; activeTab: TabType; announcement?: any }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          activeActivity: activity,
          activeTab: nextTab,
          activityVoteSession: null,
          activityAnnouncement: announcement || null,
        };
      });
      setActiveTab(nextTab);
      if (nextTab === 'hangout') {
        setCallLayout('full');
      } else {
        setCallLayout('minimized');
      }
      if (announcement?.text) {
        setActivityAnnouncement(announcement.text);
        setTimeout(() => setActivityAnnouncement(null), 5000);
      }
      sounds.playNotificationSound();
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setRoom(prev => {
        if (!prev) return null;
        return { ...prev, chat: [...prev.chat, msg] };
      });
      if (!isChatOpen) {
        setUnreadChatCount(c => c + 1);
      }
    });

    socket.on('floating_reaction', (reaction: FloatingReaction) => {
      setFloatingReactions(prev => [...prev, reaction]);
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 2500);
    });

    socket.on('kicked', () => {
      alert('You have been removed from the room by the host.');
      handleLeaveCall();
    });

    // Skribbl Socket Events
    socket.on('skribbl_status_changed', (data: any) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: {
            ...prev.skribbl,
            status: data.status,
            drawerId: data.drawerId,
            drawerName: data.drawerName,
            currentRound: data.currentRound,
            totalRounds: data.totalRounds,
            timeLeft: 100,
            wordOptions: data.wordOptions !== undefined ? data.wordOptions : prev.skribbl.wordOptions,
            wordOptionDifficulties: data.wordOptionDifficulties !== undefined ? data.wordOptionDifficulties : prev.skribbl.wordOptionDifficulties,
          },
        };
      });
      setStrokes([]);
    });

    socket.on('skribbl_word_options', ({ options, difficulties }: { options: string[]; difficulties?: any }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: {
            ...prev.skribbl,
            wordOptions: options,
            wordOptionDifficulties: difficulties,
            status: 'selecting_word',
          },
        };
      });
    });

    socket.on('skribbl_difficulty_changed', ({ difficulty }: { difficulty: any }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: {
            ...prev.skribbl,
            difficulty,
          },
        };
      });
    });

    socket.on('skribbl_turn_started', (turnData: any) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: {
            ...prev.skribbl,
            status: 'drawing',
            drawerId: turnData.drawerId,
            drawerName: turnData.drawerName,
            secretWord: turnData.secretWord !== undefined ? turnData.secretWord : prev.skribbl.secretWord,
            maskedHint: turnData.maskedHint,
            timeLeft: turnData.timeLeft || 100,
            correctGuessers: [],
            wordOptions: undefined,
            reactions: turnData.reactions || { likes: [], dislikes: [] },
            scoringRules: turnData.scoringRules || { likePoints: 5, dislikePoints: 2 },
          },
        };
      });
      setStrokes([]);
    });

    socket.on('skribbl_reactions_updated', ({ reactions, scores }: { reactions: any; scores: Record<string, number> }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: {
            ...prev.skribbl,
            reactions,
            scores: scores || prev.skribbl.scores,
          },
          participants: prev.participants.map(p => ({
            ...p,
            score: (scores && scores[p.id] !== undefined) ? scores[p.id] : p.score,
          })),
        };
      });
    });

    socket.on('skribbl_tick', ({ timeLeft }: { timeLeft: number }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: { ...prev.skribbl, timeLeft },
        };
      });
      if (timeLeft <= 5 && timeLeft > 0) {
        sounds.playTimerWarningSound();
      }
    });

    socket.on('skribbl_hint_update', ({ maskedHint }: { maskedHint: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: { ...prev.skribbl, maskedHint },
        };
      });
    });

    socket.on('skribbl_score_update', ({ scores, correctGuessers }: { scores: Record<string, number>; correctGuessers: string[] }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: {
            ...prev.skribbl,
            scores,
            correctGuessers,
          },
          participants: prev.participants.map(p => ({
            ...p,
            score: scores[p.id] || p.score,
          })),
        };
      });
    });

    socket.on('skribbl_stroke_added', (stroke: DrawingStroke) => {
      setStrokes(prev => [...prev, stroke]);
    });

    socket.on('skribbl_stroke_end', ({ stroke }: { stroke: DrawingStroke }) => {
      if (stroke) {
        setStrokes(prev => {
          if (prev.some(s => s.id === stroke.id)) return prev;
          return [...prev, stroke];
        });
      }
    });

    socket.on('skribbl_strokes_sync', ({ strokes }: { strokes: DrawingStroke[] }) => {
      setStrokes(strokes || []);
    });

    socket.on('skribbl_canvas_cleared', () => {
      setStrokes([]);
    });

    socket.on('skribbl_round_ended', ({ revealedWord, scores }: { revealedWord: string; scores: Record<string, number> }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: {
            ...prev.skribbl,
            status: 'round_end',
            secretWord: revealedWord,
            scores,
          },
        };
      });
    });

    socket.on('skribbl_game_over', ({ scores }: { scores: Record<string, number> }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          skribbl: { ...prev.skribbl, status: 'game_over', scores },
        };
      });
    });

    // Watch Party Socket Events
    socket.on('watch_party_updated', (party: any) => {
      setRoom(prev => prev ? { ...prev, watchParty: party } : null);
    });

    socket.on('watch_countdown_tick', ({ count }: { count: number }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          watchParty: { ...prev.watchParty, countdown: count > 0 ? count : null },
        };
      });
      sounds.playCountdownTick();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Hook up speaking detector to broadcast speaking status and local stream recovery
  useEffect(() => {
    mediaService.onSpeakingChange = (speaking: boolean) => {
      if (socketRef.current) {
        socketRef.current.emit('update_media_state', { isSpeaking: speaking });
      }
    };
    mediaService.onLocalStreamChange = (newStream: MediaStream | null) => {
      setLocalStream(newStream);
    };
    mediaService.onConnectionStateChange = (state: string) => {
      setConnectionStatus(state);
    };
  }, []);

  const handleJoinLounge = async (
    roomCode: string,
    name: string,
    avatar: string,
    muted: boolean,
    videoOff: boolean,
    isCreate?: boolean
  ) => {
    setIsAudioMuted(muted);
    setIsVideoOff(videoOff);

    // Initialize media stream gracefully
    const mediaRes = await mediaService.initLocalMedia(!videoOff, !muted);
    setLocalStream(mediaRes.stream);

    if (mediaRes.videoError && !videoOff) {
      setIsVideoOff(true);
    }
    if (mediaRes.audioError && !muted) {
      setIsAudioMuted(true);
    }

    const stableId = getStableParticipantId();
    currentParticipantIdRef.current = stableId;
    currentParticipantNameRef.current = name;
    currentParticipantAvatarRef.current = avatar;
    currentRoomCodeRef.current = roomCode;

    // Join room via socket
    if (socketRef.current) {
      socketRef.current.emit('join_room', {
        roomCode,
        participantName: name,
        avatar,
        isCreate,
        participantId: stableId,
      });
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'hangout') {
      setCallLayout('full');
    } else {
      setCallLayout('minimized');
    }
  };

  const handleLayoutChange = (mode: CallLayoutMode) => {
    setCallLayout(mode);
    if (mode === 'full') {
      setActiveTab('hangout');
    }
  };

  /**
   * Robust toggle for microphone with permission denial recovery.
   * Keeps state in sync with real device state.
   */
  const handleToggleAudio = async () => {
    if (isAudioMuted) {
      // Unmuting: attempt to activate real audio track
      const result = await mediaService.toggleMicrophone(false);
      if (result.success) {
        setIsAudioMuted(false);
        setLocalStream(result.stream);
        setMediaError(null);
        if (socketRef.current) {
          socketRef.current.emit('update_media_state', { isAudioMuted: false });
        }
      } else {
        // Failed: Keep muted and show actionable error modal
        setIsAudioMuted(true);
        if (result.error) setMediaError(result.error);
      }
    } else {
      // Muting
      await mediaService.toggleMicrophone(true);
      setIsAudioMuted(true);
      if (socketRef.current) {
        socketRef.current.emit('update_media_state', { isAudioMuted: true });
      }
    }
  };

  /**
   * Robust toggle for camera with permission denial recovery.
   * Keeps state in sync with real device state.
   */
  const handleToggleVideo = async () => {
    if (isVideoOff) {
      // Turning camera ON: retry getUserMedia on this explicit user click
      const result = await mediaService.toggleCamera(false);
      if (result.success) {
        setIsVideoOff(false);
        setLocalStream(result.stream);
        setMediaError(null);
        if (socketRef.current) {
          socketRef.current.emit('update_media_state', { isVideoOff: false });
        }
      } else {
        // Failed: Keep video off and show clear instructions
        setIsVideoOff(true);
        if (result.error) setMediaError(result.error);
      }
    } else {
      // Turning camera OFF
      await mediaService.toggleCamera(true);
      setIsVideoOff(true);
      if (socketRef.current) {
        socketRef.current.emit('update_media_state', { isVideoOff: true });
      }
    }
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      await mediaService.stopScreenShare();
      setIsScreenSharing(false);
      setScreenStream(null);
      if (socketRef.current) {
        socketRef.current.emit('update_media_state', { isScreenSharing: false });
      }
    } else {
      const stream = await mediaService.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
        setScreenStream(stream);
        if (socketRef.current) {
          socketRef.current.emit('update_media_state', { isScreenSharing: true });
        }
      }
    }
  };

  const handleLeaveCall = async () => {
    if (socketRef.current) {
      socketRef.current.emit('leave_room');
    }
    await mediaService.disconnect();
    currentRoomCodeRef.current = null;
    currentParticipantIdRef.current = null;
    setInRoom(false);
    setRoom(null);
    setLocalStream(null);
    setScreenStream(null);
  };

  // Exit from an active game back to Hangout while preserving video call
  const handleExitGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('skribbl_leave_player');
    }
    setActiveTab('hangout');
    setCallLayout('full');
  };

  // Host returns the entire room to Hangout
  const handleHostReturnToHangout = () => {
    if (socketRef.current) {
      socketRef.current.emit('host_return_to_hangout');
    }
  };

  // Activity Hub & Voting Actions
  const handleSuggestOrVoteActivity = (activity: ActivityType) => {
    if (socketRef.current) {
      socketRef.current.emit('activity_suggest_vote', { activity });
    }
  };

  const handleHostLaunchActivity = (activity: ActivityType) => {
    if (socketRef.current) {
      socketRef.current.emit('activity_launch', { activity });
    }
    setIsActivityHubOpen(false);
  };

  const handleHostStartVote = () => {
    if (socketRef.current) {
      socketRef.current.emit('activity_start_vote');
    }
  };

  const handleHostResolveTie = (activity: ActivityType) => {
    if (socketRef.current) {
      socketRef.current.emit('activity_resolve_tie', { activity });
    }
    setIsActivityHubOpen(false);
  };

  const handleHostCancelVote = () => {
    if (socketRef.current) {
      socketRef.current.emit('activity_cancel_vote');
    }
  };

  const handleToggleLock = () => {
    if (socketRef.current) {
      socketRef.current.emit('toggle_lock');
    }
  };

  const handleKickParticipant = (participantId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('kick_participant', { participantId });
    }
  };

  // Watch Together Handlers
  const handleSetWatchMedia = (title: string, url: string) => {
    if (socketRef.current) {
      socketRef.current.emit('watch_set_media', { title, url });
    }
  };

  const handleTriggerSyncCue = () => {
    if (socketRef.current) {
      socketRef.current.emit('watch_trigger_sync_cue');
    }
  };

  const handleToggleWatchStatus = (status: 'playing' | 'paused') => {
    if (socketRef.current) {
      socketRef.current.emit('watch_update_status', { status });
    }
  };

  // Skribbl Handlers
  const handleStartSkribbl = () => {
    if (socketRef.current) {
      socketRef.current.emit('skribbl_start_game');
    }
  };

  const handleSetSkribblDifficulty = (difficulty: 'easy' | 'medium' | 'hard' | 'mixed') => {
    if (socketRef.current) {
      socketRef.current.emit('skribbl_set_difficulty', { difficulty });
    }
  };

  const handleSelectSkribblWord = (word: string) => {
    if (socketRef.current) {
      socketRef.current.emit('skribbl_select_word', { word });
    }
  };

  const handleDrawStroke = (stroke: DrawingStroke) => {
    if (socketRef.current) {
      socketRef.current.emit('skribbl_draw_stroke', stroke);
    }
  };

  const handleClearSkribblCanvas = () => {
    setStrokes([]);
    if (socketRef.current) {
      socketRef.current.emit('skribbl_clear_canvas');
    }
  };

  const handleSendChatGuess = (guess: string) => {
    if (socketRef.current) {
      socketRef.current.emit('skribbl_guess', { guess });
    }
  };

  const handleSendMessage = (text: string) => {
    if (socketRef.current) {
      socketRef.current.emit('send_chat', { text, channel: 'general' });
    }
  };

  const handleSendReaction = (emoji: string) => {
    if (socketRef.current) {
      socketRef.current.emit('send_reaction', { emoji });
    }
  };

  // Not in room: Render Landing Page
  if (!inRoom || !room) {
    return (
      <LandingPage
        initialRoomCode={initialRoomCode}
        externalError={joinError}
        onJoinRoom={handleJoinLounge}
      />
    );
  }

  const isHost = room.hostId === currentParticipantId;
  const screenSharingParticipant = room.participants.find(p => p.isScreenSharing);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07080d] text-slate-100 overflow-hidden font-sans">
      {/* Top Lounge Navbar with Activity Hub & Media Controls */}
      <Navbar
        roomCode={room.code}
        roomName={room.name}
        isLocked={room.isLocked}
        isHost={isHost}
        activeTab={activeTab}
        activeActivity={room.activeActivity || 'hangout'}
        voteSession={room.activityVoteSession}
        participants={room.participants}
        currentParticipantId={currentParticipantId}
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        callLayout={callLayout}
        unreadChatCount={unreadChatCount}
        isChatOpen={isChatOpen}
        connectionStatus={connectionStatus}
        onOpenActivityHub={() => setIsActivityHubOpen(true)}
        onTabChange={handleTabChange}
        onToggleLock={handleToggleLock}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) setUnreadChatCount(0);
        }}
        onExpandCall={() => setCallLayout('docked')}
      />

      {/* Room-Wide Activity Announcement Banner */}
      {activityAnnouncement && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-2.5 rounded-2xl shadow-2xl text-xs font-bold border border-white/20 animate-in fade-in flex items-center gap-2">
          <span>{activityAnnouncement}</span>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 text-white px-5 py-2.5 rounded-2xl shadow-2xl text-xs font-bold border border-white/20 animate-in fade-in">
          {errorMessage}
        </div>
      )}

      {/* Floating Emoji Reactions Layer */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingReactions.map((reaction, i) => (
          <div
            key={reaction.id}
            className="absolute bottom-24 text-4xl animate-float-reaction flex flex-col items-center"
            style={{ left: `${30 + (i % 6) * 12}%` }}
          >
            <span>{reaction.emoji}</span>
            <span className="text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded-full font-sans">
              {reaction.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Main Workspace & Persistent Video Call Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Activity Content Area */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Tab 1: Hangout (Spatial 3D Virtual Lounge & Participant Grid) */}
          {activeTab === 'hangout' && callLayout === 'full' && (
            <PersistentCallLayout
              participants={room.participants}
              currentParticipantId={currentParticipantId}
              isHost={isHost}
              layoutMode="full"
              localStream={localStream}
              screenStream={screenStream}
              isAudioMuted={isAudioMuted}
              isVideoOff={isVideoOff}
              isScreenSharing={isScreenSharing}
              roomCode={room.code}
              onLayoutChange={handleLayoutChange}
              onSelectActivity={(act) => handleTabChange(act)}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onToggleScreenShare={handleToggleScreenShare}
              onLeaveCall={handleLeaveCall}
              onKickParticipant={handleKickParticipant}
            />
          )}

          {/* Tab 2: Watch Together (3D Cinema Expansion Transition) */}
          {activeTab === 'watch' && (
            <div className="w-full h-full flex-1 flex flex-col overflow-hidden animate-expand-cinema perspective-1000">
              <WatchTogether
                watchParty={room.watchParty}
                isHost={isHost}
                participants={room.participants}
                screenSharingParticipant={screenSharingParticipant}
                screenStream={screenSharingParticipant?.id === currentParticipantId ? screenStream : null}
                onSetMedia={handleSetWatchMedia}
                onTriggerSyncCue={handleTriggerSyncCue}
                onToggleStatus={handleToggleWatchStatus}
                onStartScreenShare={handleToggleScreenShare}
                onReturnToHangout={handleExitGame}
                onHostReturnToHangout={handleHostReturnToHangout}
              />
            </div>
          )}

          {/* Tab 3: Skribbl Drawing Game (3D Unfold Drawing Board Transition) */}
          {activeTab === 'skribbl' && (
            <div className="w-full h-full flex-1 flex flex-col overflow-hidden animate-unfold-scribble perspective-1500">
              <SkribblGame
                skribbl={room.skribbl}
                strokes={strokes}
                participants={room.participants}
                chat={room.chat}
                currentParticipantId={currentParticipantId}
                isHost={isHost}
                socket={socketRef.current}
                onStartGame={handleStartSkribbl}
                onSetDifficulty={handleSetSkribblDifficulty}
                onSelectWord={handleSelectSkribblWord}
                onDrawStroke={handleDrawStroke}
                onClearCanvas={handleClearSkribblCanvas}
                onSendChatGuess={handleSendChatGuess}
                onSendChatMessage={handleSendMessage}
                onExitGame={handleExitGame}
                onHostEndGame={handleHostReturnToHangout}
              />
            </div>
          )}

          {/* Tab 4: Games Hub (Spatial Depth Fade Transition) */}
          {activeTab === 'games' && (
            <div className="w-full h-full flex-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 perspective-1000">
              <GamesHub
                participants={room.participants}
                currentParticipantId={currentParticipantId}
                isHost={isHost}
                socket={socketRef.current}
                initialGame={
                  ['trivia', 'truth_or_dare', 'would_you_rather', 'tic_tac_toe'].includes(room.activeActivity)
                    ? (room.activeActivity as any)
                    : 'menu'
                }
                onReturnToHangout={handleExitGame}
                onHostReturnToHangout={handleHostReturnToHangout}
              />
            </div>
          )}
        </main>

        {/* 
          CRITICAL REQUIREMENT: Persistent Video Call Component
          Stays mounted and connected across ALL activities!
          When not in 'full' mode (or when viewing Watch/Skribbl/Games), renders in docked or minimized mode.
        */}
        {(callLayout !== 'full' || activeTab !== 'hangout') && (
          <PersistentCallLayout
            participants={room.participants}
            currentParticipantId={currentParticipantId}
            isHost={isHost}
            layoutMode={callLayout === 'full' ? 'minimized' : callLayout}
            localStream={localStream}
            screenStream={screenStream}
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            onLayoutChange={handleLayoutChange}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
            onLeaveCall={handleLeaveCall}
            onKickParticipant={handleKickParticipant}
          />
        )}

        {/* Live Chat Drawer */}
        <ChatPanel
          chat={room.chat}
          currentParticipantId={currentParticipantId}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onSendMessage={handleSendMessage}
          onSendReaction={handleSendReaction}
        />
      </div>

      {/* Room-Wide Activity Selection Hub Modal */}
      <ActivityHubModal
        isOpen={isActivityHubOpen}
        onClose={() => setIsActivityHubOpen(false)}
        activeActivity={room.activeActivity || 'hangout'}
        voteSession={room.activityVoteSession}
        participants={room.participants}
        currentParticipantId={currentParticipantId}
        isHost={isHost}
        onSuggestOrVote={handleSuggestOrVoteActivity}
        onHostLaunch={handleHostLaunchActivity}
        onHostStartVote={handleHostStartVote}
        onHostResolveTie={handleHostResolveTie}
        onHostCancelVote={handleHostCancelVote}
      />

      {/* Permission & Device Recovery Modal */}
      {mediaError && (
        <MediaPermissionModal
          error={mediaError}
          onRetry={() => {
            if (mediaError.kind === 'camera') {
              handleToggleVideo();
            } else {
              handleToggleAudio();
            }
          }}
          onDismiss={() => setMediaError(null)}
        />
      )}
    </div>
  );
}
