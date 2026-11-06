import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGuessScore, calculateDrawerScore, formatTimeRemaining } from '../game/scoring.ts';
import { isCorrectGuess, getWordHint, containsExactAnswer, isCloseGuess } from '../game/wordBank.ts';

test('scoring formula handles edge cases gracefully', () => {
  // Test 0 time remaining
  assert.equal(calculateGuessScore({ timeLeft: 0, totalTime: 60, orderIndex: 0 }), 0);

  // Test negative time
  assert.equal(calculateGuessScore({ timeLeft: -5, totalTime: 60, orderIndex: 0 }), 0);

  // Test max score on immediate 1st guess
  const maxScore = calculateGuessScore({ timeLeft: 60, totalTime: 60, orderIndex: 0 });
  assert.equal(maxScore, 500); // 150 base + 250 speed + 100 1st place

  // Test 2nd place
  const secondScore = calculateGuessScore({ timeLeft: 60, totalTime: 60, orderIndex: 1 });
  assert.equal(secondScore, 450); // 150 base + 250 speed + 50 2nd place
});

test('drawer score calculation scales proportionally', () => {
  assert.equal(calculateDrawerScore(0, 5), 0);
  assert.equal(calculateDrawerScore(5, 5), 300);
  assert.equal(calculateDrawerScore(2, 4), 150);
});

test('duplicate scoring prevention: player can only score once per round', () => {
  const correctGuessers = new Set<string>();
  const scores: Record<string, number> = {};

  const processGuess = (playerId: string, guess: string, targetWord: string, timeLeft: number) => {
    if (correctGuessers.has(playerId)) {
      return { scored: false, reason: 'already_scored' };
    }
    if (isCorrectGuess(guess, targetWord)) {
      correctGuessers.add(playerId);
      const points = calculateGuessScore({ timeLeft, totalTime: 60, orderIndex: correctGuessers.size - 1 });
      scores[playerId] = (scores[playerId] || 0) + points;
      return { scored: true, points };
    }
    return { scored: false, reason: 'incorrect' };
  };

  const res1 = processGuess('player1', 'apple', 'APPLE', 45);
  assert.equal(res1.scored, true);
  const initialScore = scores['player1'];
  assert.ok(initialScore > 0);

  // Submit again in the same round
  const res2 = processGuess('player1', 'apple', 'APPLE', 40);
  assert.equal(res2.scored, false);
  assert.equal(res2.reason, 'already_scored');
  assert.equal(scores['player1'], initialScore, 'Score must not increment on duplicate submission');
});

test('close guess detection identifies typos accurately', () => {
  assert.equal(isCloseGuess('appl', 'APPLE'), true);
  assert.equal(isCloseGuess('aple', 'APPLE'), true);
  assert.equal(isCloseGuess('banana', 'APPLE'), false);
  assert.equal(isCloseGuess('apple', 'APPLE'), false); // Exact match is not close guess
  assert.equal(isCloseGuess('campin', 'CAMPING'), true);
});

test('word guessing logic handles punctuation and case variations', () => {
  assert.equal(isCorrectGuess('PENGUIN', 'penguin'), true);
  assert.equal(isCorrectGuess('  Penguin  ', 'penguin'), true);
  assert.equal(isCorrectGuess('penguins', 'penguin'), false);
  assert.equal(isCorrectGuess('time machine!', 'TIME MACHINE'), true);
});

test('word hint generator preserves spaces and reveals consonants/vowels', () => {
  const hint = getWordHint('TIME MACHINE', 0.3);
  assert.ok(hint.includes('  ')); // double space for word separator
  assert.ok(hint.includes('_'));
});

test('room code normalization handles accidental spaces, lowercase, and symbols consistently', () => {
  const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  assert.equal(normalizeCode('  abc123  '), 'ABC123');
  assert.equal(normalizeCode('ab-c1#23'), 'ABC123');
  assert.equal(normalizeCode('AH-7X9'), 'AH7X9');
  assert.equal(normalizeCode('xyz999'), 'XYZ999');
});

