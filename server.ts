import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { WORD_BANK, getRandomWord, generateWordOptions, getWordHint, isCorrectGuess, isCloseGuess } from './src/game/wordBank.ts';
import { calculateGuessScore, calculateDrawerScore } from './src/game/scoring.ts';
import type { 
  Participant, 
  RoomState, 
  DrawingStroke, 
  ChatMessage, 
  TabType, 
  ActivityType,
  ActivityVoteSession,
  ActivityAnnouncement 
} from './src/types/index.ts';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// In-memory room storage
interface InternalRoom extends RoomState {
  strokes: DrawingStroke[];
  timerInterval?: NodeJS.Timeout | null;
  voteTimerInterval?: NodeJS.Timeout | null;
  wordSelectionTimeout?: NodeJS.Timeout | null;
  drawerIndex: number;
  usedWords: Set<string>;
}

const rooms = new Map<string, InternalRoom>();

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  watch: 'Watch Together (FrameX TV)',
  skribbl: 'Skribbl / Drawing Game',
  trivia: 'Quick Trivia',
  truth_or_dare: 'Truth or Dare',
  would_you_rather: 'Would You Rather',
  tic_tac_toe: 'Tic-Tac-Toe',
  hangout: 'Hangout Lounge',
};

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createEmptyVoteProposals(): Record<ActivityType, { voterIds: string[]; voterNames: string[] }> {
  return {
    watch: { voterIds: [], voterNames: [] },
    skribbl: { voterIds: [], voterNames: [] },
    trivia: { voterIds: [], voterNames: [] },
    truth_or_dare: { voterIds: [], voterNames: [] },
    would_you_rather: { voterIds: [], voterNames: [] },
    tic_tac_toe: { voterIds: [], voterNames: [] },
    hangout: { voterIds: [], voterNames: [] },
  };
}

function getOrCreateRoom(code: string, hostName?: string): InternalRoom {
  const upperCode = code.toUpperCase();
  let room = rooms.get(upperCode);
  if (!room) {
    room = {
      code: upperCode,
      name: `Afterhours #${upperCode}`,
      isLocked: false,
      hostId: '',
      activeTab: 'hangout',
      activeActivity: 'hangout',
      activityVoteSession: null,
      activityAnnouncement: null,
      participants: [],
      watchParty: {
        title: 'FrameX TV',
        url: 'https://framextv.xyz/',
        status: 'paused',
        currentTime: 0,
        lastUpdated: Date.now(),
        hostId: '',
        countdown: null,
      },
      skribbl: {
        status: 'lobby',
        difficulty: 'mixed',
        drawerId: null,
        drawerName: '',
        maskedHint: '',
        currentRound: 0,
        totalRounds: 3,
        timeLeft: 100,
        correctGuessers: [],
        scores: {},
        reactions: { likes: [], dislikes: [] },
        scoringRules: { likePoints: 5, dislikePoints: 2 },
      },
      chat: [
        {
          id: 'welcome-1',
          senderId: 'system',
          senderName: 'AFTERHOURS',
          senderAvatar: '🌙',
          text: 'Welcome to AFTERHOURS! The host controls shared activities. Open Activity Hub to suggest games and vote.',
          timestamp: Date.now(),
          isSystem: true,
        },
      ],
      strokes: [],
      drawerIndex: 0,
      usedWords: new Set<string>(),
    };
    rooms.set(upperCode, room);
  }
  return room;
}

// -----------------------------------------------------------------------------
// LiveKit Token API
// -----------------------------------------------------------------------------
app.get('/api/livekit/status', (req, res) => {
  const configured = Boolean(
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET &&
    process.env.LIVEKIT_URL
  );
  res.json({
    configured,
    url: process.env.LIVEKIT_URL || null,
  });
});

app.post('/api/livekit/token', async (req, res) => {
  try {
    const { roomName, participantName, participantId } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.json({
        configured: false,
        token: null,
        url: null,
        message: 'LiveKit Cloud credentials not configured. Local media mesh fallback will be used.',
      });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId || participantName,
      name: participantName,
      ttl: '4h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({
      configured: true,
      token,
      url: livekitUrl,
    });
  } catch (err: any) {
    console.error('Error generating LiveKit token:', err);
    res.status(500).json({ error: 'Failed to generate LiveKit token' });
  }
});

// Create new room API (Shared backend room registry)
app.post('/api/rooms', (req, res) => {
  try {
    const { hostName, roomName } = req.body || {};
    const code = generateRoomCode();
    const room = getOrCreateRoom(code, hostName);
    if (roomName && typeof roomName === 'string') {
      room.name = roomName.trim();
    }
    console.log(`[API] Created room ${code} on shared backend (Host: ${hostName || 'Guest'})`);
    res.status(201).json({
      success: true,
      room: {
        code: room.code,
        name: room.name,
        isLocked: room.isLocked,
        participantCount: room.participants.length,
      },
    });
  } catch (err: any) {
    console.error('Error creating room via API:', err);
    res.status(500).json({ success: false, error: 'Failed to create room on server' });
  }
});

// Room existence check with normalized uppercase and detailed status
app.get('/api/rooms/:code', (req, res) => {
  const rawCode = req.params.code || '';
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length < 3) {
    return res.status(400).json({ success: false, error: 'Invalid room code format' });
  }
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({
      success: false,
      error: `Room "${code}" does not exist. Please check the code with the host or create a new room.`,
    });
  }
  res.json({
    success: true,
    code: room.code,
    name: room.name,
    isLocked: room.isLocked,
    participantCount: room.participants.length,
    activeActivity: room.activeActivity,
  });
});

// -----------------------------------------------------------------------------
// Socket.IO Real-Time Engine (Server-Authoritative Membership & Reconnect Safe)
// -----------------------------------------------------------------------------
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const socketToParticipant = new Map<string, string>();
const socketToRoom = new Map<string, string>();

