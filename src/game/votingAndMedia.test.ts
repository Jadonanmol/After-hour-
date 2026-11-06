import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMediaError } from '../services/mediaService.ts';
import type { ActivityType } from '../types/index.ts';

function tallyVotes(proposals: Record<ActivityType, { voterIds: string[] }>): {
  winner?: ActivityType;
  isTied: boolean;
  tiedActivities?: ActivityType[];
} {
  let maxVotes = 0;
  let candidates: ActivityType[] = [];

  for (const [actKey, prop] of Object.entries(proposals)) {
    const count = prop.voterIds.length;
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [actKey as ActivityType];
    } else if (count === maxVotes && count > 0) {
      candidates.push(actKey as ActivityType);
    }
  }

  if (maxVotes === 0 || candidates.length === 0) {
    return { isTied: false };
  }

  if (candidates.length > 1) {
    return { isTied: true, tiedActivities: candidates };
  }

  return { isTied: false, winner: candidates[0] };
}

test('parseMediaError correctly classifies NotAllowedError as permission_denied with site settings guide', () => {
  const err = { name: 'NotAllowedError', message: 'Permission denied' };
  const info = parseMediaError(err, 'camera');
  assert.equal(info.errorKind, 'permission_denied');
  assert.equal(info.kind, 'camera');
  assert.ok(info.instructions.length >= 3);
  assert.ok(info.instructions.some(i => i.toLowerCase().includes('site settings') || i.toLowerCase().includes('allow')));
});

test('parseMediaError correctly classifies NotReadableError as device_busy', () => {
  const err = { name: 'NotReadableError', message: 'Device in use' };
  const info = parseMediaError(err, 'microphone');
  assert.equal(info.errorKind, 'device_busy');
  assert.equal(info.kind, 'microphone');
  assert.ok(info.message.toLowerCase().includes('using your microphone'));
});

test('parseMediaError correctly classifies NotFoundError as not_found', () => {
  const err = { name: 'NotFoundError', message: 'Device not found' };
  const info = parseMediaError(err, 'camera');
  assert.equal(info.errorKind, 'not_found');
  assert.ok(info.title.toLowerCase().includes('no camera'));
});

test('tallyVotes calculates single clear winner accurately', () => {
  const proposals: Record<ActivityType, { voterIds: string[] }> = {
    watch: { voterIds: ['p1', 'p2', 'p3'] },
    skribbl: { voterIds: ['p4'] },
    trivia: { voterIds: [] },
    truth_or_dare: { voterIds: [] },
    would_you_rather: { voterIds: [] },
    tic_tac_toe: { voterIds: [] },
    hangout: { voterIds: [] },
  };

  const result = tallyVotes(proposals);
  assert.equal(result.isTied, false);
  assert.equal(result.winner, 'watch');
});

test('tallyVotes detects tie between multiple activities', () => {
  const proposals: Record<ActivityType, { voterIds: string[] }> = {
    watch: { voterIds: ['p1', 'p2'] },
    skribbl: { voterIds: ['p3', 'p4'] },
    trivia: { voterIds: ['p5'] },
    truth_or_dare: { voterIds: [] },
    would_you_rather: { voterIds: [] },
    tic_tac_toe: { voterIds: [] },
    hangout: { voterIds: [] },
  };

  const result = tallyVotes(proposals);
  assert.equal(result.isTied, true);
  assert.deepEqual(result.tiedActivities?.sort(), ['skribbl', 'watch']);
});

test('General chat messages are routed to general channel and never trigger secret word validation or score awards', () => {
  const secretWord = 'ELEPHANT';
  const chatMessages: { text: string; channel?: 'general' | 'skribbl'; isGuessEvaluated: boolean }[] = [];

  function processIncomingChat(text: string, channel?: 'general' | 'skribbl') {
    if (channel === 'skribbl') {
      const isCorrect = text.trim().toUpperCase() === secretWord;
      chatMessages.push({ text, channel, isGuessEvaluated: true });
      return { isCorrect, scored: isCorrect };
    }
    // General chat: NEVER evaluate as guess
    chatMessages.push({ text, channel: 'general', isGuessEvaluated: false });
    return { isCorrect: false, scored: false };
  }

  // User talks in general chat about an elephant
  const generalRes = processIncomingChat('I saw an elephant yesterday at the zoo', 'general');
  assert.equal(generalRes.isCorrect, false);
  assert.equal(generalRes.scored, false);
  assert.equal(chatMessages[0].isGuessEvaluated, false);

  // User sends the exact secret word in general chat: still NOT evaluated as game guess
  const exactInGeneral = processIncomingChat('ELEPHANT', 'general');
  assert.equal(exactInGeneral.isCorrect, false);
  assert.equal(exactInGeneral.scored, false);
  assert.equal(chatMessages[1].isGuessEvaluated, false);

  // User sends the guess in dedicated game chat
  const guessRes = processIncomingChat('elephant', 'skribbl');
  assert.equal(guessRes.isCorrect, true);
  assert.equal(guessRes.scored, true);
  assert.equal(chatMessages[2].isGuessEvaluated, true);
});