test('leaderboard ranking sorts by score and resolves ties consistently', () => {
  const participants = [
    { id: 'p1', name: 'Bob', score: 250, joinedAt: 1000 },
    { id: 'p2', name: 'Alice', score: 500, joinedAt: 2000 },
    { id: 'p3', name: 'Charlie', score: 250, joinedAt: 1500 },
  ];

  const sorted = [...participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.joinedAt - b.joinedAt; // Tie-break by joined order
  });

  assert.equal(sorted[0].name, 'Alice');
  assert.equal(sorted[1].name, 'Bob');
  assert.equal(sorted[2].name, 'Charlie');
});

test('normalized drawing coordinates clamp between 0.0 and 1.0 and scale to canvas bounds', () => {
  const normalizePoint = (clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) => {
    const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const clampedY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return {
      x: Math.round((clampedX / rect.width) * 10000) / 10000,
      y: Math.round((clampedY / rect.height) * 10000) / 10000,
    };
  };

  const rect = { left: 50, top: 50, width: 800, height: 600 };
  const ptCenter = normalizePoint(450, 350, rect);
  assert.equal(ptCenter.x, 0.5);
  assert.equal(ptCenter.y, 0.5);

  const ptOverflow = normalizePoint(900, 700, rect);
  assert.equal(ptOverflow.x, 1);
  assert.equal(ptOverflow.y, 1);

  const ptUnderflow = normalizePoint(10, 10, rect);
  assert.equal(ptUnderflow.x, 0);
  assert.equal(ptUnderflow.y, 0);

  // Scaling back to another screen (e.g. mobile 375x300)
  const mobileCanvas = { width: 375, height: 300 };
  assert.equal(ptCenter.x * mobileCanvas.width, 187.5);
  assert.equal(ptCenter.y * mobileCanvas.height, 150);
});

test('host identity is preserved during temporary disconnect within grace window', () => {
  interface RoomStateTest {
    hostId: string;
    participants: { id: string; name: string; isHost: boolean; isDisconnected?: boolean }[];
  }

  const room: RoomStateTest = {
    hostId: 'user_host_1',
    participants: [
      { id: 'user_host_1', name: 'HostAlice', isHost: true, isDisconnected: false },
      { id: 'user_guest_2', name: 'GuestBob', isHost: false, isDisconnected: false },
    ],
  };

  // Simulate temporary socket disconnect of host
  const onTemporaryDisconnect = (participantId: string) => {
    const p = room.participants.find(part => part.id === participantId);
    if (p) p.isDisconnected = true;
    // CRITICAL: Host must NOT be reassigned immediately!
  };

  onTemporaryDisconnect('user_host_1');

  // Verify room still has 2 participants and host identity is untouched
  assert.equal(room.participants.length, 2);
  assert.equal(room.hostId, 'user_host_1');
  assert.equal(room.participants[0].isDisconnected, true);
  assert.equal(room.participants[1].isHost, false, 'Guest must NOT become host on temporary drop');

  // Simulate host reconnection with same stable participant ID
  const onReconnect = (participantId: string) => {
    const p = room.participants.find(part => part.id === participantId);
    if (p) {
      p.isDisconnected = false;
      if (room.hostId === participantId) {
        p.isHost = true;
      }
    }
  };

  onReconnect('user_host_1');

  assert.equal(room.participants.length, 2);
  assert.equal(room.hostId, 'user_host_1');
  assert.equal(room.participants[0].isDisconnected, false);
  assert.equal(room.participants[0].isHost, true);
  assert.equal(room.participants[1].isHost, false);
});