io.on('connection', (socket: Socket) => {
  let currentRoomCode: string | null = null;
  let currentParticipantId: string | null = null;

  socket.on('join_room', ({ 
    roomCode, 
    participantName, 
    avatar, 
    isCreate,
    participantId: requestedParticipantId,
    isReconnect,
  }: { 
    roomCode?: string; 
    participantName: string; 
    avatar?: string; 
    isCreate?: boolean;
    participantId?: string;
    isReconnect?: boolean;
  }) => {
    const cleanName = (participantName || '').trim();
    if (!cleanName) {
      socket.emit('join_failed', { message: 'Display name cannot be empty.' });
      return;
    }

    const rawCode = (roomCode || '').trim().toUpperCase();
    let code = rawCode;

    if (!code) {
      code = generateRoomCode();
    }

    let room = rooms.get(code);
    if (!room) {
      // If code was entered by user to JOIN, but room doesn't exist, do NOT create a false isolated room!
      if (rawCode && !isCreate) {
        socket.emit('join_failed', {
          message: `Room "${rawCode}" was not found. Please verify the code with your host.`,
        });
        socket.emit('error_message', {
          message: `Room "${rawCode}" does not exist.`,
        });
        return;
      }
      // Create new room on backend
      room = getOrCreateRoom(code, cleanName);
    }

    if (room.isLocked && room.participants.length > 0) {
      // Allow rejoining locked room if user was already a participant
      const isAlreadyIn = requestedParticipantId && room.participants.some(p => p.id === requestedParticipantId);
      if (!isAlreadyIn) {
        socket.emit('join_failed', { message: 'This room is currently locked by the host.' });
        socket.emit('error_message', { message: 'This room is currently locked by the host.' });
        return;
      }
    }

    // Stable participant identity: prefer client-provided stable ID, fallback to socket.id
    const stableId = (requestedParticipantId && String(requestedParticipantId).trim()) || socket.id;
    currentRoomCode = code;
    currentParticipantId = stableId;

    // Track active socket
    socketToParticipant.set(socket.id, stableId);
    socketToRoom.set(socket.id, code);

    // Cancel any pending disconnect timer for this participant (they reconnected!)
    const pendingTimer = disconnectTimers.get(stableId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      disconnectTimers.delete(stableId);
    }

    socket.join(code);
    socket.join(stableId);

    // Check if participant already exists in room (reconnection or refresh)
    const existingIndex = room.participants.findIndex(p => p.id === stableId);
    let participant: Participant;

    if (existingIndex !== -1) {
      // Reconnecting participant
      participant = room.participants[existingIndex];
      participant.isDisconnected = false;
      if (cleanName) participant.name = cleanName;
      if (avatar) participant.avatar = avatar;

      // Keep host identity if they were the host
      if (room.hostId === stableId) {
        participant.isHost = true;
      }

      // Notify others of reconnection
      socket.to(code).emit('participant_updated', participant);
    } else {
      // Brand new participant
      const isFirstParticipant = room.participants.length === 0;
      const isHost = isFirstParticipant || !room.hostId || room.hostId === stableId;

      if (isHost) {
        room.hostId = stableId;
        room.watchParty.hostId = stableId;
      }

      participant = {
        id: stableId,
        name: cleanName || `Guest_${stableId.substring(0, 4)}`,
        avatar: avatar || ['🦊', '🐼', '🦁', '🚀', '⚡', '🌙', '🎨', '🍿'][Math.floor(Math.random() * 8)],
        isHost,
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        isSpeaking: false,
        joinedAt: Date.now(),
        score: room.skribbl.scores[stableId] || 0,
        color: ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4'][room.participants.length % 6],
        isDisconnected: false,
      };

      room.participants.push(participant);
      if (!room.skribbl.scores[stableId]) {
        room.skribbl.scores[stableId] = 0;
      }

      // Notify others of new participant
      socket.to(code).emit('participant_joined', participant);

      // Broadcast join system chat message only for fresh joins (not reconnects)
      if (!isReconnect) {
        const joinMsg: ChatMessage = {
          id: `join-${Date.now()}-${Math.random()}`,
          senderId: 'system',
          senderName: 'AFTERHOURS',
          senderAvatar: '👋',
          text: `${participant.name} joined the lounge`,
          timestamp: Date.now(),
          isSystem: true,
        };
        room.chat.push(joinMsg);
        io.to(code).emit('chat_message', joinMsg);
      }
    }

    // Send full authoritative room snapshot to this joining/reconnecting participant
    socket.emit('room_joined', {
      room: {
        code: room.code,
        name: room.name,
        isLocked: room.isLocked,
        hostId: room.hostId,
        activeTab: room.activeTab,
        activeActivity: room.activeActivity,
        activityVoteSession: room.activityVoteSession,
        activityAnnouncement: room.activityAnnouncement,
        participants: room.participants,
        watchParty: room.watchParty,
        skribbl: {
          ...room.skribbl,
          secretWord: stableId === room.skribbl.drawerId ? room.skribbl.secretWord : undefined,
          wordOptions: (room.skribbl.status === 'selecting_word' && stableId === room.skribbl.drawerId)
            ? room.skribbl.wordOptions
            : undefined,
          wordOptionDifficulties: (room.skribbl.status === 'selecting_word' && stableId === room.skribbl.drawerId)
            ? room.skribbl.wordOptionDifficulties
            : undefined,
        },
        chat: room.chat,
      },
      currentParticipantId: stableId,
      strokes: room.strokes,
    });

    // Authoritative participant sync for ALL users in the room
    io.to(code).emit('participants_synced', {
      participants: room.participants,
      hostId: room.hostId,
    });
  });

  // Media controls broadcast (mute, camera, screen share)
  socket.on('update_media_state', (updates: Partial<Participant>) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const p = room.participants.find(part => part.id === currentParticipantId);
    if (p) {
      if (typeof updates.isAudioMuted === 'boolean') p.isAudioMuted = updates.isAudioMuted;
      if (typeof updates.isVideoOff === 'boolean') p.isVideoOff = updates.isVideoOff;
      if (typeof updates.isScreenSharing === 'boolean') p.isScreenSharing = updates.isScreenSharing;
      if (typeof updates.isSpeaking === 'boolean') p.isSpeaking = updates.isSpeaking;
      io.to(currentRoomCode).emit('participant_updated', p);
    }
  });

  // Host lock controls
  socket.on('toggle_lock', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) return;
    room.isLocked = !room.isLocked;
    io.to(currentRoomCode).emit('room_lock_changed', { isLocked: room.isLocked });
  });

  socket.on('kick_participant', ({ participantId }: { participantId: string }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) return;
    const target = room.participants.find(p => p.id === participantId);
    if (target) {
      io.to(participantId).emit('kicked');
      room.participants = room.participants.filter(p => p.id !== participantId);
      io.to(currentRoomCode).emit('participant_left', { participantId });
    }
  });

  // ---------------------------------------------------------------------------
  // Room-Wide Activity Selection & Voting System
  // ---------------------------------------------------------------------------
  socket.on('activity_suggest_vote', ({ activity }: { activity: ActivityType }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const sender = room.participants.find(p => p.id === currentParticipantId);
    if (!sender) return;

    if (!room.activityVoteSession) {
      room.activityVoteSession = {
        isActive: false,
        timeLeft: 30,
        status: 'voting',
        proposals: createEmptyVoteProposals(),
      };
    }

    // Ensure proposals structure exists
    if (!room.activityVoteSession.proposals) {
      room.activityVoteSession.proposals = createEmptyVoteProposals();
    }

    // Prevent duplicate votes: remove sender from any previous proposal
    for (const actKey of Object.keys(room.activityVoteSession.proposals) as ActivityType[]) {
      const prop = room.activityVoteSession.proposals[actKey];
      if (prop) {
        const idx = prop.voterIds.indexOf(currentParticipantId);
        if (idx !== -1) {
          prop.voterIds.splice(idx, 1);
          prop.voterNames.splice(idx, 1);
        }
      }
    }

    // Add to selected activity proposal
    if (!room.activityVoteSession.proposals[activity]) {
      room.activityVoteSession.proposals[activity] = { voterIds: [], voterNames: [] };
    }
    room.activityVoteSession.proposals[activity].voterIds.push(currentParticipantId);
    room.activityVoteSession.proposals[activity].voterNames.push(sender.name);

    io.to(currentRoomCode).emit('activity_vote_updated', room.activityVoteSession);

    // Send chat note of suggestion
    const actLabel = ACTIVITY_LABELS[activity] || activity;
    const suggestMsg: ChatMessage = {
      id: `suggest-${Date.now()}-${Math.random()}`,
      senderId: 'system',
      senderName: 'ACTIVITY HUB',
      senderAvatar: '🗳️',
      text: `${sender.name} suggested & voted for: ${actLabel}`,
      timestamp: Date.now(),
      isSystem: true,
    };
    room.chat.push(suggestMsg);
    io.to(currentRoomCode).emit('chat_message', suggestMsg);
  });

  socket.on('activity_start_vote', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) {
      socket.emit('error_message', { message: 'Only the room host can start a group vote.' });
      return;
    }

    if (!room.activityVoteSession) {
      room.activityVoteSession = {
        isActive: true,
        timeLeft: 30,
        status: 'voting',
        proposals: createEmptyVoteProposals(),
      };
    } else {
      room.activityVoteSession.isActive = true;
      room.activityVoteSession.timeLeft = 30;
      room.activityVoteSession.status = 'voting';
      room.activityVoteSession.tiedActivities = undefined;
    }

    if (room.voteTimerInterval) clearInterval(room.voteTimerInterval);

    io.to(currentRoomCode).emit('activity_vote_started', room.activityVoteSession);

    const voteMsg: ChatMessage = {
      id: `vote-start-${Date.now()}`,
      senderId: 'system',
      senderName: 'ACTIVITY HUB',
      senderAvatar: '⏱️',
      text: `Host started a 30-second group vote! Cast your vote in the Activity Hub.`,
      timestamp: Date.now(),
      isSystem: true,
    };
    room.chat.push(voteMsg);
    io.to(currentRoomCode).emit('chat_message', voteMsg);

    room.voteTimerInterval = setInterval(() => {
      if (!room.activityVoteSession) {
        if (room.voteTimerInterval) clearInterval(room.voteTimerInterval);
        return;
      }

      room.activityVoteSession.timeLeft -= 1;
      io.to(room.code).emit('activity_vote_tick', { timeLeft: room.activityVoteSession.timeLeft });

      if (room.activityVoteSession.timeLeft <= 0) {
        if (room.voteTimerInterval) clearInterval(room.voteTimerInterval);
        room.voteTimerInterval = null;

        // Tally votes
        let maxVotes = 0;
        let candidates: ActivityType[] = [];

        for (const [actKey, prop] of Object.entries(room.activityVoteSession.proposals)) {
          const count = prop.voterIds.length;
          if (count > maxVotes) {
            maxVotes = count;
            candidates = [actKey as ActivityType];
          } else if (count === maxVotes && count > 0) {
            candidates.push(actKey as ActivityType);
          }
        }

        if (maxVotes === 0 || candidates.length === 0) {
          // No votes cast, stay on current or return to hangout
          room.activityVoteSession.isActive = false;
          room.activityVoteSession.status = 'concluded';
          io.to(room.code).emit('activity_vote_concluded', { winner: room.activeActivity });
          return;
        }

        if (candidates.length > 1) {
          // Tie detected! Let the host decide or restart vote
          room.activityVoteSession.isActive = false;
          room.activityVoteSession.status = 'tied';
          room.activityVoteSession.tiedActivities = candidates;
          io.to(room.code).emit('activity_vote_tied', { tiedActivities: candidates });

          const tieMsg: ChatMessage = {
            id: `tie-${Date.now()}`,
            senderId: 'system',
            senderName: 'ACTIVITY HUB',
            senderAvatar: '⚖️',
            text: `Vote ended in a tie between ${candidates.map(c => ACTIVITY_LABELS[c]).join(' and ')}. Awaiting host decision!`,
            timestamp: Date.now(),
            isSystem: true,
          };
          room.chat.push(tieMsg);
          io.to(room.code).emit('chat_message', tieMsg);
        } else {
          // Clear single winner!
          const winner = candidates[0];
          launchActivity(room, winner, `Vote winner: ${ACTIVITY_LABELS[winner]}`);
        }
      }
    }, 1000);
  });

  socket.on('activity_launch', ({ activity }: { activity: ActivityType }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) {
      socket.emit('error_message', { message: 'Only the room host can launch room-wide activities.' });
      return;
    }
    launchActivity(room, activity, `Host launched ${ACTIVITY_LABELS[activity]}`);
  });

  socket.on('activity_resolve_tie', ({ activity }: { activity: ActivityType }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) return;
    launchActivity(room, activity, `Host broke the tie: launched ${ACTIVITY_LABELS[activity]}`);
  });

  socket.on('activity_cancel_vote', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) return;
    if (room.voteTimerInterval) clearInterval(room.voteTimerInterval);
    room.activityVoteSession = null;
    io.to(currentRoomCode).emit('activity_vote_cancelled');
  });

  // ---------------------------------------------------------------------------
  // Chat Message & Guess Interception
  // ---------------------------------------------------------------------------
  // Dedicated Skribbl Guess Handler & General Chat Separation (Requirement 2)
  // ---------------------------------------------------------------------------
  const handleSkribblGuessAction = (socketInstance: any, text: string) => {
    if (!currentRoomCode || !currentParticipantId || !text.trim()) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const sender = room.participants.find(p => p.id === currentParticipantId);
    if (!sender) return;

    const trimmedText = text.trim();

    // Only validate guesses if Skribbl is in the active drawing phase with a secret word
    if (
      room.skribbl.status === 'drawing' &&
      room.skribbl.secretWord
    ) {
      const isDrawer = room.skribbl.drawerId === currentParticipantId;
      const alreadyGuessed = room.skribbl.correctGuessers.includes(currentParticipantId);

      if (isDrawer) {
        socketInstance.emit('error_message', { message: 'You are the drawer! Do not spoil the secret word.' });
        return;
      }
      if (alreadyGuessed) {
        socketInstance.emit('error_message', { message: 'You already guessed the word for this round!' });
        return;
      }

      // Active guesser checking against secret word
      if (isCorrectGuess(trimmedText, room.skribbl.secretWord)) {
        if (!room.skribbl.correctGuessers.includes(currentParticipantId)) {
          room.skribbl.correctGuessers.push(currentParticipantId);
          const orderIndex = room.skribbl.correctGuessers.length - 1;
          const guesserScore = calculateGuessScore({
            timeLeft: room.skribbl.timeLeft,
            totalTime: 100,
            orderIndex,
          });

          // Award score to guesser
          room.skribbl.scores[currentParticipantId] = (room.skribbl.scores[currentParticipantId] || 0) + guesserScore;
          sender.score = room.skribbl.scores[currentParticipantId];

          // Award score to drawer proportionally
          if (room.skribbl.drawerId) {
            const totalEligible = Math.max(1, room.participants.length - 1);
            const drawerBonus = calculateDrawerScore(room.skribbl.correctGuessers.length, totalEligible);
            room.skribbl.scores[room.skribbl.drawerId] = (room.skribbl.scores[room.skribbl.drawerId] || 0) + Math.round(drawerBonus / totalEligible);
            const drawer = room.participants.find(p => p.id === room.skribbl.drawerId);
            if (drawer) drawer.score = room.skribbl.scores[room.skribbl.drawerId];
          }

          const guessMsg: ChatMessage = {
            id: `guess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            senderId: 'system',
            senderName: 'SKRIBBL',
            senderAvatar: '🎯',
            text: `🎉 ${sender.name} guessed the word! (+${guesserScore} points)`,
            timestamp: Date.now(),
            isSystem: true,
            isCorrectGuess: true,
            channel: 'skribbl',
          };
          room.chat.push(guessMsg);
          io.to(currentRoomCode).emit('chat_message', guessMsg);
          io.to(currentRoomCode).emit('skribbl_score_update', {
            scores: room.skribbl.scores,
            correctGuessers: room.skribbl.correctGuessers,
            lastGuesserId: currentParticipantId,
            lastGuesserScore: guesserScore,
          });

          socketInstance.emit('skribbl_you_guessed', { score: guesserScore });

          // Check if all eligible guessers have guessed correctly
          const eligibleGuessers = room.participants.filter(p => p.id !== room.skribbl.drawerId);
          if (room.skribbl.correctGuessers.length >= eligibleGuessers.length) {
            endSkribblRound(room);
          }
        }
        return;
      } else {
        // Check if guess is close (e.g. 1 typo)
        if (isCloseGuess(trimmedText, room.skribbl.secretWord)) {
          socketInstance.emit('skribbl_close_guess', { guess: trimmedText });
        }
      }
    }

    // Broadcast non-matching guess into Skribbl game chat
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      text: trimmedText.substring(0, 300),
      timestamp: Date.now(),
      channel: 'skribbl',
    };
    room.chat.push(msg);
    if (room.chat.length > 150) room.chat.shift();
    io.to(currentRoomCode).emit('chat_message', msg);
  };

  // Dedicated socket event for in-game guesses
  socket.on('skribbl_guess', ({ guess }: { guess: string }) => {
    handleSkribblGuessAction(socket, guess);
  });

  // General chat handler (never triggers game scoring when channel !== 'skribbl')
  socket.on('send_chat', ({ text, channel }: { text: string; channel?: 'general' | 'skribbl' }) => {
    if (channel === 'skribbl') {
      handleSkribblGuessAction(socket, text);
      return;
    }

    // Ordinary general chat: completely separated from game guess logic
    if (!currentRoomCode || !currentParticipantId || !text.trim()) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const sender = room.participants.find(p => p.id === currentParticipantId);
    if (!sender) return;

    const trimmedText = text.trim();
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      text: trimmedText.substring(0, 300),
      timestamp: Date.now(),
      channel: 'general',
    };
    room.chat.push(msg);
    if (room.chat.length > 150) room.chat.shift();
    io.to(currentRoomCode).emit('chat_message', msg);
  });

  // Floating reactions
  socket.on('send_reaction', ({ emoji }: { emoji: string }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const sender = room.participants.find(p => p.id === currentParticipantId);
    if (!sender) return;

    io.to(currentRoomCode).emit('floating_reaction', {
      id: `react-${Date.now()}-${Math.random()}`,
      emoji,
      senderName: sender.name,
    });
  });

  // ---------------------------------------------------------------------------
  // Skribbl Drawing Events & Exit Handling
  // ---------------------------------------------------------------------------
  socket.on('skribbl_set_difficulty', ({ difficulty }: { difficulty: any }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) return;
    if (['easy', 'medium', 'hard', 'mixed'].includes(difficulty)) {
      room.skribbl.difficulty = difficulty;
      io.to(currentRoomCode).emit('skribbl_difficulty_changed', { difficulty });
    }
  });

  socket.on('skribbl_start_game', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) return;
    room.skribbl.currentRound = 1;
    room.drawerIndex = 0;
    startSkribblTurn(room);
  });

  socket.on('skribbl_select_word', ({ word }: { word: string }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId || room.skribbl.status !== 'selecting_word') return;
    beginSkribblDrawingPhase(room, word);
  });

  socket.on('skribbl_request_words', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId || room.skribbl.status !== 'selecting_word') return;
    if (room.skribbl.wordOptions && room.skribbl.wordOptions.length > 0) {
      socket.emit('skribbl_word_options', {
        options: room.skribbl.wordOptions,
        difficulties: room.skribbl.wordOptionDifficulties,
      });
    } else {
      const { words: options, difficulties } = generateWordOptions(
        room.skribbl.difficulty || 'mixed',
        room.usedWords
      );
      room.skribbl.wordOptions = options;
      room.skribbl.wordOptionDifficulties = difficulties;
      socket.emit('skribbl_word_options', { options, difficulties });
    }
  });

  // Continuous Real-Time Drawing Synchronization (Skribbl.io style)
  socket.on('skribbl_stroke_start', (data: { strokeId: string; point: any; color: string; width: number; isEraser?: boolean }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId) return;
    socket.to(currentRoomCode).emit('skribbl_stroke_start', data);
  });

  socket.on('skribbl_stroke_chunk', (data: { strokeId: string; points: any[] }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId) return;
    socket.to(currentRoomCode).emit('skribbl_stroke_chunk', data);
  });

  socket.on('skribbl_stroke_end', (data: { strokeId: string; stroke: DrawingStroke }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId) return;
    if (data.stroke) {
      room.strokes.push(data.stroke);
      if (room.strokes.length > 1000) room.strokes.shift();
    }
    socket.to(currentRoomCode).emit('skribbl_stroke_end', data);
  });

  socket.on('skribbl_undo_stroke', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId) return;
    if (room.strokes.length > 0) {
      room.strokes.pop();
    }
    io.to(currentRoomCode).emit('skribbl_strokes_sync', { strokes: room.strokes });
  });

  socket.on('skribbl_draw_stroke', (stroke: DrawingStroke) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId) return;
    room.strokes.push(stroke);
    if (room.strokes.length > 1000) room.strokes.shift();
    socket.to(currentRoomCode).emit('skribbl_stroke_added', stroke);
  });

  socket.on('skribbl_clear_canvas', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.drawerId !== currentParticipantId) return;
    room.strokes = [];
    io.to(currentRoomCode).emit('skribbl_canvas_cleared');
  });

  // Reaction to active drawing (Likes / Dislikes affecting drawer score)
  socket.on('skribbl_react_drawing', ({ reaction }: { reaction: 'like' | 'dislike' }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.skribbl.status !== 'drawing' || !room.skribbl.drawerId) return;
    if (room.skribbl.drawerId === currentParticipantId) return; // Drawer cannot vote on their own drawing
    const sender = room.participants.find(p => p.id === currentParticipantId);
    if (!sender) return;

    if (!room.skribbl.reactions) {
      room.skribbl.reactions = { likes: [], dislikes: [] };
    }

    const drawerId = room.skribbl.drawerId;
    const drawer = room.participants.find(p => p.id === drawerId);
    let currentDrawerScore = room.skribbl.scores[drawerId] || 0;

    const wasLiked = room.skribbl.reactions.likes.includes(currentParticipantId);
    const wasDisliked = room.skribbl.reactions.dislikes.includes(currentParticipantId);

    let chatNote: string | null = null;
    let chatEmoji = '👍';

    if (reaction === 'like') {
      if (wasLiked) {
        // Toggle off like
        room.skribbl.reactions.likes = room.skribbl.reactions.likes.filter(id => id !== currentParticipantId);
        currentDrawerScore = Math.max(0, currentDrawerScore - 5);
      } else {
        if (wasDisliked) {
          room.skribbl.reactions.dislikes = room.skribbl.reactions.dislikes.filter(id => id !== currentParticipantId);
          currentDrawerScore += 2; // refund dislike penalty
        }
        room.skribbl.reactions.likes.push(currentParticipantId);
        currentDrawerScore += 5;
        chatNote = `${sender.name} liked the drawing 👍`;
        chatEmoji = '👍';
      }
    } else if (reaction === 'dislike') {
      if (wasDisliked) {
        // Toggle off dislike
        room.skribbl.reactions.dislikes = room.skribbl.reactions.dislikes.filter(id => id !== currentParticipantId);
        currentDrawerScore += 2; // refund dislike penalty
      } else {
        if (wasLiked) {
          room.skribbl.reactions.likes = room.skribbl.reactions.likes.filter(id => id !== currentParticipantId);
          currentDrawerScore = Math.max(0, currentDrawerScore - 5); // remove like bonus
        }
        room.skribbl.reactions.dislikes.push(currentParticipantId);
        currentDrawerScore = Math.max(0, currentDrawerScore - 2);
        chatNote = `${sender.name} disliked the drawing 👎`;
        chatEmoji = '👎';
      }
    }

    room.skribbl.scores[drawerId] = currentDrawerScore;
    if (drawer) drawer.score = currentDrawerScore;

    io.to(currentRoomCode).emit('skribbl_reactions_updated', {
      reactions: room.skribbl.reactions,
      scores: room.skribbl.scores,
      drawerId,
    });

    io.to(currentRoomCode).emit('skribbl_score_update', {
      scores: room.skribbl.scores,
      correctGuessers: room.skribbl.correctGuessers,
    });

    if (chatNote) {
      const msg: ChatMessage = {
        id: `react-chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        senderId: 'system',
        senderName: 'SKRIBBL',
        senderAvatar: chatEmoji,
        text: chatNote,
        timestamp: Date.now(),
        isSystem: true,
        channel: 'skribbl',
      };
      room.chat.push(msg);
      io.to(currentRoomCode).emit('chat_message', msg);
    }
  });

  // Player leaves Skribbl game without disconnecting their video call
  socket.on('skribbl_leave_player', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const sender = room.participants.find(p => p.id === currentParticipantId);

    // If leaving player was the active drawer, advance the round so game never freezes
    if (room.skribbl.drawerId === currentParticipantId && (room.skribbl.status === 'drawing' || room.skribbl.status === 'selecting_word')) {
      const leaveNote: ChatMessage = {
        id: `drawer-left-${Date.now()}`,
        senderId: 'system',
        senderName: 'SKRIBBL',
        senderAvatar: '🎨',
        text: `${sender?.name || 'Drawer'} stepped out of the game. Ending turn...`,
        timestamp: Date.now(),
        isSystem: true,
      };
      room.chat.push(leaveNote);
      io.to(currentRoomCode).emit('chat_message', leaveNote);
      endSkribblRound(room);
    }
  });

  // Host returns entire room to hangout
  socket.on('host_return_to_hangout', () => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentParticipantId) return;
    launchActivity(room, 'hangout', 'Host returned the room to Hangout Lounge');
  });

  // ---------------------------------------------------------------------------
  // Watch Party Events (FrameX TV)
  // ---------------------------------------------------------------------------
  socket.on('watch_set_media', ({ title, url }: { title: string; url: string }) => {
    if (!currentRoomCode || !currentParticipantId) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    room.watchParty.title = title || 'FrameX TV';
    room.watchParty.url = url || 'https://framextv.xyz/';
    room.watchParty.lastUpdated = Date.now();
    io.to(currentRoomCode).emit('watch_party_updated', room.watchParty);

    const changeMsg: ChatMessage = {
      id: `watch-${Date.now()}-${Math.random()}`,
      senderId: 'system',
      senderName: 'CINEMA',
      senderAvatar: '🎬',
      text: `Movie player updated: ${room.watchParty.title}`,
      timestamp: Date.now(),
      isSystem: true,
    };
    room.chat.push(changeMsg);
    io.to(currentRoomCode).emit('chat_message', changeMsg);
  });

  // Synchronized countdown beacon (3-2-1 launch)
  socket.on('watch_trigger_sync_cue', () => {
    if (!currentRoomCode) return;
    const roomCode = currentRoomCode;
    const room = rooms.get(roomCode);
    if (!room) return;

    let count = 3;
    room.watchParty.countdown = count;
    io.to(roomCode).emit('watch_countdown_tick', { count });

    const countdownTimer = setInterval(() => {
      count -= 1;
      room.watchParty.countdown = count > 0 ? count : null;
      io.to(roomCode).emit('watch_countdown_tick', { count });
      if (count <= 0) {
        clearInterval(countdownTimer);
        room.watchParty.status = 'playing';
        io.to(roomCode).emit('watch_party_updated', room.watchParty);
      }
    }, 1000);
  });

  socket.on('watch_update_status', ({ status, currentTime }: { status: 'playing' | 'paused'; currentTime?: number }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    room.watchParty.status = status;
    if (typeof currentTime === 'number') room.watchParty.currentTime = currentTime;
    room.watchParty.lastUpdated = Date.now();
    io.to(currentRoomCode).emit('watch_party_updated', room.watchParty);
  });



  // Explicit Leave Handling (User clicked leave / end call)
  const performExplicitLeave = () => {
    const participantId = socketToParticipant.get(socket.id) || currentParticipantId;
    const roomCode = socketToRoom.get(socket.id) || currentRoomCode;
    socketToParticipant.delete(socket.id);
    socketToRoom.delete(socket.id);

    if (!roomCode || !participantId) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    // Clear any pending grace timers
    const pendingTimer = disconnectTimers.get(participantId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      disconnectTimers.delete(participantId);
    }

    const leavingParticipant = room.participants.find(p => p.id === participantId);
    room.participants = room.participants.filter(p => p.id !== participantId);

    if (leavingParticipant) {
      const leaveMsg: ChatMessage = {
        id: `leave-${Date.now()}-${Math.random()}`,
        senderId: 'system',
        senderName: 'AFTERHOURS',
        senderAvatar: '🚪',
        text: `${leavingParticipant.name} left the room`,
        timestamp: Date.now(),
        isSystem: true,
      };
      room.chat.push(leaveMsg);
      io.to(roomCode).emit('chat_message', leaveMsg);
      io.to(roomCode).emit('participant_left', { participantId });
    }

    // Reassign host if leaving user was host
    if (room.hostId === participantId && room.participants.length > 0) {
      const nextHost = room.participants.find(p => !p.isDisconnected) || room.participants[0];
      if (nextHost) {
        room.hostId = nextHost.id;
        nextHost.isHost = true;
        io.to(roomCode).emit('participant_updated', nextHost);

        const hostMsg: ChatMessage = {
          id: `host-${Date.now()}`,
          senderId: 'system',
          senderName: 'AFTERHOURS',
          senderAvatar: '👑',
          text: `${nextHost.name} is now the room host`,
          timestamp: Date.now(),
          isSystem: true,
        };
        room.chat.push(hostMsg);
        io.to(roomCode).emit('chat_message', hostMsg);
      }
    }

    // Authoritative sync
    io.to(roomCode).emit('participants_synced', {
      participants: room.participants,
      hostId: room.hostId,
    });

    if (room.skribbl.drawerId === participantId && (room.skribbl.status === 'drawing' || room.skribbl.status === 'selecting_word')) {
      endSkribblRound(room);
    }

    if (room.participants.length === 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      if (room.voteTimerInterval) clearInterval(room.voteTimerInterval);
      setTimeout(() => {
        if (rooms.get(roomCode)?.participants.length === 0) {
          rooms.delete(roomCode);
        }
      }, 30 * 60 * 1000);
    }
  };

  socket.on('leave_room', () => {
    performExplicitLeave();
  });

  // Socket Disconnect (Temporary network drop, sleep mode, or browser tab switch)
  socket.on('disconnect', () => {
    const participantId = socketToParticipant.get(socket.id) || currentParticipantId;
    const roomCode = socketToRoom.get(socket.id) || currentRoomCode;
    socketToParticipant.delete(socket.id);
    socketToRoom.delete(socket.id);

    if (!roomCode || !participantId) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const participant = room.participants.find(p => p.id === participantId);
    if (!participant) return;

    // Do NOT immediately delete or transfer host!
    // Mark as temporarily disconnected and give a 25-second grace window to reconnect
    participant.isDisconnected = true;
    io.to(roomCode).emit('participant_updated', participant);
    io.to(roomCode).emit('participants_synced', {
      participants: room.participants,
      hostId: room.hostId,
    });

    // Cancel existing timer if any
    const existing = disconnectTimers.get(participantId);
    if (existing) clearTimeout(existing);

    const graceTimer = setTimeout(() => {
      disconnectTimers.delete(participantId);
      const targetRoom = rooms.get(roomCode);
      if (!targetRoom) return;

      const stillDisconnected = targetRoom.participants.find(p => p.id === participantId && p.isDisconnected);
      if (!stillDisconnected) return; // User reconnected in time!

      // Genuine departure confirmed after 25s grace period
      targetRoom.participants = targetRoom.participants.filter(p => p.id !== participantId);
      io.to(roomCode).emit('participant_left', { participantId });

      const leaveMsg: ChatMessage = {
        id: `leave-${Date.now()}-${Math.random()}`,
        senderId: 'system',
        senderName: 'AFTERHOURS',
        senderAvatar: '🚪',
        text: `${stillDisconnected.name} disconnected`,
        timestamp: Date.now(),
        isSystem: true,
      };
      targetRoom.chat.push(leaveMsg);
      io.to(roomCode).emit('chat_message', leaveMsg);

      // Reassign host only after grace period has expired without reconnecting
      if (targetRoom.hostId === participantId && targetRoom.participants.length > 0) {
        const nextHost = targetRoom.participants.find(p => !p.isDisconnected) || targetRoom.participants[0];
        if (nextHost) {
          targetRoom.hostId = nextHost.id;
          nextHost.isHost = true;
          io.to(roomCode).emit('participant_updated', nextHost);

          const hostMsg: ChatMessage = {
            id: `host-${Date.now()}`,
            senderId: 'system',
            senderName: 'AFTERHOURS',
            senderAvatar: '👑',
            text: `${nextHost.name} is now the room host`,
            timestamp: Date.now(),
            isSystem: true,
          };
          targetRoom.chat.push(hostMsg);
          io.to(roomCode).emit('chat_message', hostMsg);
        }
      }

      io.to(roomCode).emit('participants_synced', {
        participants: targetRoom.participants,
        hostId: targetRoom.hostId,
      });

      if (targetRoom.skribbl.drawerId === participantId && (targetRoom.skribbl.status === 'drawing' || targetRoom.skribbl.status === 'selecting_word')) {
        endSkribblRound(targetRoom);
      }

      if (targetRoom.participants.length === 0) {
        if (targetRoom.timerInterval) clearInterval(targetRoom.timerInterval);
        if (targetRoom.voteTimerInterval) clearInterval(targetRoom.voteTimerInterval);
        setTimeout(() => {
          if (rooms.get(roomCode)?.participants.length === 0) {
            rooms.delete(roomCode);
          }
        }, 30 * 60 * 1000);
      }
    }, 25000);

    disconnectTimers.set(participantId, graceTimer);
  });
});