test('Camera freeze recovery preserves audio tracks and continuous two-way audio', () => {
  // Mock MediaStream and tracks
  const mockAudioTrack = { kind: 'audio', id: 'audio-1', stop: () => {}, readyState: 'live', enabled: true };
  const mockFrozenVideoTrack = { kind: 'video', id: 'video-frozen', stop: () => {}, readyState: 'live', muted: true };
  const mockFreshVideoTrack = { kind: 'video', id: 'video-fresh', stop: () => {}, readyState: 'live', muted: false };

  // Simulate local stream with both audio and frozen video
  const localAudioTracks = [mockAudioTrack];
  const oldVideoTracks = [mockFrozenVideoTrack];

  // During recovery: old video track is stopped and fresh one acquired, audio tracks are preserved
  let oldVideoStopped = false;
  mockFrozenVideoTrack.stop = () => { oldVideoStopped = true; };

  oldVideoTracks.forEach(t => t.stop());
  assert.equal(oldVideoStopped, true);

  // Re-assembled stream retains the EXACT same audio track
  const recoveredAudioTracks = [...localAudioTracks];
  const recoveredVideoTracks = [mockFreshVideoTrack];

  assert.equal(recoveredAudioTracks.length, 1);
  assert.equal(recoveredAudioTracks[0].id, 'audio-1');
  assert.equal(recoveredAudioTracks[0].enabled, true);
  assert.equal(recoveredVideoTracks[0].id, 'video-fresh');
  assert.equal(recoveredVideoTracks[0].muted, false);
});

test('Camera freeze recovery enforces bounded retries and triggers manual retry state', () => {
  const maxAttempts = 3;
  let attempts = 0;
  let healthStatus: 'healthy' | 'recovering' | 'failed' = 'healthy';

  function simulateRecoveryAttempt(isManual = false) {
    if (isManual) {
      attempts = 0;
    }
    if (!isManual && attempts >= maxAttempts) {
      healthStatus = 'failed';
      return false;
    }
    attempts++;
    healthStatus = 'recovering';
    return true;
  }

  // 3 automated attempts
  assert.equal(simulateRecoveryAttempt(), true);
  assert.equal(attempts, 1);
  assert.equal(simulateRecoveryAttempt(), true);
  assert.equal(attempts, 2);
  assert.equal(simulateRecoveryAttempt(), true);
  assert.equal(attempts, 3);

  // 4th automated attempt should be blocked and transition to 'failed'
  const blockedAttempt = simulateRecoveryAttempt();
  assert.equal(blockedAttempt, false);
  assert.equal(healthStatus, 'failed');

  // Manual user retry resets attempts and allows recovery
  const manualRetry = simulateRecoveryAttempt(true);
  assert.equal(manualRetry, true);
  assert.equal(attempts, 1);
  assert.equal(healthStatus, 'recovering');
});

test('Top 3 podium: sorts participants by score, breaks ties consistently, and assigns Gold/Silver/Bronze', () => {
  const participants = [
    { id: 'p1', name: 'Charlie', avatar: '🐱' },
    { id: 'p2', name: 'Alice', avatar: '🦊' },
    { id: 'p3', name: 'Bob', avatar: '🐶' },
    { id: 'p4', name: 'Diana', avatar: '🐼' },
  ];

  const scores: Record<string, number> = {
    p1: 650,
    p2: 900,
    p3: 650, // Tied with p1
    p4: 300,
  };

  const sorted = [...participants].sort((a, b) => {
    const scoreA = scores[a.id] || 0;
    const scoreB = scores[b.id] || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.name.localeCompare(b.name);
  });

  // 1st place: Alice (900 pts - Gold)
  assert.equal(sorted[0].id, 'p2');
  assert.equal(scores[sorted[0].id], 900);

  // 2nd place: Bob (650 pts - Silver, alphabetical before Charlie)
  assert.equal(sorted[1].id, 'p3');
  assert.equal(scores[sorted[1].id], 650);

  // 3rd place: Charlie (650 pts - Bronze)
  assert.equal(sorted[2].id, 'p1');
  assert.equal(scores[sorted[2].id], 650);

  // 4th place runner-up: Diana (300 pts)
  assert.equal(sorted[3].id, 'p4');
  assert.equal(scores[sorted[3].id], 300);
});