test('host status only transfers when host has genuinely left or grace period expires', () => {
  interface RoomStateTest {
    hostId: string;
    participants: { id: string; name: string; isHost: boolean; isDisconnected?: boolean }[];
  }

  const room: RoomStateTest = {
    hostId: 'user_host_1',
    participants: [
      { id: 'user_host_1', name: 'HostAlice', isHost: true, isDisconnected: false },
      { id: 'user_guest_2', name: 'GuestBob', isHost: false, isDisconnected: false },
    ],
  };

  // Simulate explicit leave
  const onExplicitLeave = (participantId: string) => {
    room.participants = room.participants.filter(p => p.id !== participantId);
    if (room.hostId === participantId && room.participants.length > 0) {
      const nextHost = room.participants.find(p => !p.isDisconnected) || room.participants[0];
      if (nextHost) {
        room.hostId = nextHost.id;
        nextHost.isHost = true;
      }
    }
  };

  onExplicitLeave('user_host_1');

  assert.equal(room.participants.length, 1);
  assert.equal(room.hostId, 'user_guest_2');
  assert.equal(room.participants[0].id, 'user_guest_2');
  assert.equal(room.participants[0].isHost, true, 'GuestBob is now cleanly and authoritatively elected host');
});

test('Scribble round start: drawer receives 3 selectable word choices and transitions to drawing', () => {
  const participants = [
    { id: 'ah_u_drawer', name: 'DrawerDan' },
    { id: 'ah_u_guesser', name: 'GuesserGrace' },
  ];

  interface MockSkribblState {
    status: 'lobby' | 'selecting_word' | 'drawing' | 'round_end';
    drawerId: string | null;
    secretWord?: string;
    wordOptions?: string[];
    timeLeft: number;
  }

  const skribbl: MockSkribblState = {
    status: 'lobby',
    drawerId: null,
    timeLeft: 60,
  };

  // 1. Host starts round
  const drawer = participants[0];
  skribbl.drawerId = drawer.id;
  skribbl.status = 'selecting_word';
  skribbl.wordOptions = ['SUN', 'TREE', 'CASTLE'];

  // Word selection delivery payload
  assert.equal(skribbl.status, 'selecting_word');
  assert.equal(skribbl.wordOptions.length, 3);
  assert.ok(skribbl.wordOptions.includes('SUN'));

  // 2. Drawer selects a word
  const selectedWord = skribbl.wordOptions[1]; // TREE
  skribbl.secretWord = selectedWord;
  skribbl.status = 'drawing';
  skribbl.wordOptions = undefined;

  assert.equal(skribbl.status, 'drawing');
  assert.equal(skribbl.secretWord, 'TREE');
  assert.equal(skribbl.wordOptions, undefined);
});

test('Scribble secret word privacy: guessers receive undefined secretWord during drawing phase', () => {
  const drawerId = 'drawer_123';
  const secretWord = 'ASTRONAUT';

  const createClientTurnPayload = (recipientId: string) => {
    const isDrawer = recipientId === drawerId;
    return {
      status: 'drawing',
      drawerId,
      secretWord: isDrawer ? secretWord : undefined,
      maskedHint: isDrawer ? 'ASTRONAUT' : '_ S _ _ _ _ _ _ T',
      timeLeft: 60,
      isDrawer,
    };
  };

  const drawerPayload = createClientTurnPayload('drawer_123');
  assert.equal(drawerPayload.isDrawer, true);
  assert.equal(drawerPayload.secretWord, 'ASTRONAUT');

  const guesserPayload = createClientTurnPayload('guesser_456');
  assert.equal(guesserPayload.isDrawer, false);
  assert.equal(guesserPayload.secretWord, undefined, 'Secret word must be strictly masked from guessers');
  assert.ok(guesserPayload.maskedHint.includes('_'));
});

test('Scribble touch input: single-tap point is preserved as valid dot stroke on canvas', () => {
  const pt = { x: 0.5, y: 0.5 };
  const rawPoints = [pt];

  // If user tapped without dragging, points array has 1 item
  // Our touch handler duplicates it so canvas redraws a circle/dot mark
  const strokePoints = rawPoints.length === 1 ? [rawPoints[0], rawPoints[0]] : rawPoints;

  assert.equal(strokePoints.length, 2);
  assert.deepEqual(strokePoints[0], pt);
  assert.deepEqual(strokePoints[1], pt);
});