function launchActivity(room: InternalRoom, activity: ActivityType, reason: string) {
  if (room.voteTimerInterval) {
    clearInterval(room.voteTimerInterval);
    room.voteTimerInterval = null;
  }

  room.activeActivity = activity;
  if (activity === 'hangout') {
    room.activeTab = 'hangout';
  } else if (activity === 'watch') {
    room.activeTab = 'watch';
  } else if (activity === 'skribbl') {
    room.activeTab = 'skribbl';
  } else {
    // trivia, truth_or_dare, would_you_rather, tic_tac_toe
    room.activeTab = 'games';
  }

  room.activityVoteSession = null;

  const announcement: ActivityAnnouncement = {
    id: `ann-${Date.now()}`,
    text: `🚀 ${ACTIVITY_LABELS[activity]} is now active!`,
    activity,
    timestamp: Date.now(),
  };
  room.activityAnnouncement = announcement;

  io.to(room.code).emit('activity_changed', {
    activity,
    activeTab: room.activeTab,
    announcement,
  });

  const chatMsg: ChatMessage = {
    id: `act-change-${Date.now()}`,
    senderId: 'system',
    senderName: 'AFTERHOURS',
    senderAvatar: '🎉',
    text: `${reason}. Everyone is now viewing: ${ACTIVITY_LABELS[activity]}`,
    timestamp: Date.now(),
    isSystem: true,
  };
  room.chat.push(chatMsg);
  io.to(room.code).emit('chat_message', chatMsg);
}

function startSkribblTurn(room: InternalRoom) {
  if (room.participants.length === 0) return;
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.wordSelectionTimeout) {
    clearTimeout(room.wordSelectionTimeout);
    room.wordSelectionTimeout = null;
  }

  const activeParticipants = room.participants.filter(p => !p.isDisconnected);
  const participantPool = activeParticipants.length > 0 ? activeParticipants : room.participants;
  if (participantPool.length === 0) return;

  const drawer = participantPool[room.drawerIndex % participantPool.length];
  room.skribbl.drawerId = drawer.id;
  room.skribbl.drawerName = drawer.name;
  room.skribbl.status = 'selecting_word';
  room.skribbl.secretWord = undefined;
  room.skribbl.maskedHint = '';
  room.strokes = [];

  const { words: options, difficulties } = generateWordOptions(
    room.skribbl.difficulty || 'mixed',
    room.usedWords
  );
  room.skribbl.wordOptions = options;
  room.skribbl.wordOptionDifficulties = difficulties;

  // Direct socket-level emission to all active sockets of the drawer WITH word choices
  for (const [sockId, pId] of socketToParticipant.entries()) {
    if (pId === drawer.id) {
      io.to(sockId).emit('skribbl_word_options', { 
        options, 
        difficulties 
      });
      io.to(sockId).emit('skribbl_status_changed', {
        status: 'selecting_word',
        drawerId: drawer.id,
        drawerName: drawer.name,
        currentRound: room.skribbl.currentRound,
        totalRounds: room.skribbl.totalRounds,
        difficulty: room.skribbl.difficulty || 'mixed',
        wordOptions: options,
        wordOptionDifficulties: difficulties,
      });
    }
  }
  // And emit to drawer.id room
  io.to(drawer.id).emit('skribbl_word_options', { 
    options, 
    difficulties 
  });

  // Emit to guessers without wordOptions to keep candidate words private
  for (const [sockId, pId] of socketToParticipant.entries()) {
    if (pId !== drawer.id && socketToRoom.get(sockId) === room.code) {
      io.to(sockId).emit('skribbl_status_changed', {
        status: 'selecting_word',
        drawerId: drawer.id,
        drawerName: drawer.name,
        currentRound: room.skribbl.currentRound,
        totalRounds: room.skribbl.totalRounds,
        difficulty: room.skribbl.difficulty || 'mixed',
      });
    }
  }

  // 20-second automatic selection fallback so round NEVER hangs indefinitely if drawer is AFK
  room.wordSelectionTimeout = setTimeout(() => {
    room.wordSelectionTimeout = null;
    const targetRoom = rooms.get(room.code);
    if (!targetRoom || targetRoom.skribbl.status !== 'selecting_word') return;
    const fallbackWord = targetRoom.skribbl.wordOptions?.[0] || 'STAR';
    beginSkribblDrawingPhase(targetRoom, fallbackWord);
  }, 20000);
}

function beginSkribblDrawingPhase(room: InternalRoom, chosenWord: string) {
  if (room.wordSelectionTimeout) {
    clearTimeout(room.wordSelectionTimeout);
    room.wordSelectionTimeout = null;
  }
  if (room.timerInterval) clearInterval(room.timerInterval);

  const cleanWord = (chosenWord || 'STAR').trim().toUpperCase();
  room.skribbl.secretWord = cleanWord;
  room.usedWords.add(cleanWord);
  if (room.usedWords.size > 100) {
    const oldestWord = room.usedWords.values().next().value;
    if (oldestWord) room.usedWords.delete(oldestWord);
  }

  room.skribbl.maskedHint = getWordHint(cleanWord, 0.2);
  room.skribbl.status = 'drawing';
  room.skribbl.timeLeft = 100;
  room.skribbl.correctGuessers = [];
  room.skribbl.reactions = { likes: [], dislikes: [] };
  room.strokes = [];

  // Deliver to drawer WITH secretWord
  for (const [sockId, pId] of socketToParticipant.entries()) {
    if (pId === room.skribbl.drawerId) {
      io.to(sockId).emit('skribbl_turn_started', {
        status: 'drawing',
        drawerId: room.skribbl.drawerId,
        drawerName: room.skribbl.drawerName,
        secretWord: cleanWord,
        maskedHint: room.skribbl.maskedHint,
        timeLeft: 100,
        isDrawer: true,
        reactions: room.skribbl.reactions,
        scoringRules: room.skribbl.scoringRules,
      });
    }
  }
  if (room.skribbl.drawerId) {
    io.to(room.skribbl.drawerId).emit('skribbl_turn_started', {
      status: 'drawing',
      drawerId: room.skribbl.drawerId,
      drawerName: room.skribbl.drawerName,
      secretWord: cleanWord,
      maskedHint: room.skribbl.maskedHint,
      timeLeft: 100,
      isDrawer: true,
      reactions: room.skribbl.reactions,
      scoringRules: room.skribbl.scoringRules,
    });
  }

  // Deliver to guessers (all other room members) WITHOUT secretWord
  for (const [sockId, pId] of socketToParticipant.entries()) {
    if (pId !== room.skribbl.drawerId && socketToRoom.get(sockId) === room.code) {
      io.to(sockId).emit('skribbl_turn_started', {
        status: 'drawing',
        drawerId: room.skribbl.drawerId,
        drawerName: room.skribbl.drawerName,
        secretWord: undefined,
        maskedHint: room.skribbl.maskedHint,
        timeLeft: 100,
        isDrawer: false,
        reactions: room.skribbl.reactions,
        scoringRules: room.skribbl.scoringRules,
      });
    }
  }

  room.timerInterval = setInterval(() => {
    room.skribbl.timeLeft -= 1;

    if (room.skribbl.timeLeft === 50 && room.skribbl.secretWord) {
      room.skribbl.maskedHint = getWordHint(room.skribbl.secretWord, 0.45);
      io.to(room.code).emit('skribbl_hint_update', { maskedHint: room.skribbl.maskedHint });
    }

    io.to(room.code).emit('skribbl_tick', { timeLeft: room.skribbl.timeLeft });

    if (room.skribbl.timeLeft <= 0) {
      endSkribblRound(room);
    }
  }, 1000);
}

function endSkribblRound(room: InternalRoom) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.wordSelectionTimeout) {
    clearTimeout(room.wordSelectionTimeout);
    room.wordSelectionTimeout = null;
  }
  const revealedWord = room.skribbl.secretWord || 'WORD';
  room.skribbl.status = 'round_end';

  io.to(room.code).emit('skribbl_round_ended', {
    revealedWord,
    scores: room.skribbl.scores,
  });

  setTimeout(() => {
    room.drawerIndex += 1;
    if (room.drawerIndex >= room.participants.length) {
      room.drawerIndex = 0;
      room.skribbl.currentRound += 1;
    }

    if (room.skribbl.currentRound > room.skribbl.totalRounds) {
      room.skribbl.status = 'game_over';
      io.to(room.code).emit('skribbl_game_over', { scores: room.skribbl.scores });
    } else {
      startSkribblTurn(room);
    }
  }, 4000);
}

// -----------------------------------------------------------------------------
// Vite middleware / Static Serving
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(distPath)) {
      distPath = path.resolve(process.cwd(), 'dist');
    }
    console.log(`> Serving static assets in production from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`> AFTERHOURS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server start error:', err);
  process.exit(1);
});
